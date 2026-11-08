// Background processing is independent of the short synchronous gateway window.
async function requestModel(url, { apiKey, body, timeoutMs = 180000 }) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs)
        });
        const text = await response.text();
        let payload;
        try { payload = JSON.parse(text); }
        catch { throw modelError(response.ok ? 502 : response.status, 'AI 服务返回异常，请稍后重试', 'MODEL_INVALID_RESPONSE'); }
        if (!response.ok) throw modelError(response.status, 'AI 服务暂时不可用，请稍后重试', 'MODEL_UNAVAILABLE');
        return payload;
    } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            throw modelError(504, 'AI 本次响应较慢，请稍后重试', 'MODEL_TIMEOUT');
        }
        if (error.statusCode) throw error;
        throw modelError(502, '暂时无法连接 AI 服务，请稍后重试', 'MODEL_UNAVAILABLE');
    }
}

function modelError(statusCode, message, code) { return Object.assign(new Error(message), { statusCode, code }); }
module.exports = { requestModel };
