import jobs from './shared/ai-jobs.js';

export default async request => {
    const reply = (status, body) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (request.method !== 'GET') return reply(405, { error: '只支持 GET 请求' });
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!/^[a-f0-9]{64}$/.test(id)) return reply(404, { error: '任务不存在或已过期，请重新生成' });
    try {
        const result = await jobs.getJobsStore(true).get(`result/${id}`, { type: 'json' });
        if (!result || result.expiresAt < Date.now()) return reply(404, { error: '任务不存在或已过期，请重新生成' });
        if (result.state === 'done') return reply(result.response.statusCode, JSON.parse(result.response.body));
        return reply(202, { jobId: id, state: result.state });
    } catch {
        return reply(503, { error: '暂时无法查询结果，请稍后重试', code: 'JOB_STATUS_UNAVAILABLE' });
    }
};
