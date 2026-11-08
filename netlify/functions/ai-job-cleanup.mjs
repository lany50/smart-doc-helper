import { getStore } from '@netlify/blobs';
import jobs from './shared/ai-jobs.js';

export default async () => {
    const store = jobs.getJobsStore(true, getStore);
    let cursor;
    do {
        const page = await store.list({ cursor });
        for (const { key } of page.blobs) {
            const record = await store.get(key, { type: 'json' });
            if (record && record.expiresAt < Date.now()) await store.delete(key);
        }
        cursor = page.cursor;
    } while (cursor);
    return new Response(null, { status: 204 });
};

// Once per hour at minute 0 UTC (also minute 0 in Asia/Shanghai).
export const config = { schedule: '0 * * * *' };
