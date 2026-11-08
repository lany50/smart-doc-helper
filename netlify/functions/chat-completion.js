const DEFAULT_BASE_URL = 'https://api.chatst.org';
const ALLOWED_MODELS = new Set(['deepseek-v4.1-flash']);
const MAX_TOKENS_LIMIT = 12000;
const { validateInput, parseGrade } = require('../../composition-validation.js');
const { wantsAsync, startJob, jsonResponse } = require('./shared/ai-jobs');
const { requestModel } = require('./shared/model-request');

exports.handler = async event => {
    if (event.httpMethod !== 'POST') return jsonResponse(405, { error: '只支持 POST 请求' });
    try {
        const apiKey = process.env.API_KEY || process.env.OCR_API_KEY;
        if (!apiKey) return jsonResponse(500, { error: '未配置 API_KEY' });
        const body = parseBody(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
        validateCompletionRequest(body);
        const purpose = ['grade', 'guidance', 'split'].includes(body.purpose) ? body.purpose : 'grade';
        if (purpose !== 'split') {
            if (!['application', 'continuation'].includes(body.composition?.type)) {
                return jsonResponse(400, { error: '请填写题目和作文后重试', code: 'INVALID_COMPOSITION' });
            }
            const validation = validateInput(body.composition, body.composition.type, purpose);
            if (!validation.valid) return jsonResponse(400, { error: Object.values(validation.errors)[0], fields: validation.errors, code: 'INVALID_COMPOSITION' });
        }
        if (wantsAsync(event)) return await startJob(event, 'text');
        const payload = await requestModel(buildChatCompletionsUrl(process.env.API_BASE_URL || process.env.OCR_API_BASE_URL || DEFAULT_BASE_URL), {
            apiKey, timeoutMs: event.aiBackground ? 180000 : 25000,
            body: { model: body.model, thinking: { type: 'disabled' }, messages: body.messages, max_tokens: normalizeMaxTokens(body.max_tokens), temperature: typeof body.temperature === 'number' ? body.temperature : 0.7 }
        });
        const content = payload.choices?.[0]?.message?.content;
        const finishReason = payload.choices?.[0]?.finish_reason;
        if (typeof content !== 'string' || !content.trim() || finishReason === 'length') {
            return jsonResponse(502, { error: finishReason === 'length' ? 'AI 结果未完整生成，请重试' : 'AI 未返回有效内容，请重试', code: 'MODEL_INCOMPLETE_RESPONSE' });
        }
        if (purpose === 'grade') {
            try { parseGrade(content, body.composition.type); }
            catch { return jsonResponse(502, { error: '报告解析失败，输入内容已保留，请重试', code: 'MODEL_INVALID_REPORT' }); }
        }
        return jsonResponse(200, { content, model: payload.model || body.model });
    } catch (error) {
        return jsonResponse(error.statusCode || 500, { error: error.message || 'AI 文本模型调用失败', ...(error.code ? { code: error.code } : {}) });
    }
};

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
    const tokens = Number(value || MAX_TOKENS_LIMIT);
    if (!Number.isFinite(tokens) || tokens <= 0) return MAX_TOKENS_LIMIT;
    return Math.min(Math.floor(tokens), MAX_TOKENS_LIMIT);
}

function buildChatCompletionsUrl(baseURL) {
    const normalized = String(baseURL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(normalized)) return normalized;
    if (/\/v\d+$/i.test(normalized)) return `${normalized}/chat/completions`;
    return `${normalized}/v1/chat/completions`;
}

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
