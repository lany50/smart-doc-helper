/* 浏览器与服务端共用的输入、评分结果校验。 */
(function (root) {
    function countWords(text) {
        return (String(text || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
    }

    function isPlaceholder(text) {
        const compact = String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}\d_]/gu, '');
        return !compact || /^(测试|測試|test|testing|hello|hi|abc|asdf|示例|占位|随便|暂无|无|待填写)+$/u.test(compact)
            || /^(.)\1{3,}$/u.test(compact);
    }

    // 新记录直接使用试卷材料；旧记录按需合并并避免重复整页内容。
    function getContinuationMaterials(input) {
        if (input?.materials !== undefined) return String(input.materials || '').trim();
        const topic = String(input?.topic || '').trim();
        const original = String(input?.original || '').trim();
        const compact = text => text.replace(/\s+/g, ' ');
        if (!topic || compact(original).includes(compact(topic))) return original;
        if (!original || compact(topic).includes(compact(original))) return topic;
        return `${topic}\n\n${original}`;
    }

    function validateInput(input, type, purpose) {
        const errors = {};
        const warnings = {};
        const continuation = type === 'continuation';
        const values = continuation ? { ...input, materials: getContinuationMaterials(input) } : input;
        const required = [continuation ? 'materials' : 'topic', ...(purpose === 'grade' ? ['content'] : [])];
        const labels = { topic: '题目要求', materials: '试卷材料', content: continuation ? '学生续写' : '学生作文' };
        for (const key of required) {
            const value = String(values?.[key] || '').trim();
            if (!value) errors[key] = `请填写${labels[key]}。`;
            else if (isPlaceholder(value)) errors[key] = `请填写真实的${labels[key]}，“测试”等占位文字无法用于${purpose === 'grade' ? '批改' : '生成思路'}。`;
        }
        if (continuation && !errors.materials) {
            const original = String(values.materials || '');
            const words = countWords(original);
            const chinese = (original.match(/[\u3400-\u9fff]/g) || []).length;
            if (words < 8 && chinese < 20) errors.materials = '试卷材料过短，请粘贴完整原文、写作要求和两个段首句。';
            else if (words < 80 && chinese < 120) warnings.materials = '试卷材料较短，请确认已包含完整原文、写作要求和两个段首句。';
        }
        if (purpose === 'grade' && !errors.content) {
            const words = countWords(input.content);
            if (!words) errors.content = '请填写英文作文正文；如为识别结果，请先检查文字。';
            else if (words < (continuation ? 130 : 60)) warnings.content = `目前 ${words} 词，篇幅较短。可以继续批改，也可以补充后再提交。`;
        }
        return { errors, warnings, valid: Object.keys(errors).length === 0 };
    }

    function parseGrade(raw, type) {
        let data = raw;
        if (typeof raw === 'string') {
            const candidate = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
            try { data = JSON.parse(candidate); }
            catch {
                const match = candidate.match(/\{[\s\S]*\}/);
                if (!match) throw new Error('报告解析失败，未收到有效的评分数据。');
                try { data = JSON.parse(match[0]); }
                catch { throw new Error('报告解析失败，评分数据不完整。'); }
            }
        }
        const maxima = type === 'continuation'
            ? { content: 8, language: 8, structure: 5, norm: 4 }
            : { content: 5, language: 7, structure: 3 };
        if (!data || typeof data !== 'object' || Array.isArray(data) || !data.scores) throw new Error('报告解析失败，缺少分项评分。');
        let total = 0;
        for (const [key, max] of Object.entries(maxima)) {
            const score = data.scores[key];
            if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > max) throw new Error('报告解析失败，分项评分无效。');
            total += score;
        }
        if (typeof data.totalScore !== 'number' || !Number.isFinite(data.totalScore) || Math.abs(total - data.totalScore) > 0.01) throw new Error('报告解析失败，总分与分项评分不一致。');
        if (typeof data.contentReview !== 'string' || !data.contentReview.trim()
            || typeof data.suggestions !== 'string' || !data.suggestions.trim()) throw new Error('报告解析失败，缺少内容点评或修改建议。');
        return data;
    }

    const api = { countWords, validateInput, parseGrade, getContinuationMaterials };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CompositionValidation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
