// 浏览器回归：仅使用本地页面和模拟响应，不调用真实模型或消耗额度。
// npm run test:ui；可选 BROWSER_EXECUTABLE_PATH、UI_SCREENSHOT_DIR。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = { '/': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/script.js': ['script.js', 'text/javascript'], '/composition-validation.js': ['composition-validation.js', 'text/javascript'] };
const server = createServer(async (req, res) => {
    const file = files[new URL(req.url, 'http://localhost').pathname];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', `${file[1]}; charset=utf-8`);
    res.end(await readFile(resolve(root, file[0])));
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const edge = '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
const executablePath = process.env.BROWSER_EXECUTABLE_PATH || (existsSync(edge) ? edge : undefined);
let browser;
let checks = 0;
function check(message, value) { assert.ok(value, message); checks++; console.log(`✅ ${message}`); }
const topic = '给朋友写一封邀请信，邀请他参加学校的志愿者活动。';
const original = 'Anna was walking home when she found a little dog beside the road. It was cold and hungry. She decided to take it to her neighbor and ask for help. Her neighbor smiled and opened the door.';
const essay = 'Dear Tom, I am writing to invite you to our volunteer activity this Saturday. We will meet at the school gate at eight and help clean the park. Please bring a bottle of water. I hope you can join us. Yours, Li Hua.';
const report = { totalScore: 12, scores: { content: 4, language: 5, structure: 3 }, contentReview: '内容完整，邀请目的明确。', suggestions: '补充活动安排并检查时态。', highlights: ['目的明确', '表达自然'], problems: ['活动细节可以更具体'], modelAnswer: essay, rubricEvidence: ['开头交代邀请目的'], missingRequirements: ['无'], confidence: '中：依据当前文字预估。', revisionTasks: [{ original: 'We will meet at the school gate.', issue: '可以补充时间', suggestion: 'We will meet at eight at the school gate.', reason: '安排更清楚', practice: '补充活动细节' }] };
const continuationReport = { ...report, totalScore: 20, scores: { content: 6, language: 7, structure: 4, norm: 3 } };
const longGuidance = Array.from({ length: 8 }, (_, i) => `${i + 1}. **写作建议 ${i + 1}**\n${'结合原文中的人物和情节，明确故事发展的原因，再安排两段续写的衔接。'.repeat(8)}`).join('\n\n');
const errors = [];
let calls = 0;
let responseMode = 'ok';
let releaseResponse;
let lastRequest;
const ocrRequests = [];
const pendingJobs = new Map();
let nextJob = 0;
let statusCalls = 0;
const queueResult = (route, result) => {
    assert.equal(route.request().headers().prefer, 'respond-async');
    assert.ok(!('x-card-code' in route.request().headers()));
    const jobId = (++nextJob).toString(16).padStart(64, '0');
    pendingJobs.set(jobId, result);
    return route.fulfill({ status: 202, json: { jobId } });
};
try {
    browser = await chromium.launch({ headless: true, executablePath });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedReport = text; } } });
    });
    await page.route('**/*', async route => {
        if (!route.request().url().startsWith(origin)) return route.abort();
        if (route.request().url().includes('/.netlify/functions/ai-job-status?')) {
            statusCalls++;
            const jobId = new URL(route.request().url()).searchParams.get('id');
            if (statusCalls === 1) return route.fulfill({ status: 503, json: { error: 'temporary status failure', code: 'JOB_STATUS_UNAVAILABLE' } });
            return route.fulfill(pendingJobs.get(jobId));
        }
        if (route.request().url().endsWith('/.netlify/functions/chat-completion')) {
            calls++; lastRequest = route.request().postDataJSON();
            if (responseMode === 'wait') await new Promise(done => { releaseResponse = done; });
            if (responseMode === 'error') return queueResult(route, { status: 504, json: { error: '模拟服务暂时不可用，请稍后重试' } });
            const content = responseMode === 'invalid' ? '模型返回了无法解析的报告'
                : lastRequest.purpose === 'guidance' ? longGuidance
                    : JSON.stringify(lastRequest.composition.type === 'continuation' ? continuationReport : report);
            return queueResult(route, { json: { content } });
        }
        if (route.request().url().endsWith('/.netlify/functions/vision-ocr')) {
            const body = route.request().postData();
            const split = body?.startsWith('{');
            ocrRequests.push({ split, model: split ? JSON.parse(body).model : body?.match(/name="model"\r\n\r\n([^\r\n]+)/)?.[1] });
            if (body?.startsWith('{')) return queueResult(route, { json: { content: JSON.stringify({ topic, original, essay, continuation: essay }) } });
            return queueResult(route, { json: { text: body?.includes('filename="作文.png"') ? essay : topic } });
        }
        return route.continue();
    });
    const visible = id => page.locator(`#${id}`).isVisible();
    const capture = async name => {
        if (!process.env.UI_SCREENSHOT_DIR) return;
        await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true });
        await page.locator('.card').evaluateAll(cards => Promise.all(cards.flatMap(card => card.getAnimations()).map(animation => animation.finished.catch(() => {}))));
        await page.locator('.success-toast, .error-toast').waitFor({ state: 'hidden' });
        if (name.includes('mobile')) await page.locator('.essay-section:not(.hidden) .composer-card').evaluate(card => card.scrollIntoView({ block: 'start', behavior: 'instant' }));
        await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, name), fullPage: !name.includes('mobile') });
        if (name === 'desktop-dark-report.png') {
            await page.locator('#continuationGradingResult').evaluate(panel => panel.scrollIntoView({ block: 'start', behavior: 'instant' }));
            await page.screenshot({ path: join(process.env.UI_SCREENSHOT_DIR, 'desktop-dark-report-viewport.png') });
        }
    };
    const noHorizontalOverflow = async label => {
        const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
        check(`${label}没有横向溢出`, size.page <= size.viewport + 1);
    };
    await page.goto(origin);
    await page.locator('#gradingTopicHelp').waitFor();
    check('页面无卡密、购买或额度入口', await page.locator('#cardPanelBtn, #cardModal').count() === 0 && !/次数卡|卡密|闲鱼|免费额度/.test(await page.locator('body').innerText()));
    await capture('desktop-editing.png');
    await page.locator('.workspace-splitter').first().focus();
    await page.keyboard.press('ArrowRight');
    check('列宽支持键盘调整', await page.locator('.workspace-splitter').first().getAttribute('aria-valuenow') === '36');
    await page.locator('#continuationBtn').click();
    await page.locator('#continuationGradingTopic').fill('测试');
    await page.locator('#continuationGradingOriginal').fill('测试');
    check('测试输入不能发出AI请求', await page.locator('#getContinuationGuidanceBtn').isDisabled() && calls === 0);
    check('无效输入在字段旁解释原因', (await page.locator('#continuationGradingTopicHelp').innerText()).includes('占位文字'));
    await page.locator('[data-input-mode="paste"]').click();
    check('粘贴模式隐藏上传区', !(await page.locator('#continuationSection .asset-card').isVisible()));
    await page.locator('#continuationGradingTopic').fill('续写故事，第一段以 Anna entered the room. 开头；第二段以 The dog finally found a home. 开头。');
    await page.locator('#continuationGradingOriginal').fill(original);
    responseMode = 'wait';
    await page.locator('#getContinuationGuidanceBtn').click();
    await page.locator('#continuationGradingProgress').waitFor({ state: 'visible' });
    check('加载时只显示进度', !(await visible('continuationGradingInput')) && !(await visible('continuationGuidanceResult')));
    check('生成时禁止重复提交及输入方式切换', await page.locator('[data-input-mode="paste"]').isDisabled());
    await page.waitForFunction(() => document.querySelector('#continuationGradingProgress').getAttribute('role') === 'status');
    while (!releaseResponse) await new Promise(done => setTimeout(done, 10));
    responseMode = 'ok'; releaseResponse();
    await page.locator('#continuationGuidanceResult').waitFor({ state: 'visible' });
    check('思路结果显示时输入区保持隐藏', !(await visible('continuationGradingInput')) && !(await visible('continuationGradingProgress')));
    check('请求携带本次输入供服务端校验', lastRequest.composition.type === 'continuation' && lastRequest.composition.original === original);
    const bounds = await page.evaluate(() => {
        const toolbar = document.querySelector('#continuationGuidanceResult .result-toolbar').getBoundingClientRect();
        const content = document.querySelector('#continuationGuidanceContent').getBoundingClientRect();
        return { toolbarBottom: toolbar.bottom, contentTop: content.top, overflow: getComputedStyle(document.querySelector('#continuationGuidanceContent')).overflowY };
    });
    check('长报告不重叠且随页面滚动', bounds.toolbarBottom <= bounds.contentTop && bounds.overflow === 'visible');
    for (const width of [1440, 1100, 768, 720, 390, 360]) {
        await page.setViewportSize({ width, height: 900 });
        await noHorizontalOverflow(`${width}px 思路报告`);
        const layout = await page.locator('#continuationGuidanceResult').evaluate(panel => {
            const heading = panel.querySelector('.result-toolbar h4').getBoundingClientRect();
            const tools = panel.querySelector('.result-toolbar .btn-row').getBoundingClientRect();
            return heading.right <= tools.left + 1 || heading.bottom <= tools.top + 1;
        });
        check(`${width}px 标题与工具栏不重叠`, layout);
    }
    await page.locator('#themeToggleBtn').click();
    const darkTheme = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--bg').trim());
    check('深色模式同时使用深色页面背景', darkTheme === '#111b27');
    await capture('mobile-dark-guidance.png');
    await page.locator('#newContinuationGuidanceBtn').click();
    check('返回编辑保留题目与原文', await page.locator('#continuationGradingOriginal').inputValue() === original && !(await visible('continuationGuidanceResult')));
    await page.locator('#continuationGradingContent').fill('Thank you for your help.');
    check('真实短作文提示但允许提交', !(await page.locator('#startContinuationGradingBtn').isDisabled()) && (await page.locator('#continuationGradingContentHelp').innerText()).includes('可以继续批改'));
    await page.locator('#startContinuationGradingBtn').click();
    await page.locator('#continuationGradingResult').waitFor({ state: 'visible' });
    check('批改结果与思路互斥', !(await visible('continuationGuidanceResult')) && !(await visible('continuationGradingInput')));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await capture('desktop-dark-report.png');
    await page.locator('#editContinuationGradingBtn').click();
    responseMode = 'invalid';
    const historyBefore = await page.evaluate(() => localStorage.getItem('smart-doc-helper:learning-history:v1'));
    await page.locator('#startContinuationGradingBtn').click();
    await page.locator('#continuationSection .request-error').waitFor({ state: 'visible' });
    check('坏报告显示错误且不显示默认0分', !(await visible('continuationGradingResult')) && await visible('continuationGradingInput'));
    check('坏报告不保存为成功记录', await page.evaluate(() => localStorage.getItem('smart-doc-helper:learning-history:v1')) === historyBefore);
    responseMode = 'error';
    await page.locator('#continuationSection .request-error button').click();
    await page.getByText(/模拟服务暂时不可用/).waitFor();
    check('失败保留输入并允许重试', await page.locator('#continuationGradingContent').inputValue() === 'Thank you for your help.');
    responseMode = 'ok';
    await page.locator('#continuationSection .request-error button').click();
    await page.locator('#continuationGradingResult').waitFor({ state: 'visible' });
    check('重试成功恢复互斥结果状态', !(await visible('continuationGradingInput')));
    await page.locator('#historyToggleBtn').click();
    await page.locator('.history-version-row').last().getByRole('button', { name: '打开该版本' }).click();
    check('历史思路与新报告互斥', await visible('continuationGuidanceResult') && !(await visible('continuationGradingResult')) && !(await visible('continuationGradingInput')));

    await page.locator('[data-input-mode="upload"]').click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    await page.locator('#continuationFileInput').setInputFiles([
        { name: '题目与原文.png', mimeType: 'image/png', buffer: png },
        { name: '作文.png', mimeType: 'image/png', buffer: png }
    ]);
    await page.locator('#continuationSection .model-settings summary').first().click();
    check('读后续写OCR默认使用Gemini', await page.locator('#continuationOcrModel').inputValue() === 'gemini-4-argon');
    await page.locator('#continuationOcrModel').selectOption('deepseek-v4.1-flash');
    await page.locator('#startContinuationOcrBtn').click();
    await page.waitForFunction(value => document.querySelector('#continuationGradingContent').value === value, essay);
    check('读后续写多标签识别直接填入题目、原文和续写', await page.locator('#continuationGradingTopic').inputValue() === topic && await page.locator('#continuationGradingOriginal').inputValue() === original);
    check('切换DeepSeek后图片识别和多标签分段均使用DeepSeek', ocrRequests.some(request => request.split) && ocrRequests.some(request => !request.split) && ocrRequests.every(request => request.model === 'deepseek-v4.1-flash'));
    ocrRequests.length = 0;

    // 应用文：照片直接进入唯一编辑区，并检查文件名超长的窄屏布局。
    await page.locator('#applicationBtn').click();
    await page.locator('[data-input-mode="upload"]').click();
    await page.locator('#essayFileInput').setInputFiles([
        { name: '题目'.repeat(25) + '.png', mimeType: 'image/png', buffer: png },
        { name: '作文.png', mimeType: 'image/png', buffer: png }
    ]);
    await page.locator('#startOcrBtn').click();
    await page.waitForFunction(value => document.querySelector('#gradingEssay').value === value, essay);
    check('OCR直接填入唯一一套编辑框', await page.locator('#gradingTopic').inputValue() === topic && await page.locator('#essayOcrTopic').count() === 0);
    check('应用文默认图片识别使用Gemini且可选DeepSeek', ocrRequests.length > 0 && ocrRequests.every(request => request.model === 'gemini-4-argon') && await page.locator('#essayOcrModel option[value="deepseek-v4.1-flash"]').count() === 1 && await page.locator('#essayOcrModel').isEnabled());
    await page.locator('#gradingEssay').fill(`${essay} I will bring some snacks.`);
    await page.locator('#startGradingBtn').click();
    await page.locator('#gradingResult').waitFor({ state: 'visible' });
    check('应用文批改使用已修改的识别文字', lastRequest.composition.content.endsWith('I will bring some snacks.'));
    await page.locator('#copyResultBtn').click();
    check('复制完整报告包含分数', (await page.evaluate(() => window.copiedReport)).includes('AI 预估分：12/15'));
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#downloadResultBtn').click();
    const download = await downloadEvent;
    check('报告可下载', download.suggestedFilename().includes('应用文批改报告'));
    await page.locator('#editGradingBtn').click();
    await page.locator('#themeToggleBtn').click();
    for (const width of [1100, 768, 390, 360]) {
        await page.setViewportSize({ width, height: 850 });
        await noHorizontalOverflow(`${width}px 带照片的编辑页`);
    }
    await capture('mobile-editing.png');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.body.style.zoom = '2'; });
    await noHorizontalOverflow('200% 页面放大');
    check('AI任务通过轮询获取且临时查询失败可恢复', statusCalls > calls && calls >= 5);
    check('页面脚本无运行错误', errors.length === 0);
    console.log(`\n浏览器检查：${checks} 项通过。所有模型响应均为本地模拟。`);
} finally {
    await browser?.close();
    await new Promise(done => server.close(done));
}
