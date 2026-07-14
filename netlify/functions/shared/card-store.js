// 卡密与用量存储（Netlify Blobs；本地测试时用文件存储回退）
const crypto = require('crypto');

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 去掉易混淆的 0/O/1/I/L
const CODE_GROUPS = 3;
const CODE_GROUP_LEN = 4;

async function getBlobStore(name) {
    if (process.env.CARD_STORE_LOCAL_DIR) {
        return createLocalStore(name);
    }
    // 静态 require（@netlify/blobs 提供 CJS 构建），保证被函数打包器跟踪收录
    const { getStore } = require('@netlify/blobs');
    const options = { name, consistency: 'strong' };
    // 兜底：自动注入失效时可在 Netlify 环境变量手动配 NETLIFY_BLOBS_SITE_ID + NETLIFY_BLOBS_TOKEN
    if (process.env.NETLIFY_BLOBS_TOKEN) {
        options.siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.SITE_ID || '';
        options.token = process.env.NETLIFY_BLOBS_TOKEN;
    }
    return getStore(options);
}

// 旧式（v1）函数运行时不会自动注入 Blobs 连接信息，
// 每个函数入口必须先用 event 里的上下文接线，否则 getStore 会报
// "The environment has not been configured to use Netlify Blobs"
function connectBlobs(event) {
    if (process.env.CARD_STORE_LOCAL_DIR) return;
    if (!event || !event.blobs) return;
    const { connectLambda } = require('@netlify/blobs');
    connectLambda(event);
}

function createLocalStore(name) {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.env.CARD_STORE_LOCAL_DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    const fileOf = (key) => path.join(dir, encodeURIComponent(key) + '.json');
    return {
        async get(key, opts) {
            try {
                const text = fs.readFileSync(fileOf(key), 'utf8');
                return opts && opts.type === 'json' ? JSON.parse(text) : text;
            } catch {
                return null;
            }
        },
        async setJSON(key, value) {
            fs.writeFileSync(fileOf(key), JSON.stringify(value));
        },
        async delete(key) {
            try { fs.unlinkSync(fileOf(key)); } catch {}
        },
        async list(opts = {}) {
            const prefix = opts.prefix || '';
            const keys = fs.readdirSync(dir)
                .filter((f) => f.endsWith('.json'))
                .map((f) => decodeURIComponent(f.slice(0, -5)))
                .filter((k) => k.startsWith(prefix));
            return { blobs: keys.map((key) => ({ key })) };
        }
    };
}

function getCardsStore() { return getBlobStore('cards'); }
function getUsageStore() { return getBlobStore('usage'); }
function getStatsStore() { return getBlobStore('stats'); }

// 北京时间的日期键，如 2026-07-14
function dayKey(offsetDays = 0) {
    const ms = Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000;
    return new Date(ms).toISOString().slice(0, 10);
}

function ipHashOf(event) {
    const headers = event.headers || {};
    const ip = headers['x-nf-client-connection-ip']
        || headers['x-forwarded-for']?.split(',')[0].trim()
        || headers['client-ip']
        || 'unknown';
    return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
}

// 归一化卡密：去掉分隔符、转大写，再按 4 位分组
function normalizeCode(raw) {
    const cleaned = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (cleaned.length !== CODE_GROUPS * CODE_GROUP_LEN) return null;
    const groups = [];
    for (let i = 0; i < cleaned.length; i += CODE_GROUP_LEN) {
        groups.push(cleaned.slice(i, i + CODE_GROUP_LEN));
    }
    return groups.join('-');
}

function generateCode() {
    const bytes = crypto.randomBytes(CODE_GROUPS * CODE_GROUP_LEN);
    let chars = '';
    for (let i = 0; i < CODE_GROUPS * CODE_GROUP_LEN; i++) {
        chars += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    return normalizeCode(chars);
}

async function getCard(store, code) {
    const normalized = normalizeCode(code);
    if (!normalized) return null;
    const card = await store.get(normalized, { type: 'json' });
    return card ? { ...card, code: normalized } : null;
}

// 校验卡是否可用（不扣次）。返回 {ok} 或 {ok:false, reason}
function checkCard(card) {
    if (!card) return { ok: false, reason: 'CARD_INVALID', message: '卡密不存在或输入有误' };
    if (card.disabled) return { ok: false, reason: 'CARD_DISABLED', message: '该卡密已被停用' };
    if (!card.unlimited && (card.remaining || 0) <= 0) {
        return { ok: false, reason: 'CARD_EMPTY', message: '该卡密次数已用完' };
    }
    return { ok: true };
}

// 扣 1 次。成功返回更新后的卡记录，失败返回 {error}
async function consumeCredit(store, code) {
    const card = await getCard(store, code);
    const check = checkCard(card);
    if (!check.ok) return { error: check };
    card.usedCount = (card.usedCount || 0) + 1;
    card.lastUsedAt = new Date().toISOString();
    if (!card.unlimited) card.remaining -= 1;
    await store.setJSON(card.code, card);
    return { card };
}

// 退回 1 次（上游模型调用失败时补偿）
async function refundCredit(store, code) {
    try {
        const card = await getCard(store, code);
        if (!card) return;
        card.usedCount = Math.max(0, (card.usedCount || 0) - 1);
        if (!card.unlimited) card.remaining += 1;
        await store.setJSON(card.code, card);
    } catch {}
}

// 按 IP+日期做计数限额。返回 {allowed, used, limit}
async function takeQuota(usageStore, bucket, ipHash, limit) {
    const key = `${bucket}:${dayKey()}:${ipHash}`;
    const record = (await usageStore.get(key, { type: 'json' })) || { count: 0 };
    if (record.count >= limit) {
        return { allowed: false, used: record.count, limit, key };
    }
    record.count += 1;
    await usageStore.setJSON(key, record);
    return { allowed: true, used: record.count, limit, key };
}

async function refundQuota(usageStore, key) {
    try {
        const record = await usageStore.get(key, { type: 'json' });
        if (record && record.count > 0) {
            record.count -= 1;
            await usageStore.setJSON(key, record);
        }
    } catch {}
}

// 每日统计，尽力而为，出错不影响主流程
async function bumpStat(field) {
    try {
        const store = await getStatsStore();
        const key = `day:${dayKey()}`;
        const record = (await store.get(key, { type: 'json' })) || {};
        record[field] = (record[field] || 0) + 1;
        await store.setJSON(key, record);
    } catch {}
}

function cardPublicView(card) {
    return {
        code: card.code,
        unlimited: !!card.unlimited,
        credits: card.unlimited ? null : card.credits,
        remaining: card.unlimited ? null : card.remaining,
        type: card.type || 'paid',
        note: card.note || '',
        disabled: !!card.disabled
    };
}

module.exports = {
    connectBlobs,
    getCardsStore,
    getUsageStore,
    getStatsStore,
    dayKey,
    ipHashOf,
    normalizeCode,
    generateCode,
    getCard,
    checkCard,
    consumeCredit,
    refundCredit,
    takeQuota,
    refundQuota,
    bumpStat,
    cardPublicView
};
