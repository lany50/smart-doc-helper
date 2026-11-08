// Free-use and asynchronous AI regressions; no live API calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'ai-jobs-test-'));
process.env.AI_JOB_LOCAL_DIR = dir;
process.env.API_KEY = 'test-only';
const require = createRequire(import.meta.url);
const chat = require('../netlify/functions/chat-completion.js');
const ocr = require('../netlify/functions/vision-ocr.js');
const jobs = require('../netlify/functions/shared/ai-jobs.js');
const { requestModel } = require('../netlify/functions/shared/model-request.js');
const { parseGrade } = require('../composition-validation.js');
const { default: worker } = await import('../netlify/functions/ai-worker-background.mjs');
const { default: status } = await import('../netlify/functions/ai-job-status.mjs');
const { default: cleanup } = await import('../netlify/functions/ai-job-cleanup.mjs');
let checks = 0;
const check = (label, condition) => { assert.ok(condition, label); checks++; console.log(`✅ ${label}`); };
const report = { totalScore: 12, scores: { content: 4, language: 5, structure: 3 }, contentReview: '内容完整，表达基本准确。', suggestions: '改善连接词并检查时态。' };
const composition = { type: 'application', topic: '给朋友写一封邀请信，邀请他参加学校运动会。', content: 'Dear Tom, please join our school sports day this Friday. We can play football together. Yours, Li Hua.' };
let mode = 'ok', lastBody, modelCalls = 0, workerCalls = 0;
let output = JSON.stringify(report);
const event = (body, headers = {}) => ({ httpMethod: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const chatBody = (extra = {}) => ({ model: 'deepseek-v4.1-flash', purpose: 'grade', composition, messages: [{ role: 'user', content: '请批改作文' }], ...extra });
const callChat = async (body = chatBody(), headers) => { const r = await chat.handler(event(body, headers)); return { status: r.statusCode, data: JSON.parse(r.body) }; };
const poll = id => status(new Request(`https://example.test/.netlify/functions/ai-job-status?id=${id}`));
const runWorker = id => worker(new Request('https://example.test/worker', { method: 'POST', body: JSON.stringify({ id }) }));
globalThis.fetch = async (url, options) => {
    if (String(url).endsWith('/ai-worker-background')) { workerCalls++; return new Response(null, { status: mode === 'start-fail' ? 503 : 202 }); }
    modelCalls++; lastBody = JSON.parse(options.body);
    if (mode === 'timeout') throw new DOMException('timeout', 'TimeoutError');
    if (mode === 'network') throw new TypeError('fetch failed');
    if (mode === 'html') return new Response('<html>bad gateway</html>', { status: 502 });
    if (mode === 'upstream-error') return Response.json({ error: { message: 'private provider detail' } }, { status: 503 });
    return Response.json({ model: lastBody.model, choices: [{ message: { content: mode === 'empty' ? '' : output }, finish_reason: mode === 'length' ? 'length' : 'stop' }] });
};
try {
    for (let i = 0; i < 5; i++) {
        const result = await callChat();
        check(`无卡第 ${i + 1} 次批改成功且无额度字段`, result.status === 200 && !('billing' in result.data));
    }
    check('忽略旧浏览器卡密', (await callChat(chatBody(), { 'x-card-code': 'INVALID' })).status === 200);
    check('模型关闭思考', lastBody.thinking.type === 'disabled');
    await callChat(chatBody({ max_tokens: 99999 }));
    check('保留完整报告输出预算', lastBody.max_tokens === 12000);
    check('拒绝未知模型', (await callChat(chatBody({ model: 'bad' }))).status === 400);
    const before = modelCalls;
    check('占位文字不调用模型', (await callChat(chatBody({ composition: { type: 'continuation', topic: '测试', original: '测试' } }))).status === 400 && modelCalls === before);
    check('真实短作文可批改', (await callChat(chatBody({ composition: { ...composition, content: 'Thank you for your help.' } }))).status === 200);
    for (const failure of ['empty', 'length']) {
        mode = failure;
        check(`${failure} 结果不显示成成功`, (await callChat()).data.code === 'MODEL_INCOMPLETE_RESPONSE');
    }
    mode = 'ok'; output = 'not JSON';
    check('无效评分不显示默认零分', (await callChat()).data.code === 'MODEL_INVALID_REPORT');
    output = JSON.stringify(report);
    for (const failure of ['timeout', 'network', 'html', 'upstream-error']) {
        mode = failure;
        const r = await callChat();
        check(`${failure} 返回可读错误且不暴露上游内容`, r.status >= 500 && r.data.error.includes('AI') && !r.data.error.includes('private'));
    }
    mode = 'ok';
    for (let i = 0; i < 18; i++) {
        const r = await ocr.handler(event({ action: 'split_ocr_text', rawText: 'some text', roles: ['essay'], model: i % 2 ? 'gemini-4-argon' : 'deepseek-v4.1-flash' }));
        assert.equal(r.statusCode, 200);
    }
    check('无卡识别超过原有15次限制仍可使用', true);
    const beforeStart = modelCalls;
    const started = await callChat(chatBody(), { prefer: 'respond-async' });
    const id = started.data.jobId;
    check('请求立即返回后台任务ID', started.status === 202 && /^[a-f0-9]{64}$/.test(id) && workerCalls === 1);
    check('启动任务不等待模型', modelCalls === beforeStart);
    check('未完成任务返回202', (await poll(id)).status === 202);
    await runWorker(id);
    const result = await poll(id);
    check('后台处理完成可取回报告', result.status === 200 && (await result.json()).content === output);
    check('完成后删除原始输入', await jobs.getJobsStore().get(`request/${id}`) === null);
    const calls = modelCalls; await runWorker(id);
    check('重复后台通知不重复调用模型', calls === modelCalls);
    const failing = await callChat(chatBody(), { prefer: 'respond-async' });
    mode = 'timeout'; await runWorker(failing.data.jobId); mode = 'ok';
    const failed = await poll(failing.data.jobId);
    check('后台超时错误能送达页面', failed.status === 504 && (await failed.json()).code === 'MODEL_TIMEOUT');
    check('拒绝猜测或无效任务ID', (await poll('bad')).status === 404);
    await jobs.getJobsStore().setJSON(`result/${id}`, { state: 'pending', expiresAt: Date.now() - 1 });
    check('过期任务不可读取', (await poll(id)).status === 404);
    await cleanup();
    check('定期清理过期结果', await jobs.getJobsStore().get(`result/${id}`) === null);
    const oldCount = modelCalls;
    const asyncOcr = await ocr.handler(event({ action: 'split_ocr_text', rawText: 'hello', roles: ['essay'] }, { prefer: 'respond-async' }));
    check('OCR同样通过后台任务运行', asyncOcr.statusCode === 202 && modelCalls === oldCount);
    await runWorker(JSON.parse(asyncOcr.body).jobId);
    check('后台OCR处理完成', (await poll(JSON.parse(asyncOcr.body).jobId)).status === 200);
    mode = 'start-fail';
    check('任务启动失败给出错误', (await callChat(chatBody(), { prefer: 'respond-async' })).status >= 500);
    mode = 'ok';
    const realFetch = globalThis.fetch;
    globalThis.fetch = (_url, { signal }) => new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 100, Response.json({}));
        signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); });
    });
    let timedOut = false;
    try { await requestModel('https://example.test', { apiKey: 'test', body: {}, timeoutMs: 5 }); } catch (e) { timedOut = e.code === 'MODEL_TIMEOUT'; }
    globalThis.fetch = realFetch;
    check('真实AbortSignal能终止挂起的模型请求', timedOut);
    for (const data of [{ ...report, scores: {} }, { ...report, totalScore: 15 }, { ...report, totalScore: '12' }, { ...report, contentReview: '' }]) {
        assert.throws(() => parseGrade(JSON.stringify(data), 'application'));
    }
    check('保持评分结构校验', true);
    check('真实零分可展示', parseGrade(JSON.stringify({ ...report, totalScore: 0, scores: { content: 0, language: 0, structure: 0 } }), 'application').totalScore === 0);
    for (const file of ['index.html', 'script.js', 'style.css']) check(`${file} 无收费入口`, !/次数卡|卡密|闲鱼|cardModal|cardHeaders|handleBillingError/.test(readFileSync(new URL('../' + file, import.meta.url), 'utf8')));
    check('旧管理页面不再发布', !existsSync(new URL('../dist/admin.html', import.meta.url)));
    console.log(`\n${checks} 项检查通过`);
} finally { rmSync(dir, { recursive: true, force: true }); }
