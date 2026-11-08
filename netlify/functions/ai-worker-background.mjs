import { getStore } from '@netlify/blobs';
import jobs from './shared/ai-jobs.js';
import chat from './chat-completion.js';
import ocr from './vision-ocr.js';

export default async request => {
    const { id } = await request.json();
    if (!/^[a-f0-9]{64}$/.test(id || '')) return;
    const store = jobs.getJobsStore(true, getStore);
    const input = await store.get(`request/${id}`, { type: 'json' });
    const previous = await store.get(`result/${id}`, { type: 'json' });
    if (!input || input.expiresAt < Date.now() || previous?.state === 'done' || previous?.state === 'running') return;
    await store.setJSON(`result/${id}`, { state: 'running', expiresAt: input.expiresAt });
    let response;
    try {
        const handler = input.kind === 'ocr' ? ocr.handler : chat.handler;
        response = await handler({ ...input.event, aiBackground: true });
    } catch {
        response = jobs.jsonResponse(502, { error: 'AI 服务暂时不可用，输入内容已保留，请稍后重试' });
    }
    await store.setJSON(`result/${id}`, { state: 'done', expiresAt: input.expiresAt, response });
    await store.delete(`request/${id}`);
};

export const config = { background: true };
