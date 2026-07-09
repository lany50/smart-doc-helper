const DEFAULT_BASE_URL = 'https://api.chatst.org';
const ALLOWED_MODELS = new Set(['deepseek-v4-flash', 'tencent/hy3:free', 'gemini-3.5-flash']);
const MAX_TOKENS_LIMIT = 6000;

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

        const completionsUrl = buildChatCompletionsUrl(process.env.API_BASE_URL || process.env.OCR_API_BASE_URL || DEFAULT_BASE_URL);
        const maxTokens = normalizeMaxTokens(body.max_tokens);
        const upstreamResponse = await fetch(completionsUrl, {
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

        const payload = await readJson(upstreamResponse);
        if (!upstreamResponse.ok) {
            return jsonResponse(upstreamResponse.status || 502, {
                error: payload.error?.message || payload.message || 'AI 文本模型调用失败'
            });
        }

        const content = payload.choices?.[0]?.message?.content || '';
        return jsonResponse(200, {
            content,
            model: payload.model || body.model
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
            'Access-Control-Allow-Headers': 'Content-Type'
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
