// 本地逻辑测试：不连 Netlify、不连真实模型，验证卡密/免费额度/退款全流程
// 运行：node tools/local-test.mjs
import { createRequire } from 'module';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const storeDir = mkdtempSync(join(tmpdir(), 'card-store-test-'));
process.env.CARD_STORE_LOCAL_DIR = storeDir;
process.env.ADMIN_SECRET = 'test-secret';
process.env.API_KEY = 'fake-key';
process.env.FREE_OCR_PER_DAY = '2';

const require = createRequire(import.meta.url);
const chatCompletion = require('../netlify/functions/chat-completion.js');
const visionOcr = require('../netlify/functions/vision-ocr.js');
const cardRedeem = require('../netlify/functions/card-redeem.js');
const adminCards = require('../netlify/functions/admin-cards.js');

// 假上游：默认成功返回固定内容，可切换为失败
let upstreamShouldFail = false;
globalThis.fetch = async () => {
    if (upstreamShouldFail) {
        return { ok: false, status: 500, text: async () => JSON.stringify({ error: { message: '假上游故障' } }) };
    }
    return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ model: 'fake-model', choices: [{ message: { content: '这是假的批改结果' } }] })
    };
};

let passed = 0;
let failed = 0;
function check(name, cond, extra) {
    if (cond) { passed++; console.log(`  ✅ ${name}`); }
    else { failed++; console.log(`  ❌ ${name}${extra ? ' — ' + JSON.stringify(extra) : ''}`); }
}

