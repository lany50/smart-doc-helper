const crypto = require('crypto');
const zlib = require('zlib');

const MINERU_BASE_URL = 'https://mineru.net';
const MAX_FILE_SIZE = 200 * 1024 * 1024;
const MAX_POLLS = Number(process.env.MINERU_MAX_POLLS || 30);
const POLL_INTERVAL_MS = Number(process.env.MINERU_POLL_INTERVAL_MS || 2000);

exports.handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse(204, {});
    }

    if (event.httpMethod !== 'POST') {
        return jsonResponse(405, { error: '只支持 POST 上传文件' });
    }

    try {
        const token = process.env.MINERU_API_TOKEN;
        if (!token) {
            return jsonResponse(500, { error: '未配置 MINERU_API_TOKEN' });
        }

        const file = parseUploadedFile(event);
        validateUploadedFile(file);

        const batch = await applyUploadUrl(token, file);
        await uploadToMineru(batch.uploadUrl, file);
        const result = await waitForExtractResult(token, batch.batchId, batch.dataId);
        const markdown = await downloadMarkdownFromZip(result.full_zip_url);

        return jsonResponse(200, {
            text: markdown,
            model: 'mineru-vlm',
            fileName: result.file_name || file.fileName
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return jsonResponse(statusCode, {
            error: error.message || 'MinerU OCR 解析失败'
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

function parseUploadedFile(event) {
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
        throw httpError(400, '上传格式不正确，请使用 multipart/form-data');
    }

    const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
    const body = Buffer.from(event.body || '', event.isBase64Encoded ? 'base64' : 'latin1');
    const parts = parseMultipartBody(body, boundary);
    const filePart = parts.find((part) => part.name === 'file' && part.fileName);

    if (!filePart) {
        throw httpError(400, '未找到上传文件');
    }

    return filePart;
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
            const mimeType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || 'application/octet-stream';

            if (name) {
                parts.push({
                    name,
                    fileName: fileName ? sanitizeFileName(fileName) : '',
                    mimeType,
                    buffer: content
                });
            }
        }

        cursor = nextBoundary;
    }

    return parts;
}

function sanitizeFileName(fileName) {
    return fileName.replace(/[\\/]/g, '_').trim() || 'upload.pdf';
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
        throw httpError(413, '文件大小不能超过 200MB');
    }
}

async function applyUploadUrl(token, file) {
    const dataId = `sdh_${crypto.randomUUID()}`;
    const response = await fetch(`${MINERU_BASE_URL}/api/v4/file-urls/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            files: [{ name: file.fileName, data_id: dataId }],
            model_version: 'vlm',
            is_ocr: true,
            enable_formula: true,
            enable_table: true,
            language: 'ch'
        })
    });

    const payload = await readJson(response);
    if (!response.ok || payload.code !== 0) {
        throw httpError(response.status || 502, payload.msg || '申请 MinerU 上传地址失败');
    }

    const uploadUrl = payload.data?.file_urls?.[0];
    const batchId = payload.data?.batch_id;
    if (!uploadUrl || !batchId) {
        throw httpError(502, 'MinerU 未返回上传地址或批次 ID');
    }

    return { uploadUrl, batchId, dataId };
}

async function uploadToMineru(uploadUrl, file) {
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file.buffer
    });

    if (!response.ok) {
        throw httpError(response.status || 502, '上传文件到 MinerU 失败');
    }
}

async function waitForExtractResult(token, batchId, dataId) {
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
        if (attempt > 0) await sleep(POLL_INTERVAL_MS);

        const response = await fetch(`${MINERU_BASE_URL}/api/v4/extract-results/batch/${batchId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        const payload = await readJson(response);

        if (!response.ok || payload.code !== 0) {
            throw httpError(response.status || 502, payload.msg || '查询 MinerU 解析结果失败');
        }

        const results = Array.isArray(payload.data?.extract_result)
            ? payload.data.extract_result
            : [payload.data?.extract_result].filter(Boolean);
        const result = results.find((item) => item.data_id === dataId) || results[0];
        if (!result) continue;

        if (result.state === 'done') {
            if (!result.full_zip_url) {
                throw httpError(502, 'MinerU 解析完成但未返回结果压缩包');
            }
            return result;
        }

        if (result.state === 'failed') {
            throw httpError(502, result.err_msg || 'MinerU 解析失败');
        }
    }

    throw httpError(504, 'MinerU 解析超时，请稍后重试');
}

async function downloadMarkdownFromZip(zipUrl) {
    const response = await fetch(zipUrl);
    if (!response.ok) {
        throw httpError(response.status || 502, '下载 MinerU 解析结果失败');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const markdown = extractMarkdownFromZip(buffer);
    if (!markdown.trim()) {
        throw httpError(502, 'MinerU 结果中未找到 Markdown 文本');
    }
    return markdown;
}

function extractMarkdownFromZip(zipBuffer) {
    const eocdOffset = findEndOfCentralDirectory(zipBuffer);
    if (eocdOffset === -1) {
        throw httpError(502, 'MinerU 结果压缩包格式异常');
    }

    const totalEntries = zipBuffer.readUInt16LE(eocdOffset + 10);
    let centralOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
    const entries = [];

    for (let i = 0; i < totalEntries; i += 1) {
        if (zipBuffer.readUInt32LE(centralOffset) !== 0x02014b50) break;

        const compressionMethod = zipBuffer.readUInt16LE(centralOffset + 10);
        const compressedSize = zipBuffer.readUInt32LE(centralOffset + 20);
        const fileNameLength = zipBuffer.readUInt16LE(centralOffset + 28);
        const extraLength = zipBuffer.readUInt16LE(centralOffset + 30);
        const commentLength = zipBuffer.readUInt16LE(centralOffset + 32);
        const localOffset = zipBuffer.readUInt32LE(centralOffset + 42);
        const fileName = zipBuffer.slice(centralOffset + 46, centralOffset + 46 + fileNameLength).toString('utf8');

        entries.push({ fileName, compressionMethod, compressedSize, localOffset });
        centralOffset += 46 + fileNameLength + extraLength + commentLength;
    }

    const markdownEntry = entries.find((entry) => /(^|\/)full\.md$/i.test(entry.fileName))
        || entries.find((entry) => /\.md$/i.test(entry.fileName));
    if (!markdownEntry) return '';

    return readZipEntry(zipBuffer, markdownEntry).toString('utf8');
}

function readZipEntry(zipBuffer, entry) {
    const localOffset = entry.localOffset;
    if (zipBuffer.readUInt32LE(localOffset) !== 0x04034b50) {
        throw httpError(502, 'MinerU 结果压缩包文件头异常');
    }

    const fileNameLength = zipBuffer.readUInt16LE(localOffset + 26);
    const extraLength = zipBuffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + fileNameLength + extraLength;
    const compressed = zipBuffer.slice(dataStart, dataStart + entry.compressedSize);

    if (entry.compressionMethod === 0) return compressed;
    if (entry.compressionMethod === 8) return zlib.inflateRawSync(compressed);

    throw httpError(502, 'MinerU 结果压缩包使用了不支持的压缩格式');
}

function findEndOfCentralDirectory(buffer) {
    for (let i = buffer.length - 22; i >= 0; i -= 1) {
        if (buffer.readUInt32LE(i) === 0x06054b50) return i;
    }
    return -1;
}

async function readJson(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        throw httpError(response.status || 502, text || 'MinerU 返回了非 JSON 响应');
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}
