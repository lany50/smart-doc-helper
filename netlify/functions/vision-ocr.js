const DEFAULT_BASE_URL = 'https://api.chatst.org';
const DEFAULT_OCR_MODEL = 'gemini-3.5-flash';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_OUTPUT_TOKENS = 6000;
const ROLE_LABELS = {
    topic: '题目',
    essay: '作文',
    original: '原文',
    continuation: '续写'
};

const {
    getCardsStore,
    getUsageStore,
    getCard,
    checkCard,
    takeQuota,
    refundQuota,
    ipHashOf,
    bumpStat
} = require('./shared/card-store.js');

// OCR 不扣次数卡余额，但无卡用户按 IP 限频，防止 API 额度被刷
const FREE_OCR_PER_DAY = Number(process.env.FREE_OCR_PER_DAY || 15);

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }

    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: '只支持 POST 上传文件' });
    }

    let rollbackQuota = null;

    try {
        const apiKey = process.env.OCR_API_KEY || process.env.API_KEY;
        if (!apiKey) {
            return jsonResponse(500, { error: '未配置 OCR_API_KEY 或 API_KEY' });
        }

        const cardCode = String(event.headers['x-card-code'] || event.headers['X-Card-Code'] || '').trim();
        let hasValidCard = false;
        if (cardCode) {
            const card = await getCard(await getCardsStore(), cardCode);
            hasValidCard = !!card && checkCard(card).ok;
        }
        if (!hasValidCard) {
            const usageStore = await getUsageStore();
            const quota = await takeQuota(usageStore, 'ocr', ipHashOf(event), FREE_OCR_PER_DAY);
            if (!quota.allowed) {
                return jsonResponse(429, {
                    error: `今日免费识别次数（${FREE_OCR_PER_DAY} 次）已用完，输入次数卡后不限次`,
                    code: 'FREE_LIMIT'
                });
            }
            rollbackQuota = () => refundQuota(usageStore, quota.key);
        }
        await bumpStat('ocr');

        const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
        if (/application\/json/i.test(contentType)) {
            return handleJsonRequest(event, apiKey);
        }

        const fields = parseMultipartForm(event);
        const file = fields.files.find((part) => part.name === 'file' && part.fileName);
        if (!file) throw httpError(400, '未找到上传文件');

        validateUploadedFile(file);

        const model = sanitizeModel(fields.values.model || process.env.OCR_MODEL || DEFAULT_OCR_MODEL);
        const baseURL = process.env.OCR_API_BASE_URL || process.env.API_BASE_URL || DEFAULT_BASE_URL;
        const payload = await callVisionModel({
            apiKey,
            baseURL,
            model,
            messages: [{
                role: 'user',
                content: buildOcrContent(file)
            }],
            maxTokens: MAX_OUTPUT_TOKENS,
            temperature: 0
        });

        const text = payload.choices?.[0]?.message?.content || '';
        return jsonResponse(200, {
            text: text.trim(),
            model: payload.model || model,
            fileName: file.fileName
        });
    } catch (error) {
        if (rollbackQuota) await rollbackQuota();
        const statusCode = error.statusCode || 500;
        return jsonResponse(statusCode, {
            error: error.message || 'Gemini OCR 解析失败'
        });
    }
};

async function handleJsonRequest(event, apiKey) {
    const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || '', 'base64').toString('utf8')
        : event.body;
    const body = parseJsonBody(rawBody);
    if (body.action !== 'split_ocr_text') {
        throw httpError(400, '不支持的 OCR JSON 操作');
    }

    const rawText = String(body.rawText || '').trim();
    const roles = normalizeRoles(body.roles);
    if (!rawText) throw httpError(400, 'rawText 不能为空');
    if (roles.length === 0) throw httpError(400, 'roles 不能为空');

    const model = sanitizeModel(body.model || process.env.OCR_MODEL || DEFAULT_OCR_MODEL);
    const baseURL = process.env.OCR_API_BASE_URL || process.env.API_BASE_URL || DEFAULT_BASE_URL;
    const payload = await callVisionModel({
        apiKey,
        baseURL,
        model,
        messages: [{
            role: 'user',
            content: buildSplitPrompt(rawText, roles)
        }],
        maxTokens: 2200,
        temperature: 0
    });

    return jsonResponse(200, {
        content: payload.choices?.[0]?.message?.content || '',
        model: payload.model || model
    });
}

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

function parseMultipartForm(event) {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
        throw httpError(400, '上传格式不正确，请使用 multipart/form-data');
    }

    const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
    const body = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'latin1');
    const parts = parseMultipartBody(body, boundary);

    return {
        files: parts.filter((part) => part.fileName),
        values: Object.fromEntries(parts.filter((part) => !part.fileName).map((part) => [part.name, part.text || '']))
    };
}

