const DEFAULT_BASE_URL = 'https://api.chatst.org';
const ALLOWED_MODELS = new Set(['deepseek-v4-flash', 'tencent/hy3:free', 'gemini-3.5-flash']);
const MAX_TOKENS_LIMIT = 6000;

const {
    getCardsStore,
    getUsageStore,
    getCard,
    checkCard,
    consumeCredit,
    refundCredit,
    takeQuota,
    refundQuota,
    ipHashOf,
    bumpStat
} = require('./shared/card-store.js');

// 计费口径：grade/guidance 每次扣 1 次数（或占用每日免费额度）；split 是 OCR 辅助拆分，免费但限频
const BILLED_PURPOSES = new Set(['grade', 'guidance']);
const FREE_GRADES_PER_DAY = Number(process.env.FREE_GRADES_PER_DAY || 2);
const FREE_SPLITS_PER_DAY = Number(process.env.FREE_SPLITS_PER_DAY || 30);

// purpose 是客户端自报的：只有真正的 OCR 拆分提示词才享受 split 免费通道，
// 伪装成 split 的任意请求一律按 grade 计费
const SPLIT_PROMPT_PREFIXES = [
    '你是一个高考英语作文 OCR 文本整理助手',
    '你是一个高考英语读后续写 OCR 文本整理助手'
];

function isRealSplitRequest(body) {
    if (!Array.isArray(body.messages) || body.messages.length !== 1) return false;
    const content = body.messages[0]?.content;
    if (typeof content !== 'string') return false;
    return SPLIT_PROMPT_PREFIXES.some((prefix) => content.startsWith(prefix));
}

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }

    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: '只支持 POST 请求' });
    }

    try {
        const apiKey = process.env.API_KEY || process.env.OCR_API_KEY;
        if (!apiKey) {
            return jsonResponse(500, { error: '未配置 API_KEY' });
        }

        const body = parseBody(event.body);
        validateCompletionRequest(body);

        // ---- 计费/限额 ----
        const purpose = BILLED_PURPOSES.has(body.purpose)
            ? body.purpose
            : (body.purpose === 'split' && isRealSplitRequest(body) ? 'split' : 'grade');
        const cardCode = String(event.headers['x-card-code'] || event.headers['X-Card-Code'] || body.cardCode || '').trim();
        const cardsStore = await getCardsStore();
        const usageStore = await getUsageStore();
        const ipHash = ipHashOf(event);

        let billing = null;
        let rollback = null;

        if (purpose === 'split') {
            // 拆分不扣次；持有效卡不限频，无卡按 IP 限频
            const card = cardCode ? await getCard(cardsStore, cardCode) : null;
            if (!card || !checkCard(card).ok) {
                const quota = await takeQuota(usageStore, 'split', ipHash, FREE_SPLITS_PER_DAY);
                if (!quota.allowed) {
                    return jsonResponse(429, { error: '今日免费整理次数已用完，输入次数卡后不限次', code: 'FREE_LIMIT' });
                }
                rollback = () => refundQuota(usageStore, quota.key);
            }
        } else if (cardCode) {
            const result = await consumeCredit(cardsStore, cardCode);
            if (result.error) {
                return jsonResponse(402, { error: result.error.message, code: result.error.reason });
            }
            billing = {
                mode: 'card',
                unlimited: !!result.card.unlimited,
                remaining: result.card.unlimited ? null : result.card.remaining
            };
            rollback = () => refundCredit(cardsStore, cardCode);
        } else {
            const quota = await takeQuota(usageStore, 'free-grade', ipHash, FREE_GRADES_PER_DAY);
            if (!quota.allowed) {
                return jsonResponse(402, {
                    error: `今日 ${FREE_GRADES_PER_DAY} 次免费批改已用完。可在闲鱼购买次数卡，兑换后继续使用～`,
                    code: 'FREE_LIMIT'
                });
            }
            billing = { mode: 'free', used: quota.used, limit: quota.limit };
            rollback = () => refundQuota(usageStore, quota.key);
        }
        // ---- 计费/限额结束 ----

        const completionsUrl = buildChatCompletionsUrl(process.env.API_BASE_URL || process.env.OCR_API_BASE_URL || DEFAULT_BASE_URL);
        const maxTokens = normalizeMaxTokens(body.max_tokens);
        let upstreamResponse;
        let payload;
        try {
            upstreamResponse = await fetch(completionsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: body.model,
                    messages: body.messages,
                    max_tokens: maxTokens,
                    temperature: typeof body.temperature === 'number' ? body.temperature : 0.7
                })
            });
            payload = await readJson(upstreamResponse);
        } catch (upstreamError) {
            if (rollback) await rollback();
            throw upstreamError;
        }
        if (!upstreamResponse.ok) {
            if (rollback) await rollback();
            return jsonResponse(upstreamResponse.status || 502, {
                error: payload.error?.message || payload.message || 'AI 文本模型调用失败'
            });
        }

        if (purpose !== 'split') {
            await bumpStat(billing && billing.mode === 'card' ? `card-${purpose}` : `free-${purpose}`);
        }

        const content = payload.choices?.[0]?.message?.content || '';
        return jsonResponse(200, {
            content,
            model: payload.model || body.model,
            billing
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return jsonResponse(statusCode, {
            error: error.message || 'AI 文本模型代理失败'
        });
    }
};

function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Card-Code'
        },
        body: statusCode === 204 ? '' : JSON.stringify(body)
    };
}

function parseBody(body) {
    try {
        return JSON.parse(body || '{}');
    } catch {
        throw httpError(400, '请求内容不是有效 JSON');
    }
}

function validateCompletionRequest(body) {
    if (!ALLOWED_MODELS.has(body.model)) {
        throw httpError(400, '不支持的文本模型');
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
        throw httpError(400, 'messages 不能为空');
    }

    body.messages.forEach((message) => {
        if (!['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
            throw httpError(400, 'messages 格式不正确');
        }
    });
}

function normalizeMaxTokens(value) {
    const tokens = Number(value || 3000);
    if (!Number.isFinite(tokens) || tokens <= 0) return 3000;
    return Math.min(Math.floor(tokens), MAX_TOKENS_LIMIT);
}

function buildChatCompletionsUrl(baseURL) {
    const normalized = String(baseURL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(normalized)) return normalized;
    if (/\/v\d+$/i.test(normalized)) return `${normalized}/chat/completions`;
    return `${normalized}/v1/chat/completions`;
}

async function readJson(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw httpError(response.status || 502, text || 'AI 文本模型返回了非 JSON 响应');
    }
}

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
