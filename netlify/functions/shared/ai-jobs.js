const crypto = require('node:crypto');

const JOB_TTL_MS = 30 * 60 * 1000;

function connect(event) {
    if (!process.env.AI_JOB_LOCAL_DIR && event?.blobs) require('@netlify/blobs').connectLambda(event);
}

function getJobsStore(strong = false) {
    if (process.env.AI_JOB_LOCAL_DIR) {
        const fs = require('node:fs');
        const path = require('node:path');
        const dir = process.env.AI_JOB_LOCAL_DIR;
        fs.mkdirSync(dir, { recursive: true });
        const file = key => path.join(dir, encodeURIComponent(key) + '.json');
        return {
            async get(key) { try { return JSON.parse(fs.readFileSync(file(key), 'utf8')); } catch { return null; } },
            async setJSON(key, value) { fs.writeFileSync(file(key), JSON.stringify(value)); },
            async delete(key) { fs.rmSync(file(key), { force: true }); },
            async list() { return { blobs: fs.readdirSync(dir).map(name => ({ key: decodeURIComponent(name.slice(0, -5)) })) }; }
        };
    }
    const options = { name: 'ai-jobs', ...(strong ? { consistency: 'strong' } : {}) };
    if (process.env.NETLIFY_BLOBS_TOKEN) {
        options.siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.SITE_ID;
        options.token = process.env.NETLIFY_BLOBS_TOKEN;
    }
    return require('@netlify/blobs').getStore(options);
}

function jsonResponse(statusCode, body) {
    return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

function wantsAsync(event) {
    return /respond-async/i.test(event.headers?.prefer || event.headers?.Prefer || '');
}

async function startJob(event, kind) {
    connect(event);
    const store = getJobsStore();
    // The unguessable id is the capability for this short-lived result.
    const id = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + JOB_TTL_MS;
    await store.setJSON(`request/${id}`, {
        kind, expiresAt,
        event: { httpMethod: 'POST', headers: { 'content-type': event.headers?.['content-type'] || event.headers?.['Content-Type'] || 'application/json' }, body: event.body, isBase64Encoded: event.isBase64Encoded }
    });
    await store.setJSON(`result/${id}`, { state: 'pending', expiresAt });
    try {
        const base = process.env.DEPLOY_URL || process.env.URL || 'https://smartocrhelper.netlify.app';
        const response = await fetch(new URL('/.netlify/functions/ai-worker-background', base), {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }), signal: AbortSignal.timeout(8000)
        });
        if (response.status !== 202) throw new Error('后台任务启动失败，请稍后重试');
    } catch (error) {
        await store.delete(`request/${id}`);
        await store.delete(`result/${id}`);
        throw error;
    }
    return jsonResponse(202, { jobId: id });
}

module.exports = { connect, getJobsStore, jsonResponse, wantsAsync, startJob };