function event({ body, headers = {}, ip = '1.2.3.4', method = 'POST' }) {
    return {
        httpMethod: method,
        headers: { 'x-nf-client-connection-ip': ip, 'content-type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body || {})
    };
}

async function callAdmin(payload) {
    const res = await adminCards.handler(event({ body: payload, headers: { authorization: 'Bearer test-secret' } }));
    return { status: res.statusCode, data: JSON.parse(res.body || '{}') };
}

async function callChat(payload, { ip = '1.2.3.4', card } = {}) {
    const headers = card ? { 'x-card-code': card } : {};
    const res = await chatCompletion.handler(event({
        body: { model: 'deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }], ...payload },
        headers, ip
    }));
    return { status: res.statusCode, data: JSON.parse(res.body || '{}') };
}

async function callRedeem(code, ip = '1.2.3.4') {
    const res = await cardRedeem.handler(event({ body: { code }, ip }));
    return { status: res.statusCode, data: JSON.parse(res.body || '{}') };
}

console.log('\n== 1. 管理端：鉴权与建卡 ==');
{
    const bad = await adminCards.handler(event({ body: { action: 'list' }, headers: { authorization: 'Bearer wrong' } }));
    check('错误管理密码被拒绝(401)', bad.statusCode === 401);

    const { status, data } = await callAdmin({ action: 'create', count: 2, credits: 3, type: 'paid', note: '闲鱼3次卡' });
    check('建卡成功', status === 200 && data.cards?.length === 2, data);
    check('卡密格式 XXXX-XXXX-XXXX', /^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(data.cards?.[0]?.code || ''), data.cards?.[0]?.code);
    globalThis.paidCard = data.cards[0].code;

    const unlimited = await callAdmin({ action: 'create', count: 1, unlimited: true, type: 'class', note: '高三1班' });
    check('不限次班级卡建卡成功', unlimited.status === 200 && unlimited.data.cards?.[0]?.unlimited === true);
    globalThis.classCard = unlimited.data.cards[0].code;
}

console.log('\n== 2. 卡密兑换查询 ==');
{
    const ok = await callRedeem(globalThis.paidCard);
    check('有效卡查询 ok，余额3', ok.status === 200 && ok.data.ok && ok.data.card.remaining === 3, ok.data);
    const lower = await callRedeem(globalThis.paidCard.toLowerCase().replace(/-/g, ' '));
    check('小写+空格分隔也能识别', lower.status === 200 && lower.data.ok, lower.data);
    const missing = await callRedeem('AAAA-BBBB-CCCC');
    check('不存在的卡返回404', missing.status === 404 && missing.data.code === 'CARD_INVALID');

    await callAdmin({ action: 'update', code: globalThis.paidCard, disabled: true });
    const disabled = await callRedeem(globalThis.paidCard);
    check('停用卡兑换返回 ok:false', disabled.status === 200 && disabled.data.ok === false && disabled.data.code === 'CARD_DISABLED', disabled.data);
    await callAdmin({ action: 'update', code: globalThis.paidCard, disabled: false });
}

console.log('\n== 3. 批改计费：卡扣次 ==');
{
    const g1 = await callChat({ purpose: 'grade' }, { card: globalThis.paidCard });
    check('第1次批改成功，余额2', g1.status === 200 && g1.data.billing?.remaining === 2, g1.data);
    await callChat({ purpose: 'guidance' }, { card: globalThis.paidCard });
    const g3 = await callChat({ purpose: 'grade' }, { card: globalThis.paidCard });
    check('第3次批改成功，余额0', g3.status === 200 && g3.data.billing?.remaining === 0, g3.data);
    const g4 = await callChat({ purpose: 'grade' }, { card: globalThis.paidCard });
    check('次数用完返回402 CARD_EMPTY', g4.status === 402 && g4.data.code === 'CARD_EMPTY', g4.data);

    const c1 = await callChat({ purpose: 'grade' }, { card: globalThis.classCard });
    check('班级不限次卡可用', c1.status === 200 && c1.data.billing?.unlimited === true, c1.data);
}

console.log('\n== 4. 免费额度：每IP每天2次 ==');
{
    const ip = '9.9.9.9';
    const f1 = await callChat({ purpose: 'grade' }, { ip });
    check('免费第1次成功 (1/2)', f1.status === 200 && f1.data.billing?.used === 1, f1.data);
    const f2 = await callChat({ purpose: 'grade' }, { ip });
    check('免费第2次成功 (2/2)', f2.status === 200 && f2.data.billing?.used === 2, f2.data);
    const f3 = await callChat({ purpose: 'grade' }, { ip });
    check('免费第3次被拦 402 FREE_LIMIT', f3.status === 402 && f3.data.code === 'FREE_LIMIT', f3.data);
    const other = await callChat({ purpose: 'grade' }, { ip: '8.8.8.8' });
    check('其他 IP 不受影响', other.status === 200, other.data);
    const splitPrompt = '你是一个高考英语作文 OCR 文本整理助手。请拆分以下内容……';
    const split = await callChat({ purpose: 'split', messages: [{ role: 'user', content: splitPrompt }] }, { ip });
    check('split 不占批改额度', split.status === 200 && split.data.billing === null, split.data);
    // 伪装 split（提示词前缀不符）应按批改计费；该 IP 免费额度已用完 → 402
    const fakeSplit = await callChat({ purpose: 'split' }, { ip });
    check('伪装 split 按批改计费被拦 402', fakeSplit.status === 402 && fakeSplit.data.code === 'FREE_LIMIT', fakeSplit.data);
}

console.log('\n== 5. 上游失败自动退款 ==');
{
    const { data } = await callAdmin({ action: 'create', count: 1, credits: 2, note: '退款测试' });
    const code = data.cards[0].code;
    upstreamShouldFail = true;
    const bad = await callChat({ purpose: 'grade' }, { card: code });
    upstreamShouldFail = false;
    check('上游失败时返回错误', bad.status >= 500, bad);
    const after = await callRedeem(code, '7.7.7.7');
    check('失败后余额退回2', after.data.card?.remaining === 2, after.data);

    const ip = '6.6.6.6';
    upstreamShouldFail = true;
    await callChat({ purpose: 'grade' }, { ip });
    upstreamShouldFail = false;
    const retry = await callChat({ purpose: 'grade' }, { ip });
    check('免费额度失败后退回（重试仍是1/2）', retry.status === 200 && retry.data.billing?.used === 1, retry.data);
}

console.log('\n== 6. 停用/删除/加次数 ==');
{
    const upd = await callAdmin({ action: 'update', code: globalThis.classCard, disabled: true });
    check('停用成功', upd.status === 200 && upd.data.card.disabled === true);
    const use = await callChat({ purpose: 'grade' }, { card: globalThis.classCard });
    check('停用卡被拒 402 CARD_DISABLED', use.status === 402 && use.data.code === 'CARD_DISABLED', use.data);
    await callAdmin({ action: 'update', code: globalThis.classCard, disabled: false });

    const add = await callAdmin({ action: 'update', code: globalThis.paidCard, addCredits: 10 });
    check('补充次数：余额10', add.status === 200 && add.data.card.remaining === 10, add.data);

    const list = await callAdmin({ action: 'list' });
    check('列表返回全部卡', list.status === 200 && list.data.total >= 4, list.data.total);
    const stats = await callAdmin({ action: 'stats', days: 3 });
    check('统计接口正常', stats.status === 200 && stats.data.days.length === 3, stats.data);
}

console.log('\n== 7. OCR 限频（本测试 FREE_OCR_PER_DAY=2） ==');
{
    const ip = '5.5.5.5';
    const mk = () => visionOcr.handler(event({
        body: { action: 'split_ocr_text', rawText: 'hello world', roles: ['topic', 'essay'] },
        ip
    }));
    const o1 = await mk();
    const o2 = await mk();
    const o3 = await mk();
    check('前2次OCR成功', o1.statusCode === 200 && o2.statusCode === 200, [o1.statusCode, o2.statusCode]);
    check('第3次被限频 429', o3.statusCode === 429, o3.statusCode);

    const withCard = await visionOcr.handler(event({
        body: { action: 'split_ocr_text', rawText: 'hello', roles: ['topic'] },
        ip,
        headers: { 'x-card-code': globalThis.paidCard }
    }));
    check('有卡用户OCR不限频', withCard.statusCode === 200, withCard.statusCode);
}

console.log(`\n结果：${passed} 通过，${failed} 失败`);
rmSync(storeDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
