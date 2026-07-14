// 后台管理接口：生成/查询/停用卡密、查看用量统计
// 鉴权：请求头 Authorization: Bearer <ADMIN_SECRET>
const {
    connectBlobs,
    getCardsStore,
    getStatsStore,
    generateCode,
    normalizeCode,
    dayKey
} = require('./shared/card-store.js');

const MAX_CREATE_COUNT = 200;
const CARD_TYPES = new Set(['paid', 'class', 'student', 'admin']);

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }
    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: '只支持 POST 请求' });
    }

    const secret = process.env.ADMIN_SECRET;
    if (!secret) {
        return jsonResponse(500, { error: '服务端未配置 ADMIN_SECRET' });
    }
    const auth = event.headers.authorization || event.headers.Authorization || '';
    if (auth !== `Bearer ${secret}`) {
        return jsonResponse(401, { error: '管理密码错误' });
    }

    try {
        connectBlobs(event);
        const body = parseBody(event.body);
        switch (body.action) {
            case 'create': return await createCards(body);
            case 'list': return await listCards();
            case 'update': return await updateCard(body);
            case 'delete': return await deleteCard(body);
            case 'stats': return await getStats(body);
            default:
                return jsonResponse(400, { error: `不支持的操作: ${body.action || '(空)'}` });
        }
    } catch (error) {
        return jsonResponse(error.statusCode || 500, { error: error.message || '管理操作失败' });
    }
};

async function createCards(body) {
    const count = Math.floor(Number(body.count || 1));
    if (!Number.isFinite(count) || count < 1 || count > MAX_CREATE_COUNT) {
        return jsonResponse(400, { error: `count 必须是 1-${MAX_CREATE_COUNT} 的整数` });
    }
    const unlimited = !!body.unlimited;
    const credits = unlimited ? null : Math.floor(Number(body.credits || 0));
    if (!unlimited && (!Number.isFinite(credits) || credits < 1 || credits > 100000)) {
        return jsonResponse(400, { error: 'credits 必须是 1-100000 的整数（或设置 unlimited）' });
    }
    const type = CARD_TYPES.has(body.type) ? body.type : 'paid';
    const note = String(body.note || '').slice(0, 100);

    const store = await getCardsStore();
    const cards = [];
    for (let i = 0; i < count; i++) {
        let code = generateCode();
        // 碰撞极小概率，仍防一手
        while (await store.get(code, { type: 'json' })) {
            code = generateCode();
        }
        const card = {
            code,
            unlimited,
            credits,
            remaining: unlimited ? null : credits,
            type,
            note,
            disabled: false,
            usedCount: 0,
            createdAt: new Date().toISOString(),
            lastUsedAt: null
        };
        await store.setJSON(code, card);
        cards.push(card);
    }
    return jsonResponse(200, { ok: true, cards });
}

async function listCards() {
    const store = await getCardsStore();
    const { blobs } = await store.list();
    const cards = [];
    const keys = (blobs || []).map((b) => b.key);
    const BATCH = 20;
    for (let i = 0; i < keys.length; i += BATCH) {
        const batch = await Promise.all(
            keys.slice(i, i + BATCH).map((key) => store.get(key, { type: 'json' }))
        );
        for (const card of batch) {
            if (card) cards.push(card);
        }
    }
    cards.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return jsonResponse(200, { ok: true, total: cards.length, cards });
}

async function updateCard(body) {
    const code = normalizeCode(body.code);
    if (!code) return jsonResponse(400, { error: '卡密格式不正确' });
    const store = await getCardsStore();
    const card = await store.get(code, { type: 'json' });
    if (!card) return jsonResponse(404, { error: '卡密不存在' });

    if (typeof body.disabled === 'boolean') card.disabled = body.disabled;
    if (typeof body.note === 'string') card.note = body.note.slice(0, 100);
    if (body.addCredits != null && !card.unlimited) {
        const add = Math.floor(Number(body.addCredits));
        if (!Number.isFinite(add) || add === 0 || Math.abs(add) > 100000) {
            return jsonResponse(400, { error: 'addCredits 必须是非零整数' });
        }
        card.credits = Math.max(0, (card.credits || 0) + add);
        card.remaining = Math.max(0, (card.remaining || 0) + add);
    }
    await store.setJSON(code, card);
    return jsonResponse(200, { ok: true, card });
}

async function deleteCard(body) {
    const code = normalizeCode(body.code);
    if (!code) return jsonResponse(400, { error: '卡密格式不正确' });
    const store = await getCardsStore();
    await store.delete(code);
    return jsonResponse(200, { ok: true });
}

async function getStats(body) {
    const days = Math.min(Math.max(Math.floor(Number(body.days || 14)), 1), 60);
    const store = await getStatsStore();
    const result = [];
    for (let i = 0; i < days; i++) {
        const day = dayKey(-i);
        const record = (await store.get(`day:${day}`, { type: 'json' })) || {};
        result.push({ day, ...record });
    }
    return jsonResponse(200, { ok: true, days: result });
}

function parseBody(body) {
    try {
        return JSON.parse(body || '{}');
    } catch {
        const error = new Error('请求内容不是有效 JSON');
        error.statusCode = 400;
        throw error;
    }
}

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        body: statusCode === 204 ? '' : JSON.stringify(body)
    };
}