function parseMultipartBody(body, boundary) {
    const parts = [];
    let cursor = 0;

    while (cursor < body.length) {
        const boundaryStart = body.indexOf(boundary, cursor);
        if (boundaryStart === -1) break;

        let partStart = boundaryStart + boundary.length;
        if (body.slice(partStart, partStart + 2).toString('latin1') === '--') break;
        if (body.slice(partStart, partStart + 2).toString('latin1') === '\r\n') {
            partStart += 2;
        }

        const nextBoundary = body.indexOf(boundary, partStart);
        if (nextBoundary === -1) break;

        let part = body.slice(partStart, nextBoundary);
        if (part.slice(-2).toString('latin1') === '\r\n') {
            part = part.slice(0, -2);
        }

        const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEnd !== -1) {
            const rawHeaders = part.slice(0, headerEnd).toString('utf8');
            const content = part.slice(headerEnd + 4);
            const disposition = rawHeaders.match(/content-disposition:[^\r\n]+/i)?.[0] || '';
            const name = disposition.match(/name="([^"]+)"/i)?.[1];
            const fileName = disposition.match(/filename="([^"]*)"/i)?.[1];
            const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'text/plain';

            if (name) {
                parts.push({
                    name,
                    fileName: fileName ? sanitizeFileName(fileName) : '',
                    mimeType,
                    buffer: content,
                    text: content.toString('utf8').trim()
                });
            }
        }

        cursor = nextBoundary;
    }

    return parts;
}

function sanitizeFileName(fileName) {
    return fileName.replace(/[\\/]/g, '_').trim() || 'upload';
}

function sanitizeModel(model) {
    const normalized = String(model || '').trim();
    return normalized || DEFAULT_OCR_MODEL;
}

function validateUploadedFile(file) {
    const lowerName = file.fileName.toLowerCase();
    const isImage = /^image\/(jpeg|jpg|png|webp)$/.test(file.mimeType) || /\.(jpe?g|png|webp)$/i.test(lowerName);
    const isPdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(lowerName);

    if (!isImage && !isPdf) {
        throw httpError(400, '仅支持 JPG、PNG、WebP 图片或 PDF 文件');
    }

    if (!file.buffer.length) {
        throw httpError(400, '上传文件为空');
    }

    if (file.buffer.length > MAX_FILE_SIZE) {
        throw httpError(413, '文件大小不能超过 20MB');
    }
}

function parseJsonBody(body) {
    try {
        return JSON.parse(body || '{}');
    } catch {
        throw httpError(400, '请求内容不是有效 JSON');
    }
}

function normalizeRoles(roles) {
    const values = Array.isArray(roles) ? roles : [roles].filter(Boolean);
    const allowed = new Set(Object.keys(ROLE_LABELS));
    return [...new Set(values.map(role => String(role || '').trim()).filter(role => allowed.has(role)))];
}

async function callVisionModel({ apiKey, baseURL, model, messages, maxTokens, temperature }) {
    const response = await fetch(buildChatCompletionsUrl(baseURL), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature
        })
    });

    const payload = await readJson(response);
    if (!response.ok) {
        throw httpError(response.status || 502, payload.error?.message || payload.message || 'Gemini OCR 调用失败');
    }
    return payload;
}

function buildOcrContent(file) {
    const prompt = [
        '你是一个严谨的 OCR 转写助手。',
        '请只提取文件中真实可见的文字，尽量保留原有段落、换行、题号和英文大小写。',
        '不要批改、不要解释、不要补写、不要翻译。',
        '如果有看不清的地方，用 [无法识别] 标记；如果没有文字，输出空字符串。'
    ].join('\n');
    const dataUrl = `data:${file.mimeType};base64,${file.buffer.toString('base64')}`;

    if (file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.fileName)) {
        return [
            { type: 'text', text: prompt },
            {
                type: 'file',
                file: {
                    filename: file.fileName,
                    file_data: dataUrl
                }
            }
        ];
    }

    return [
        { type: 'text', text: prompt },
        {
            type: 'image_url',
            image_url: {
                url: dataUrl
            }
        }
    ];
}

function buildSplitPrompt(rawText, roles) {
    const schema = `{${roles.map(role => `"${role}":"..."`).join(',')}}`;
    const roleText = roles.map(role => `${role}=${ROLE_LABELS[role]}`).join('，');

    return `你是一个 OCR 文本分段助手。请只根据 OCR 原文，把文本拆进用户标记的字段。

用户标记字段：${roleText}

要求：
1. 只输出 JSON，不要 Markdown，不要解释。
2. JSON 必须是：${schema}
3. 只在已标记字段中分配内容，不要新增字段。
4. 不要改写、润色、纠错或翻译；只做分段和去除明显 OCR 分隔符。
5. 如果某个字段无法判断，用空字符串。
6. 不要丢失原文信息；不确定的正文内容放入最接近的正文类字段。

OCR 原文：
${rawText}`;
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
        throw httpError(response.status || 502, text || 'Gemini OCR 返回了非 JSON 响应');
    }
}

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
