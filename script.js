// script.js

(function () {

// ========================================
// API配置 - 支持多种配置方式
// ========================================

const API_CONFIG = (() => {
    // 优先级1: Netlify环境变量（通过页面注入）
    if (typeof window.NETLIFY_CONFIG !== 'undefined' && window.NETLIFY_CONFIG.apiKey) {
        console.log('🚀 使用Netlify环境变量');
        return {
            baseURL: window.NETLIFY_CONFIG.baseURL || 'https://api.st0722.top/v1',
            apiKey: window.NETLIFY_CONFIG.apiKey
        };
    }
    
    // 优先级2: 本地配置文件（开发环境）
    if (typeof window.LOCAL_API_CONFIG !== 'undefined') {
        console.log('💻 使用本地配置文件');
        return window.LOCAL_API_CONFIG;
    }
    
    // 优先级3: 从老版本config.js读取（兼容）
    if (typeof window.API_CONFIG !== 'undefined' && window.API_CONFIG && window.API_CONFIG.apiKey) {
        console.log('💻 使用兼容配置');
        return window.API_CONFIG;
    }
    
    console.warn('未找到API配置，将以未配置状态启动');
    return {
        baseURL: 'https://api.st0722.top/v1',
        apiKey: ''  // 空密钥，会导致API调用失败
    };
})();

console.log('API配置状态:', {
    baseURL: API_CONFIG.baseURL,
    hasKey: !!API_CONFIG.apiKey,
    keyLength: API_CONFIG.apiKey ? API_CONFIG.apiKey.length : 0
});
// 应用文批改提示词（满分15分，字数80词左右）
const APPLICATION_GRADING_PROMPT = `你是一名精通中国高考英语应用文写作指导的老师，具备强大的逻辑分析和语言润色能力。

现在，请批改以下学生作文：

【题目要求】
{TOPIC}

【学生作文】
{ESSAY}

请严格按照以下JSON格式输出批改结果（满分15分，建议字数80词左右）：

{
  "totalScore": 0,
  "scores": {
    "content": 0,
    "language": 0,
    "structure": 0
  },
  "contentReview": "内容点评文字...",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "problems": ["问题1", "问题2"],
  "suggestions": "改进建议文字...",
  "modelAnswer": "范文内容（约80词）...",
  "tips": "提分秘诀文字..."
}

高考英语应用文评分标准（满分15分，按五个档次评分）：

第五档（13-15分）- 完全达到了预期的写作目的
【内容】覆盖所有内容要点，表述清楚、合理，完全符合写作目的
【词汇语法】使用多样且恰当的词汇和语法结构，可能有个别小错误，但不影响理解，展现出较强的语言运用能力
【篇章结构】有效使用语句间衔接手段，全文结构清晰，意义连贯

第四档（10-12分）- 达到了预期的写作目的
【内容】覆盖所有内容要点，表述比较清楚、合理，基本达到写作目的
【词汇语法】使用较多样且恰当的词汇和语法结构，可能有少量错误，但不影响理解
【篇章结构】比较有效地使用语句间衔接手段，全文结构比较清晰，意义比较连贯

第三档（7-9分）- 基本达到了预期的写作目的
【内容】覆盖大部分内容要点，少数地方表述不够清楚、合理，基本达到写作目的
【词汇语法】使用简单的词汇和语法结构，有一些错误，但基本不影响理解
【篇章结构】基本有效地使用语句间衔接手段，全文结构基本清晰，意义基本连贯

第二档（4-6分）- 未能完全达到预期的写作目的
【内容】遗漏或未清楚表述一些内容要点，或部分内容与写作目的不相关，未能完全达到写作目的
【词汇语法】词汇有限，语法结构单调，错误较多，影响理解
【篇章结构】几乎不能有效地使用语句间衔接手段，全文结构不够清晰，意义不够连贯

第一档（1-3分）- 完全未达到预期的写作目的
【内容】遗漏或未清楚表述大部分内容要点，或大部分内容与写作目的不相关，完全未达到写作目的
【词汇语法】词汇和语法结构非常有限，错误很多，严重影响理解
【篇章结构】几乎没有使用语句间衔接手段，全文结构不清晰，意义不连贯

字数要求：
- 应用文建议80词左右
- 60-100词之间为合理区间
- 低于60词或高于100词会适当扣分
- 拼写和标点符号错误视对交际的影响程度予以考虑
- 书写较差影响交际的，可能会酌情扣分

评分说明：
1. 根据以上五档标准，先判断作文属于哪个档次
2. 在该档次内根据具体表现给出分数
3. totalScore = content + language + structure，满分15分
4. content（内容）建议分值：5分
5. language（词汇语法）建议分值：7分
6. structure（篇章结构）建议分值：3分

注意事项：
1. 所有文字内容使用简体中文
2. highlights和problems数组至少各包含2-3条
3. modelAnswer必须是完整的范文，约80词，展现第五档水平
4. contentReview中要明确指出作文属于哪个档次，并说明理由
5. 请确保输出是有效的JSON格式

请开始批改：`;

// 写作思路指导提示词
const WRITING_GUIDANCE_PROMPT = `你是一名精通中国高考英语应用文写作指导的老师。

学生向你提供了以下作文题目：

【题目要求】
{TOPIC}

请为学生提供详细的写作思路指导，包括：

1. **题目分析**
   - 写作类型（建议信/邀请信/道歉信等）
   - 关键要点提取
   - 字数要求（建议80词左右）

2. **写作框架**
   - 开头：如何称呼和开场
   - 主体段落：需要包含哪些内容要点
   - 结尾：如何礼貌收尾

3. **语言建议**
   - 推荐使用的高级词汇和短语
   - 适合的句式结构
   - 注意事项（时态、语气等）

4. **范文示例**
   提供一篇符合要求的优秀范文（约80词）

请用简洁清晰的中文讲解，帮助学生快速理解写作思路。`;

// 读后续写批改提示词（满分25分）
const CONTINUATION_GRADING_PROMPT = `你是一名精通中国高考英语读后续写写作指导的老师，具备强大的逻辑分析和语言润色能力。

现在，请批改以下学生的读后续写作文：

【题目要求】
{TOPIC}

【原文内容】
{ORIGINAL}

【学生续写】
{CONTINUATION}

请严格按照以下JSON格式输出批改结果（满分25分）：

{
  "totalScore": 0,
  "scores": {
    "content": 0,
    "language": 0,
    "structure": 0,
    "norm": 0
  },
  "contentReview": "内容点评文字...",
  "highlights": ["亮点1", "亮点2", "亮点3"],
  "problems": ["问题1", "问题2"],
  "suggestions": "改进建议文字...",
  "modelAnswer": "范文内容（约130词）...",
  "tips": "提分秘诀文字..."
}

评分标准（满分25分）：
- 内容（8分）：内容的丰富性、故事发展的合理性，续写的完整性及与原文语境的融合程度
- 词汇语法（8分）：使用语言的多样性、准确性和恰当性（语言为交际服务，不可一味使用所谓"高级"语言，要与原文语言特点保持一致）
- 篇章结构（5分）：上下文的衔接（包括续写段落之间的衔接）和全文的连贯性
- 写作规范（4分）：①词数少于130的，扣2分；②拼写和标点符号是写作规范的一个方面，应视其对交际的影响程度予以考虑，英、美拼写及词汇用法均可接受；③如书写较差，以至影响交际，将分数降低一个档次

各档次的给分范围和要求：
第五档（21-25分）完全达到了预期的写作目的。
- 与所给短文融合度高，与所提供各段落开头语衔接合理
- 内容丰富，故事发展合理、逻辑性强，续写完整，符合写作目的与情境
- 所使用语法结构和词汇多样、准确和恰当，可能有个别错误，但完全不影响意义表达
- 有效地使用了语句间的连接手段，结构清晰，意义连贯

第四档（16-20分）达到了预期的写作目的。
- 与所给短文融合度较高，与所提供各段落开头语衔接较为合理
- 内容比较丰富，故事发展比较合理、有逻辑性，续写比较完整，比较符合写作目的与情境
- 所使用语法结构和词汇较为丰富、准确，可能有些许错误，但完全不影响意义表达
- 比较有效地使用了语句间的连接手段，结构比较清晰，意义比较连贯

第三档（11-15分）整体而言，基本达到了预期的写作目的。
- 与所给短文关系较为密切，与所提供各段落开头语有一定程度的衔接
- 写出了若干有关内容，故事发展有合理之处、有一定的逻辑性，续写基本完整，基本符合写作目的与情境
- 应用的语法结构和词汇能满足任务的要求，虽有一些错误，但不影响意义的表达
- 应用简单的语句间的连接手段，结构基本清晰，意义基本连贯

第二档（6-10分）未能达到预期的写作目的。
- 与所给短文有一定的关系，与所提供各段落开头语有一定程度的衔接
- 写出了一些有关内容，故事发展不太合理、逻辑性差，不太符合写作目的与情境
- 语法结构单调、词汇项目有限，错误较多，影响了意义的表达
- 较少使用语句间的连接手段，全文结构不够清晰，意义不够连贯

注意：
1. totalScore = content + language + structure + norm，满分25分
2. 所有文字内容使用简体中文
3. highlights和problems数组至少各包含2-3条
4. modelAnswer必须是完整的范文，约130词
5. 请确保输出是有效的JSON格式

请开始批改：`;

// 读后续写思路指导提示词
const CONTINUATION_GUIDANCE_PROMPT = `你是一名精通中国高考英语读后续写写作指导的老师。

学生向你提供了以下读后续写题目：

【题目要求】
{TOPIC}

请为学生提供详细的写作思路指导，包括：

1. **题目分析**
   - 题目类型和要求
   - 关键信息提取
   - 字数要求（建议130词以上）

2. **故事发展思路**
   - 原文的故事背景和关键信息
   - 可能的故事发展方向
   - 如何与原文自然衔接

3. **写作框架**
   - 第一段：如何开头和承接原文
   - 第二段：故事的发展和转折
   - 结尾：如何合理收尾

4. **语言建议**
   - 推荐使用的高级词汇和短语
   - 适合的句式结构
   - 与原文保持语言风格一致的建议

5. **范文示例**
   提供一篇符合要求的优秀范文（约130词）

请用简洁清晰的中文讲解，帮助学生快速理解写作思路。`;

// 全局变量
let uploadedImages = []; // 存储上传的图片
let ocrResults = []; // 存储OCR结果
let newSelectedImages = [];

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    initNewPanels();
    initNewChatApp();
    initApp();
});

function initNewPanels() {
    const app = document.getElementById('app');
    const legacyApp = document.getElementById('legacyApp');
    const openLegacyBtn = document.getElementById('openLegacyBtn');
    const hideLegacyBtn = document.getElementById('hideLegacyBtn');

    if (openLegacyBtn && hideLegacyBtn && app && legacyApp) {
        openLegacyBtn.addEventListener('click', () => {
            legacyApp.classList.remove('ui-hidden');
            app.classList.add('ui-hidden');
            openLegacyBtn.classList.add('ui-hidden');
            hideLegacyBtn.classList.remove('ui-hidden');
        });

        hideLegacyBtn.addEventListener('click', () => {
            legacyApp.classList.add('ui-hidden');
            app.classList.remove('ui-hidden');
            hideLegacyBtn.classList.add('ui-hidden');
            openLegacyBtn.classList.remove('ui-hidden');
        });
    }

    const composerPanel = document.getElementById('composerPanel');
    const panelOcr = document.getElementById('panelOcr');
    const panelEssay = document.getElementById('panelEssay');
    const panelModel = document.getElementById('panelModel');
    const panelMore = document.getElementById('panelMore');

    const chipOcr = document.getElementById('chipOcr');
    const chipEssay = document.getElementById('chipEssay');
    const chipModel = document.getElementById('chipModel');
    const chipMore = document.getElementById('chipMore');

    const chips = [
        { chip: chipOcr, panel: panelOcr },
        { chip: chipEssay, panel: panelEssay },
        { chip: chipModel, panel: panelModel },
        { chip: chipMore, panel: panelMore }
    ];

    const setActivePanel = (activeChip) => {
        if (!composerPanel) return;
        composerPanel.classList.remove('ui-hidden');

        chips.forEach(({ chip, panel }) => {
            if (!chip || !panel) return;
            const isActive = chip === activeChip;
            chip.classList.toggle('active', isActive);
            panel.classList.toggle('ui-hidden', !isActive);
        });
    };

    chips.forEach(({ chip }) => {
        if (!chip) return;
        chip.addEventListener('click', () => setActivePanel(chip));
    });

    if (chipOcr) setActivePanel(chipOcr);

    const apiStatusText = document.getElementById('apiStatusText');
    if (apiStatusText) {
        const hasKey = !!(API_CONFIG && API_CONFIG.apiKey);
        apiStatusText.textContent = hasKey
            ? `API 已配置：${API_CONFIG.baseURL}`
            : 'API 未配置：请创建 config.js 或设置部署环境变量';
    }

    const attachBtn = document.getElementById('attachBtn');
    const fileInput = document.getElementById('fileInput');
    const ocrFileHint = document.getElementById('ocrFileHint');
    const ocrFileList = document.getElementById('ocrFileList');
    const ocrClearBtn = document.getElementById('ocrClearBtn');

    const renderOcrFiles = () => {
        if (!ocrFileList || !ocrFileHint) return;
        if (newSelectedImages.length === 0) {
            ocrFileHint.textContent = '点击 Attach 选择图片后再开始识别';
            ocrFileList.classList.add('ui-hidden');
            ocrFileList.innerHTML = '';
            return;
        }

        ocrFileHint.textContent = `已选择 ${newSelectedImages.length} 张图片`;
        ocrFileList.classList.remove('ui-hidden');
        ocrFileList.innerHTML = newSelectedImages
            .map((file, index) => {
                const safeName = String(file.name || `image-${index + 1}`).replaceAll('<', '&lt;').replaceAll('>', '&gt;');
                return `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--border);">
                    <div style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safeName}</div>
                    <button class="ui-action" type="button" data-remove="${index}">移除</button>
                </div>`;
            })
            .join('');

        const removeButtons = ocrFileList.querySelectorAll('[data-remove]');
        removeButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const i = Number(btn.getAttribute('data-remove'));
                newSelectedImages = newSelectedImages.filter((_, idx) => idx !== i);
                renderOcrFiles();
            });
        });
    };

    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            const valid = files.filter((f) => validateImageFile(f, true));
            if (valid.length === 0) return;
            newSelectedImages = valid;
            renderOcrFiles();
        });
    }

    if (ocrClearBtn) {
        ocrClearBtn.addEventListener('click', () => {
            newSelectedImages = [];
            if (fileInput) fileInput.value = '';
            renderOcrFiles();
        });
    }

    const essayTypeSelect = document.getElementById('essayTypeSelect');
    const essayOriginalWrap = document.getElementById('essayOriginalWrap');
    const essayTextLabel = document.getElementById('essayTextLabel');
    const essayTextInput = document.getElementById('essayTextInput');
    const essayWordCountText = document.getElementById('essayWordCountText');

    const updateEssayPanel = () => {
        const type = essayTypeSelect ? essayTypeSelect.value : 'application';
        if (essayOriginalWrap) essayOriginalWrap.classList.toggle('ui-hidden', type !== 'continuation');
        if (essayTextLabel) essayTextLabel.textContent = type === 'continuation' ? '续写内容' : '学生作文';
        if (essayTextInput && essayWordCountText) essayWordCountText.textContent = String(countWords(essayTextInput.value || ''));
    };

    if (essayTypeSelect) essayTypeSelect.addEventListener('change', updateEssayPanel);
    if (essayTextInput) essayTextInput.addEventListener('input', updateEssayPanel);
    updateEssayPanel();
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function copyText(text) {
    const value = String(text ?? '');
    try {
        await navigator.clipboard.writeText(value);
        showToast('已复制', 'success');
    } catch {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('已复制', 'success');
        } catch {
            showToast('复制失败', 'error');
        } finally {
            document.body.removeChild(textarea);
        }
    }
}

function ensureChatVisible() {
    const emptyState = document.getElementById('emptyState');
    const chatState = document.getElementById('chatState');
    if (emptyState) emptyState.classList.add('ui-hidden');
    if (chatState) chatState.classList.remove('ui-hidden');
}

function addChatMessage({ role, text, html, actions = [] }) {
    const chat = document.getElementById('chat');
    if (!chat) return null;

    ensureChatVisible();

    const row = document.createElement('div');
    row.className = `ui-message-row ${role === 'user' ? 'user' : 'assistant'}`;

    const bubble = document.createElement('div');
    bubble.className = `ui-message ${role === 'user' ? 'user' : 'assistant'}`;

    const content = document.createElement('div');
    if (html) {
        content.innerHTML = html;
    } else {
        content.style.whiteSpace = 'pre-wrap';
        content.textContent = text ?? '';
    }
    bubble.appendChild(content);

    if (role !== 'user' && actions.length > 0) {
        const meta = document.createElement('div');
        meta.className = 'ui-message-meta';
        actions.forEach((action) => {
            const btn = document.createElement('button');
            btn.className = 'ui-action';
            btn.type = 'button';
            btn.textContent = action.label;
            btn.addEventListener('click', action.onClick);
            meta.appendChild(btn);
        });
        bubble.appendChild(meta);
    }

    row.appendChild(bubble);
    chat.appendChild(row);
    row.scrollIntoView({ block: 'end' });

    return {
        setText(nextText) {
            content.innerHTML = '';
            content.style.whiteSpace = 'pre-wrap';
            content.textContent = nextText ?? '';
        },
        setHtml(nextHtml) {
            content.style.whiteSpace = '';
            content.innerHTML = nextHtml ?? '';
        }
    };
}

function parseJsonFromOutput(output) {
    const text = String(output ?? '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
        return JSON.parse(jsonMatch[0]);
    } catch {
        return null;
    }
}

function formatApplicationGradingHtml(data) {
    const totalScore = escapeHtml(`${data?.totalScore ?? 0}/15`);
    const contentScore = escapeHtml(`${data?.scores?.content ?? 0}/5`);
    const languageScore = escapeHtml(`${data?.scores?.language ?? 0}/7`);
    const structureScore = escapeHtml(`${data?.scores?.structure ?? 0}/3`);
    const contentReview = escapeHtml(data?.contentReview ?? '');
    const suggestions = escapeHtml(data?.suggestions ?? '');
    const modelAnswer = escapeHtml(data?.modelAnswer ?? '');
    const tips = escapeHtml(data?.tips ?? '');
    const highlights = Array.isArray(data?.highlights) ? data.highlights : [];
    const problems = Array.isArray(data?.problems) ? data.problems : [];

    return `
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-weight:600;">应用文批改</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:12px;">
                <span>总分：<strong style="color:var(--text);">${totalScore}</strong></span>
                <span>内容：${contentScore}</span>
                <span>语言：${languageScore}</span>
                <span>结构：${structureScore}</span>
            </div>
        </div>
        <div class="grading-card">
            <h4>✅ 内容点评</h4>
            <div class="content">${contentReview}</div>
        </div>
        <div class="grading-card">
            <h4>✨ 语言亮点</h4>
            <div class="content"><ul>${highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul></div>
        </div>
        <div class="grading-card">
            <h4>⚠️ 存在问题</h4>
            <div class="content"><ul>${problems.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>
        </div>
        <div class="grading-card">
            <h4>💡 改进建议</h4>
            <div class="content">${suggestions}</div>
        </div>
        <div class="grading-card model-answer-card">
            <h4>📖 范文参考</h4>
            <div class="content">${modelAnswer}</div>
        </div>
        <div class="grading-card">
            <h4>🎯 提分秘诀</h4>
            <div class="content">${tips}</div>
        </div>
    `.trim();
}

function formatContinuationGradingHtml(data) {
    const totalScore = escapeHtml(`${data?.totalScore ?? 0}/25`);
    const contentScore = escapeHtml(`${data?.scores?.content ?? 0}/8`);
    const languageScore = escapeHtml(`${data?.scores?.language ?? 0}/8`);
    const vocabularyScore = escapeHtml(`${data?.scores?.vocabulary ?? 0}/5`);
    const structureScore = escapeHtml(`${data?.scores?.structure ?? 0}/5`);
    const normScore = escapeHtml(`${data?.scores?.norm ?? 0}/4`);
    const contentReview = escapeHtml(data?.contentReview ?? '');
    const suggestions = escapeHtml(data?.suggestions ?? '');
    const modelAnswer = escapeHtml(data?.modelAnswer ?? '');
    const tips = escapeHtml(data?.tips ?? '');
    const highlights = Array.isArray(data?.highlights) ? data.highlights : [];
    const problems = Array.isArray(data?.problems) ? data.problems : [];

    return `
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-weight:600;">读后续写批改</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:12px;">
                <span>总分：<strong style="color:var(--text);">${totalScore}</strong></span>
                <span>内容：${contentScore}</span>
                <span>语言：${languageScore}</span>
                <span>词汇：${vocabularyScore}</span>
                <span>结构：${structureScore}</span>
                <span>规范：${normScore}</span>
            </div>
        </div>
        <div class="grading-card">
            <h4>✅ 内容点评</h4>
            <div class="content">${contentReview}</div>
        </div>
        <div class="grading-card">
            <h4>✨ 语言亮点</h4>
            <div class="content"><ul>${highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul></div>
        </div>
        <div class="grading-card">
            <h4>⚠️ 存在问题</h4>
            <div class="content"><ul>${problems.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>
        </div>
        <div class="grading-card">
            <h4>💡 改进建议</h4>
            <div class="content">${suggestions}</div>
        </div>
        <div class="grading-card model-answer-card">
            <h4>📖 范文参考</h4>
            <div class="content">${modelAnswer}</div>
        </div>
        <div class="grading-card">
            <h4>🎯 提分秘诀</h4>
            <div class="content">${tips}</div>
        </div>
    `.trim();
}

function applicationGradingToText(data) {
    const lines = [];
    lines.push(`总分：${data?.totalScore ?? 0}/15`);
    lines.push(`内容：${data?.scores?.content ?? 0}/5  语言：${data?.scores?.language ?? 0}/7  结构：${data?.scores?.structure ?? 0}/3`);
    lines.push('');
    lines.push('内容点评：');
    lines.push(String(data?.contentReview ?? ''));
    lines.push('');
    lines.push('语言亮点：');
    (Array.isArray(data?.highlights) ? data.highlights : []).forEach((h) => lines.push(`- ${h}`));
    lines.push('');
    lines.push('存在问题：');
    (Array.isArray(data?.problems) ? data.problems : []).forEach((p) => lines.push(`- ${p}`));
    lines.push('');
    lines.push('改进建议：');
    lines.push(String(data?.suggestions ?? ''));
    lines.push('');
    lines.push('范文参考：');
    lines.push(String(data?.modelAnswer ?? ''));
    lines.push('');
    lines.push('提分秘诀：');
    lines.push(String(data?.tips ?? ''));
    return lines.join('\n');
}

function continuationGradingToText(data) {
    const lines = [];
    lines.push(`总分：${data?.totalScore ?? 0}/25`);
    lines.push(`内容：${data?.scores?.content ?? 0}/8  语言：${data?.scores?.language ?? 0}/8  词汇：${data?.scores?.vocabulary ?? 0}/5  结构：${data?.scores?.structure ?? 0}/5  规范：${data?.scores?.norm ?? 0}/4`);
    lines.push('');
    lines.push('内容点评：');
    lines.push(String(data?.contentReview ?? ''));
    lines.push('');
    lines.push('语言亮点：');
    (Array.isArray(data?.highlights) ? data.highlights : []).forEach((h) => lines.push(`- ${h}`));
    lines.push('');
    lines.push('存在问题：');
    (Array.isArray(data?.problems) ? data.problems : []).forEach((p) => lines.push(`- ${p}`));
    lines.push('');
    lines.push('改进建议：');
    lines.push(String(data?.suggestions ?? ''));
    lines.push('');
    lines.push('范文参考：');
    lines.push(String(data?.modelAnswer ?? ''));
    lines.push('');
    lines.push('提分秘诀：');
    lines.push(String(data?.tips ?? ''));
    return lines.join('\n');
}

function initNewChatApp() {
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const ocrStartBtn = document.getElementById('ocrStartBtn');
    const ocrModelSelect = document.getElementById('ocrModelSelect');
    const ocrClearBtn = document.getElementById('ocrClearBtn');
    const essayGuidanceBtn = document.getElementById('essayGuidanceBtn');
    const essayGradeBtn = document.getElementById('essayGradeBtn');
    const essayTypeSelect = document.getElementById('essayTypeSelect');
    const essayTopicInput = document.getElementById('essayTopicInput');
    const essayTextInput = document.getElementById('essayTextInput');
    const essayOriginalInput = document.getElementById('essayOriginalInput');
    const textModelSelect = document.getElementById('textModelSelect');
    const openSettingsBtn = document.getElementById('openSettingsBtn');

    const chipOcr = document.getElementById('chipOcr');
    const chipEssay = document.getElementById('chipEssay');
    const chipModel = document.getElementById('chipModel');
    const chipMore = document.getElementById('chipMore');

    const suggestionButtons = document.querySelectorAll('.ui-suggestion');
    suggestionButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-suggest');
            if (type === 'ocr_single' || type === 'ocr_multi') {
                if (chipOcr) chipOcr.click();
                const attachBtn = document.getElementById('attachBtn');
                if (attachBtn) attachBtn.click();
                return;
            }
            if (type === 'essay_app') {
                if (chipEssay) chipEssay.click();
                if (essayTypeSelect) essayTypeSelect.value = 'application';
                if (essayTopicInput) essayTopicInput.focus();
                return;
            }
            if (type === 'essay_cont') {
                if (chipEssay) chipEssay.click();
                if (essayTypeSelect) essayTypeSelect.value = 'continuation';
                if (essayTopicInput) essayTopicInput.focus();
            }
        });
    });

    if (openSettingsBtn && chipMore) {
        openSettingsBtn.addEventListener('click', () => chipMore.click());
    }

    const requireApiKey = () => {
        if (!API_CONFIG || !API_CONFIG.apiKey) {
            showToast('API 未配置：请创建 config.js 或设置环境变量', 'error');
            return false;
        }
        return true;
    };

    const setBusy = (busy) => {
        const attachBtn = document.getElementById('attachBtn');
        [sendBtn, ocrStartBtn, essayGuidanceBtn, essayGradeBtn, attachBtn].forEach((el) => {
            if (!el) return;
            el.disabled = !!busy;
        });
        if (chatInput) chatInput.disabled = !!busy;
    };

    const runOcr = async () => {
        if (!requireApiKey()) return;
        if (!newSelectedImages.length) {
            showToast('请先点击 Attach 选择图片', 'error');
            return;
        }
        const model = ocrModelSelect ? ocrModelSelect.value : 'gemini-flash-lite-latest';
        addChatMessage({
            role: 'user',
            text: `OCR：${newSelectedImages.length} 张图片`
        });
        let finalText = '';
        const placeholder = addChatMessage({
            role: 'assistant',
            text: '识别中…',
            actions: [
                { label: '复制', onClick: () => copyText(finalText) },
                { label: '下载', onClick: () => downloadTextFile(finalText, `OCR_${new Date().toISOString().slice(0, 10)}.txt`) }
            ]
        });
        setBusy(true);
        try {
            const parts = [];
            for (let i = 0; i < newSelectedImages.length; i++) {
                const file = newSelectedImages[i];
                if (placeholder) placeholder.setText(`识别中…（${i + 1}/${newSelectedImages.length}）`);
                const base64 = await fileToBase64(file);
                const { text } = await callOCR(base64, model);
                const title = newSelectedImages.length > 1 ? `【${file.name}】\n` : '';
                parts.push(`${title}${text}`);
            }
            finalText = parts.join('\n\n---\n\n');
            const html = `<div style="white-space:pre-wrap;">${escapeHtml(finalText)}</div>`;
            if (placeholder) placeholder.setHtml(html);
            showToast('识别完成', 'success');
        } catch (e) {
            if (placeholder) placeholder.setText(`识别失败：${e.message || e}`);
            showToast('识别失败: ' + (e.message || e), 'error');
        } finally {
            setBusy(false);
        }
    };

    const runEssayGuidance = async () => {
        if (!requireApiKey()) return;
        const type = essayTypeSelect ? essayTypeSelect.value : 'application';
        const topic = (essayTopicInput ? essayTopicInput.value : '').trim();
        if (!topic) {
            showToast('请先填写题目/要求', 'error');
            return;
        }
        const model = textModelSelect ? textModelSelect.value : 'gemini-3-pro-preview';
        addChatMessage({ role: 'user', text: `写作思路：${topic}` });
        let finalText = '';
        const placeholder = addChatMessage({
            role: 'assistant',
            text: '生成中…',
            actions: [{ label: '复制', onClick: () => copyText(finalText) }]
        });
        setBusy(true);
        try {
            const result = type === 'continuation'
                ? await getContinuationGuidance(topic, model)
                : await getWritingGuidance(topic, model);
            finalText = result;
            const html = `<div style="white-space:pre-wrap;">${escapeHtml(finalText)}</div>`;
            if (placeholder) placeholder.setHtml(html);
            showToast('写作思路已生成', 'success');
        } catch (e) {
            if (placeholder) placeholder.setText(`生成失败：${e.message || e}`);
            showToast('生成失败: ' + (e.message || e), 'error');
        } finally {
            setBusy(false);
        }
    };

    const runEssayGrade = async () => {
        if (!requireApiKey()) return;
        const type = essayTypeSelect ? essayTypeSelect.value : 'application';
        const topic = (essayTopicInput ? essayTopicInput.value : '').trim();
        const essay = (essayTextInput ? essayTextInput.value : '').trim();
        const original = (essayOriginalInput ? essayOriginalInput.value : '').trim();
        const model = textModelSelect ? textModelSelect.value : 'gemini-3-pro-preview';

        if (!topic) {
            showToast('请先填写题目/要求', 'error');
            return;
        }

        if (type === 'application') {
            if (!essay) {
                await runEssayGuidance();
                return;
            }
            addChatMessage({ role: 'user', text: `批改应用文：${topic}` });
            let finalText = '';
            const placeholder = addChatMessage({
                role: 'assistant',
                text: '批改中…',
                actions: [
                    { label: '复制', onClick: () => copyText(finalText) },
                    { label: '下载', onClick: () => downloadTextFile(finalText, `应用文批改_${new Date().toISOString().slice(0, 10)}.txt`) }
                ]
            });
            setBusy(true);
            try {
                const raw = await gradeEssay(topic, essay, model);
                const data = parseJsonFromOutput(raw);
                if (!data) {
                    finalText = raw;
                    const html = `<div style="white-space:pre-wrap;">${escapeHtml(finalText)}</div>`;
                    if (placeholder) placeholder.setHtml(html);
                    return;
                }
                const html = formatApplicationGradingHtml(data);
                finalText = applicationGradingToText(data);
                if (placeholder) placeholder.setHtml(html);
                showToast('批改完成', 'success');
            } catch (e) {
                if (placeholder) placeholder.setText(`批改失败：${e.message || e}`);
                showToast('批改失败: ' + (e.message || e), 'error');
            } finally {
                setBusy(false);
            }
            return;
        }

        if (!essay) {
            await runEssayGuidance();
            return;
        }
        if (!original) {
            showToast('读后续写需要填写原文内容', 'error');
            return;
        }
        addChatMessage({ role: 'user', text: `批改读后续写：${topic}` });
        let finalText = '';
        const placeholder = addChatMessage({
            role: 'assistant',
            text: '批改中…',
            actions: [
                { label: '复制', onClick: () => copyText(finalText) },
                { label: '下载', onClick: () => downloadTextFile(finalText, `读后续写批改_${new Date().toISOString().slice(0, 10)}.txt`) }
            ]
        });
        setBusy(true);
        try {
            const raw = await gradeContinuation(topic, original, essay, model);
            const data = parseJsonFromOutput(raw);
            if (!data) {
                finalText = raw;
                const html = `<div style="white-space:pre-wrap;">${escapeHtml(finalText)}</div>`;
                if (placeholder) placeholder.setHtml(html);
                return;
            }
            const html = formatContinuationGradingHtml(data);
            finalText = continuationGradingToText(data);
            if (placeholder) placeholder.setHtml(html);
            showToast('批改完成', 'success');
        } catch (e) {
            if (placeholder) placeholder.setText(`批改失败：${e.message || e}`);
            showToast('批改失败: ' + (e.message || e), 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleSend = async () => {
        if (chipOcr && chipOcr.classList.contains('active')) {
            await runOcr();
            return;
        }
        if (chipEssay && chipEssay.classList.contains('active')) {
            await runEssayGrade();
            return;
        }
        if (chatInput && chatInput.value.trim()) {
            addChatMessage({ role: 'user', text: chatInput.value.trim() });
            addChatMessage({ role: 'assistant', text: '请选择 OCR 或 作文批改 工具继续。' });
            chatInput.value = '';
            return;
        }
        if (chipModel) chipModel.click();
        showToast('请选择一个工具', 'error');
    };

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
            }
        });
    }

    if (ocrStartBtn) ocrStartBtn.addEventListener('click', runOcr);
    if (ocrClearBtn) ocrClearBtn.addEventListener('click', () => {
        if (chatInput) chatInput.focus();
    });
    if (essayGuidanceBtn) essayGuidanceBtn.addEventListener('click', runEssayGuidance);
    if (essayGradeBtn) essayGradeBtn.addEventListener('click', runEssayGrade);

    const updateApiStatus = () => {
        const apiStatusText = document.getElementById('apiStatusText');
        if (!apiStatusText) return;
        apiStatusText.textContent = API_CONFIG && API_CONFIG.apiKey
            ? `API 已配置：${API_CONFIG.baseURL}`
            : 'API 未配置：请创建 config.js 或设置部署环境变量';
    };
    updateApiStatus();

    if (textModelSelect && !textModelSelect.value) {
        textModelSelect.value = 'gemini-3-pro-preview';
    }

    if (essayTypeSelect) essayTypeSelect.addEventListener('change', () => {
        const chip = chipEssay;
        if (chip && !chip.classList.contains('active')) chip.click();
    });
}

function initApp() {
    // ========== 模式切换 ==========
    const normalModeBtn = document.getElementById('normalModeBtn');
    const essayModeBtn = document.getElementById('essayModeBtn');
    const normalMode = document.getElementById('normalMode');
    const essayMode = document.getElementById('essayMode');
    
    normalModeBtn.addEventListener('click', () => {
        normalModeBtn.classList.add('active');
        essayModeBtn.classList.remove('active');
        normalMode.classList.remove('hidden');
        essayMode.classList.add('hidden');
    });
    
    essayModeBtn.addEventListener('click', () => {
        essayModeBtn.classList.add('active');
        normalModeBtn.classList.remove('active');
        essayMode.classList.remove('hidden');
        normalMode.classList.add('hidden');
    });
    
    // ========== 普通OCR模式 ==========
    initNormalMode();
    
    // ========== 英语作文模式 ==========
    initEssayMode();
    
    // ========== 读后续写模式 ==========
    initContinuationMode();
    
    // ========== 作文类型切换 ==========
    initEssayTypeTabs();
}

// ========================================
// 作文类型切换（应用文 vs 读后续写）
// ========================================
function initEssayTypeTabs() {
    const applicationBtn = document.getElementById('applicationBtn');
    const continuationBtn = document.getElementById('continuationBtn');
    const applicationSection = document.getElementById('applicationSection');
    const continuationSection = document.getElementById('continuationSection');
    
    if (applicationBtn && continuationBtn && applicationSection && continuationSection) {
        applicationBtn.addEventListener('click', () => {
            applicationBtn.classList.add('active');
            continuationBtn.classList.remove('active');
            applicationSection.classList.remove('hidden');
            continuationSection.classList.add('hidden');
        });
        
        continuationBtn.addEventListener('click', () => {
            continuationBtn.classList.add('active');
            applicationBtn.classList.remove('active');
            continuationSection.classList.remove('hidden');
            applicationSection.classList.add('hidden');
        });
    }
}

// ========================================
// 普通OCR模式
// ========================================
function initNormalMode() {
    const dropZone = document.getElementById('normalDropZone');
    const fileInput = document.getElementById('normalFileInput');
    const selectBtn = document.getElementById('normalSelectBtn');
    const modelSelect = document.getElementById('normalModelSelect');
    const progressDiv = document.getElementById('normalProgress');
    const progressBar = document.getElementById('normalProgressBar');
    const progressText = document.getElementById('normalProgressText');
    const resultDiv = document.getElementById('normalResult');
    const previewImg = document.getElementById('normalPreview');
    const extractedText = document.getElementById('normalExtractedText');
    const copyBtn = document.getElementById('normalCopyBtn');
    const downloadBtn = document.getElementById('normalDownloadBtn');
    const newBtn = document.getElementById('normalNewBtn');
    
    // 点击上传
    selectBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.closest('svg') || e.target.closest('h3') || e.target.closest('p')) {
            fileInput.click();
        }
    });
    
    // 文件选择
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleNormalOCR(file);
    });
    
    // 拖拽上传
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleNormalOCR(file);
    });
    
    // 复制按钮
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(extractedText.textContent).then(() => {
            showToast('已复制到剪贴板', 'success');
        });
    });
    
    // 下载按钮
    downloadBtn.addEventListener('click', () => {
        const text = extractedText.textContent;
        downloadTextFile(text, `OCR识别结果_${new Date().toISOString().slice(0, 10)}.txt`);
    });
    
    // 新文档按钮
    newBtn.addEventListener('click', () => {
        resultDiv.classList.add('hidden');
        fileInput.value = '';
        extractedText.textContent = '';
        previewImg.src = '';
        progressBar.style.width = '0%';
    });
    
    // 处理OCR
    async function handleNormalOCR(file) {
        if (!validateImageFile(file)) return;
        
        try {
            // 显示进度
            resultDiv.classList.add('hidden');
            progressDiv.classList.remove('hidden');
            
            // 模拟进度
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                progressBar.style.width = `${progress}%`;
                
                if (progress < 30) progressText.textContent = '准备中...';
                else if (progress < 60) progressText.textContent = '连接AI...';
                else progressText.textContent = '识别中...';
            }, 200);
            
            // 转换为base64
            const base64 = await fileToBase64(file);
            
            // 调用OCR
            const model = modelSelect.value;
            const result = await callOCR(base64, model);
            
            // 完成进度
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            progressText.textContent = '识别完成！';
            
            // 显示结果
            setTimeout(() => {
                progressDiv.classList.add('hidden');
                previewImg.src = base64;
                extractedText.textContent = result.text;
                resultDiv.classList.remove('hidden');
                showToast('识别成功', 'success');
            }, 500);
            
        } catch (error) {
            console.error('OCR失败:', error);
            progressDiv.classList.add('hidden');
            showToast('识别失败: ' + error.message, 'error');
        }
    }
}

// ========================================
// 英语作文模式
// ========================================
function initEssayMode() {
    const dropZone = document.getElementById('essayDropZone');
    const fileInput = document.getElementById('essayFileInput');
    const selectBtn = document.getElementById('essaySelectBtn');
    const imagePreviewList = document.getElementById('imagePreviewList');
    const startOcrBtn = document.getElementById('startOcrBtn');
    const ocrModel = document.getElementById('essayOcrModel');
    const progressDiv = document.getElementById('essayProgress');
    const progressBar = document.getElementById('essayProgressBar');
    const progressText = document.getElementById('essayProgressText');
    const progressCount = document.getElementById('essayProgressCount');
    const ocrResult = document.getElementById('essayOcrResult');
    
    // OCR结果区
    const ocrResultTextarea = document.getElementById('essayContent');
    const wordCount = document.getElementById('essayWordCount');
    const wordHint = document.getElementById('essayWordHint');
    const sendBtn = document.getElementById('sendToGradeBtn');
    const clearEssayBtn = document.getElementById('clearEssayBtn');
    const copyAllBtn = document.getElementById('copyAllBtn');
    
    // 批改区
    const gradingTopic = document.getElementById('gradingTopic');
    const gradingEssay = document.getElementById('gradingEssay');
    const gradingWordCount = document.getElementById('gradingWordCount');
    const gradingWordStatus = document.getElementById('gradingWordStatus');
    const gradingModel = document.getElementById('gradingModel');
    const startGradingBtn = document.getElementById('startGradingBtn');
    const getGuidanceBtn = document.getElementById('getGuidanceBtn');
    const gradingInput = document.getElementById('gradingInput');
    const gradingProgress = document.getElementById('gradingProgress');
    const gradingProgressBar = document.getElementById('gradingProgressBar');
    const gradingProgressText = document.getElementById('gradingProgressText');
    const gradingTimeEst = document.getElementById('gradingTimeEst');
    const gradingResult = document.getElementById('gradingResult');
    const gradingResultContent = document.getElementById('gradingResultContent');
    const totalScoreEl = document.getElementById('totalScore');
    const scoreStarsEl = document.getElementById('scoreStars');
    const contentScoreEl = document.getElementById('contentScore');
    const languageScoreEl = document.getElementById('languageScore');
    const structureScoreEl = document.getElementById('structureScore');
    const copyResultBtn = document.getElementById('copyResultBtn');
    const downloadResultBtn = document.getElementById('downloadResultBtn');
    const newGradingBtn = document.getElementById('newGradingBtn');
    
    // 写作思路区
    const guidanceResult = document.getElementById('guidanceResult');
    const guidanceContent = document.getElementById('guidanceContent');
    const copyGuidanceBtn = document.getElementById('copyGuidanceBtn');
    const downloadGuidanceBtn = document.getElementById('downloadGuidanceBtn');
    const newGuidanceBtn = document.getElementById('newGuidanceBtn');
    
    // ========== OCR部分 ==========
    
    // 点击上传
    selectBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.closest('svg') || e.target.closest('p')) {
            fileInput.click();
        }
    });
    
    // 文件选择（支持多选）
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            addImagesToList(files);
        }
    });
    
    // 拖拽
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            addImagesToList(files);
        }
    });
    
    // 添加图片到列表
    function addImagesToList(files) {
        const validFiles = files.filter(file => validateImageFile(file, false));
        
        validFiles.forEach(file => {
            uploadedImages.push(file);
        });
        
        updateImagePreviewList();
        
        if (uploadedImages.length > 0) {
            imagePreviewList.classList.remove('hidden');
            startOcrBtn.classList.remove('hidden');
        }
    }
    
    // 更新图片预览列表
    function updateImagePreviewList() {
        imagePreviewList.innerHTML = '';
        
        uploadedImages.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            
            const reader = new FileReader();
            reader.onload = (e) => {
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="预览">
                    <div class="info">
                        <div class="name">${file.name}</div>
                        <div class="size">${(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button class="remove-btn" data-index="${index}">删除</button>
                `;
                
                // 删除按钮
                previewItem.querySelector('.remove-btn').addEventListener('click', () => {
                    uploadedImages.splice(index, 1);
                    updateImagePreviewList();
                    
                    if (uploadedImages.length === 0) {
                        imagePreviewList.classList.add('hidden');
                        startOcrBtn.classList.add('hidden');
                    }
                });
            };
            reader.readAsDataURL(file);
            
            imagePreviewList.appendChild(previewItem);
        });
    }
    
    // 开始OCR识别
    startOcrBtn.addEventListener('click', async () => {
        if (uploadedImages.length === 0) return;
        
        try {
            // 隐藏上传区域，显示进度
            imagePreviewList.classList.add('hidden');
            startOcrBtn.classList.add('hidden');
            progressDiv.classList.remove('hidden');
            ocrResult.classList.add('hidden');
            
            ocrResults = [];
            const model = ocrModel.value;
            
            // 逐个识别图片
            for (let i = 0; i < uploadedImages.length; i++) {
                const file = uploadedImages[i];
                
                // 更新进度
                progressCount.textContent = `${i + 1}/${uploadedImages.length}`;
                progressText.textContent = `正在识别第 ${i + 1} 张图片...`;
                progressBar.style.width = `${((i) / uploadedImages.length) * 100}%`;
                
                // 转换为base64
                const base64 = await fileToBase64(file);
                
                // 调用OCR
                const result = await callEssayOCR(base64, model);
                ocrResults.push(result.text);
                
                // 更新进度
                progressBar.style.width = `${((i + 1) / uploadedImages.length) * 100}%`;
            }
            
            // 完成
            progressText.textContent = '识别完成！';
            
            // 合并所有识别结果
            const mergedText = ocrResults.join('\n\n---\n\n');
            
            setTimeout(() => {
                progressDiv.classList.add('hidden');
                
                // 全部显示在一个文本框中
                ocrResultTextarea.value = mergedText;
                updateWordCount(mergedText, wordCount, wordHint);
                sendBtn.disabled = !mergedText.trim();
                
                ocrResult.classList.remove('hidden');
                showToast(`成功识别 ${uploadedImages.length} 张图片`, 'success');
                
                // 清空图片列表
                uploadedImages = [];
                fileInput.value = '';
            }, 500);
            
        } catch (error) {
            console.error('OCR失败:', error);
            progressDiv.classList.add('hidden');
            imagePreviewList.classList.remove('hidden');
            startOcrBtn.classList.remove('hidden');
            showToast('识别失败: ' + error.message, 'error');
        }
    });
    
    // 全部复制按钮
    copyAllBtn.addEventListener('click', () => {
        const text = ocrResultTextarea.value;
        if (!text.trim()) {
            showToast('没有内容可复制', 'error');
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制全部内容到剪贴板', 'success');
        }).catch(() => {
            // 降级方案：选中文本
            ocrResultTextarea.select();
            showToast('请手动复制选中的文本', 'success');
        });
    });
    
    // 清空按钮
    clearEssayBtn.addEventListener('click', () => {
        ocrResultTextarea.value = '';
        wordCount.textContent = '字数: 0 词';
        wordHint.textContent = '建议: 80词左右';
        sendBtn.disabled = true;
    });
    
    // 字数统计
    ocrResultTextarea.addEventListener('input', () => {
        updateWordCount(ocrResultTextarea.value, wordCount, wordHint);
        sendBtn.disabled = !ocrResultTextarea.value.trim();
    });
    
    // 发送到批改区
    sendBtn.addEventListener('click', () => {
        const fullText = ocrResultTextarea.value;
        
        if (confirm('📤 发送到批改区\n\n识别结果将复制到作文框。\n请您手动将题目部分复制到"题目要求"框中。\n\n点击确定继续。')) {
            gradingTopic.value = '';
            gradingEssay.value = fullText;
            
            const count = countWords(gradingEssay.value);
            gradingWordCount.textContent = count;
            
            // 更新字数状态
            gradingEssay.dispatchEvent(new Event('input'));
            
            // 滚动到批改区
            document.querySelector('#gradingInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast('已发送！请将题目部分复制到"题目要求"框', 'success');
        }
    });
    
    // ========== 批改区部分 ==========
    
    // 批改区字数统计
    gradingEssay.addEventListener('input', () => {
        const count = countWords(gradingEssay.value);
        gradingWordCount.textContent = count;
        
        // 字数状态提示
        if (count === 0) {
            gradingWordStatus.textContent = '';
            gradingWordStatus.className = 'text-xs';
        } else if (count >= 60 && count <= 100) {
            gradingWordStatus.textContent = '✅ 字数合适';
            gradingWordStatus.className = 'text-xs word-count-good';
        } else if (count < 60) {
            gradingWordStatus.textContent = `⚠️ 偏少 (建议60-100词)`;
            gradingWordStatus.className = 'text-xs word-count-warning';
        } else if (count > 100) {
            gradingWordStatus.textContent = `⚠️ 偏多 (建议60-100词)`;
            gradingWordStatus.className = 'text-xs word-count-warning';
        }
        
        updateGradingButtons();
    });
    
    gradingTopic.addEventListener('input', () => {
        updateGradingButtons();
    });
    
    // 更新按钮状态
    function updateGradingButtons() {
        const hasTopic = gradingTopic.value.trim().length > 0;
        const hasEssay = gradingEssay.value.trim().length > 0;
        
        // 只有题目：可以获取思路
        getGuidanceBtn.disabled = !hasTopic;
        
        // 题目+作文：可以批改
        startGradingBtn.disabled = !hasTopic || !hasEssay;
    }
    
    // 获取写作思路
    getGuidanceBtn.addEventListener('click', async () => {
        try {
            gradingInput.classList.add('hidden');
            gradingProgress.classList.remove('hidden');
            gradingResult.classList.add('hidden');
            guidanceResult.classList.add('hidden');
            
            const topic = gradingTopic.value;
            const model = gradingModel.value;
            
            // 进度提示
            gradingProgressText.textContent = 'AI正在分析题目...';
            gradingTimeEst.textContent = '预计需要 8-12 秒';
            
            // 模拟进度
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress > 90) progress = 90;
                gradingProgressBar.style.width = `${progress}%`;
                
                if (progress < 40) {
                    gradingProgressText.textContent = 'AI正在分析题目...';
                } else if (progress < 70) {
                    gradingProgressText.textContent = 'AI正在构思写作框架...';
                } else {
                    gradingProgressText.textContent = 'AI正在生成范文示例...';
                }
            }, 400);
            
            const result = await getWritingGuidance(topic, model);
            
            clearInterval(progressInterval);
            gradingProgressBar.style.width = '100%';
            gradingProgressText.textContent = '思路生成完成！';
            
            setTimeout(() => {
                gradingProgress.classList.add('hidden');
                displayGuidanceResult(result);
                guidanceResult.classList.remove('hidden');
                showToast('写作思路已生成', 'success');
            }, 500);
            
        } catch (error) {
            console.error('思路生成失败:', error);
            gradingProgress.classList.add('hidden');
            gradingInput.classList.remove('hidden');
            showToast('思路生成失败: ' + error.message, 'error');
        }
    });
    
    // 开始批改
    startGradingBtn.addEventListener('click', async () => {
        try {
            gradingInput.classList.add('hidden');
            gradingProgress.classList.remove('hidden');
            gradingResult.classList.add('hidden');
            guidanceResult.classList.add('hidden');
            
            const topic = gradingTopic.value;
            const essay = gradingEssay.value;
            const model = gradingModel.value;
            
            // 根据模型估算时间
            let estimatedTime = '10-15 秒';
            if (model === 'GPT-OSS-120B') {
                estimatedTime = '5-10 秒';
            } else if (model === 'enterprise-gemini-2.5-pro') {
                estimatedTime = '15-20 秒';
            }
            gradingTimeEst.textContent = `预计需要 ${estimatedTime}`;
            
            // 模拟进度条
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 8;
                if (progress > 90) progress = 90;
                gradingProgressBar.style.width = `${progress}%`;
                
                if (progress < 30) {
                    gradingProgressText.textContent = 'AI正在阅读作文...';
                } else if (progress < 60) {
                    gradingProgressText.textContent = 'AI正在分析语法和用词...';
                } else {
                    gradingProgressText.textContent = 'AI正在生成批改报告...';
                }
            }, 500);
            
            const result = await gradeEssay(topic, essay, model);
            
            clearInterval(progressInterval);
            gradingProgressBar.style.width = '100%';
            gradingProgressText.textContent = '批改完成！';
            
            setTimeout(() => {
                gradingProgress.classList.add('hidden');
                displayGradingResult(result);
                gradingResult.classList.remove('hidden');
                showToast('批改完成', 'success');
            }, 500);
            
        } catch (error) {
            console.error('批改失败:', error);
            gradingProgress.classList.add('hidden');
            gradingInput.classList.remove('hidden');
            showToast('批改失败: ' + error.message, 'error');
        }
    });
    
    // 显示批改结果
    function displayGradingResult(result) {
        let data;
        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('无法解析JSON');
            }
        } catch (e) {
            console.error('JSON解析失败:', e);
            data = {
                totalScore: 0,
                scores: { content: 0, language: 0, structure: 0 },
                contentReview: '批改结果解析失败，请重试',
                highlights: ['无法解析'],
                problems: ['无法解析'],
                suggestions: '请重试',
                modelAnswer: '无',
                tips: '请重试'
            };
        }
        
        // 更新总分
        totalScoreEl.textContent = `${data.totalScore}/15`;
        
        // 更新星级
        const stars = Math.round((data.totalScore / 15) * 5);
        scoreStarsEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
        
        // 更新分项得分
        contentScoreEl.textContent = `${data.scores.content}/5`;
        languageScoreEl.textContent = `${data.scores.language}/7`;
        structureScoreEl.textContent = `${data.scores.structure}/3`;
        
        // 构建详细批改卡片
        gradingResultContent.innerHTML = `
            <div class="grading-card">
                <h4>✅ 内容点评</h4>
                <div class="content">${data.contentReview}</div>
            </div>
            
            <div class="grading-card">
                <h4>✨ 语言亮点</h4>
                <div class="content">
                    <ul>
                        ${data.highlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="grading-card">
                <h4>⚠️ 存在问题</h4>
                <div class="content">
                    <ul>
                        ${data.problems.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="grading-card">
                <h4>💡 改进建议</h4>
                <div class="content">${data.suggestions}</div>
            </div>
            
            <div class="grading-card model-answer-card">
                <h4>📖 范文参考（约80词）</h4>
                <div class="content">${data.modelAnswer}</div>
            </div>
            
            <div class="grading-card">
                <h4>🎯 提分秘诀</h4>
                <div class="content">${data.tips}</div>
            </div>
        `;
    }
    
    // 显示写作思路
    function displayGuidanceResult(result) {
        // 将Markdown格式的文本转换为分块卡片
        const sections = result.split(/\n(?=\d\.\s\*\*)/);
        
        const htmlContent = sections.map(section => {
            if (!section.trim()) return '';
            
            const titleMatch = section.match(/\*\*(.*?)\*\*/);
            const title = titleMatch ? titleMatch[1] : '详情';
            
            let content = section.replace(/\d\.\s\*\*(.*?)\*\*\n?/, '').trim();
            
            // 进一步处理内容中的Markdown
            content = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 加粗
                .replace(/-\s(.*?)(?=\n-|\n\n|$)/g, '<p class="mb-1 ml-4">&bull; $1</p>') // 列表项
                .replace(/\n/g, '<br>'); // 换行

            return `
                <div class="grading-card">
                    <h4>${title}</h4>
                    <div class="content">${content}</div>
                </div>
            `;
        }).join('');

        guidanceContent.innerHTML = htmlContent;
    }
    
    // 批改结果按钮
    copyResultBtn.addEventListener('click', () => {
        const text = gradingResultContent.innerText;
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制到剪贴板', 'success');
        });
    });
    
    downloadResultBtn.addEventListener('click', () => {
        const totalScore = totalScoreEl.textContent;
        const text = `
英语作文批改报告
==================

总分：${totalScore}

${gradingResultContent.innerText}

批改时间：${new Date().toLocaleString('zh-CN')}
        `.trim();
        
        downloadTextFile(text, `作文批改报告_${new Date().toISOString().slice(0, 10)}.txt`);
    });
    
    newGradingBtn.addEventListener('click', () => {
        gradingResult.classList.add('hidden');
        gradingInput.classList.remove('hidden');
        gradingTopic.value = '';
        gradingEssay.value = '';
        gradingWordCount.textContent = '0';
        gradingWordStatus.textContent = '';
        updateGradingButtons();
        gradingProgressBar.style.width = '0%';
    });
    
    // 写作思路按钮
    copyGuidanceBtn.addEventListener('click', () => {
        const text = guidanceContent.innerText;
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制到剪贴板', 'success');
        });
    });
    
    downloadGuidanceBtn.addEventListener('click', () => {
        const text = `
写作思路指导
==================

${guidanceContent.innerText}

生成时间：${new Date().toLocaleString('zh-CN')}
        `.trim();
        
        downloadTextFile(text, `写作思路_${new Date().toISOString().slice(0, 10)}.txt`);
    });
    
    newGuidanceBtn.addEventListener('click', () => {
        guidanceResult.classList.add('hidden');
        gradingInput.classList.remove('hidden');
        gradingProgressBar.style.width = '0%';
    });
}

// ========================================
// 读后续写模式
// ========================================
function initContinuationMode() {
    const dropZone = document.getElementById('continuationDropZone');
    const fileInput = document.getElementById('continuationFileInput');
    const selectBtn = document.getElementById('continuationSelectBtn');
    const imagePreviewList = document.getElementById('continuationImagePreviewList');
    const startOcrBtn = document.getElementById('startContinuationOcrBtn');
    const ocrModel = document.getElementById('continuationOcrModel');
    const progressDiv = document.getElementById('continuationProgress');
    const progressBar = document.getElementById('continuationProgressBar');
    const progressText = document.getElementById('continuationProgressText');
    const progressCount = document.getElementById('continuationProgressCount');
    const ocrResult = document.getElementById('continuationOcrResult');
    
    // OCR结果区
    const topicTextarea = document.getElementById('continuationTopic');
    const originalTextarea = document.getElementById('continuationOriginal');
    const contentTextarea = document.getElementById('continuationContent');
    const wordCount = document.getElementById('continuationWordCount');
    const wordHint = document.getElementById('continuationWordHint');
    const sendBtn = document.getElementById('sendToContinuationGradeBtn');
    
    // 批改区
    const gradingTopic = document.getElementById('continuationGradingTopic');
    const gradingOriginal = document.getElementById('continuationGradingOriginal');
    const gradingContent = document.getElementById('continuationGradingContent');
    const gradingWordCount = document.getElementById('continuationGradingWordCount');
    const gradingWordStatus = document.getElementById('continuationGradingWordStatus');
    const gradingModel = document.getElementById('continuationGradingModel');
    const startGradingBtn = document.getElementById('startContinuationGradingBtn');
    const getGuidanceBtn = document.getElementById('getContinuationGuidanceBtn');
    const gradingInput = document.getElementById('continuationGradingInput');
    const gradingProgress = document.getElementById('continuationGradingProgress');
    const gradingProgressBar = document.getElementById('continuationGradingProgressBar');
    const gradingProgressText = document.getElementById('continuationGradingProgressText');
    const gradingTimeEst = document.getElementById('continuationGradingTimeEst');
    const gradingResult = document.getElementById('continuationGradingResult');
    const gradingResultContent = document.getElementById('continuationGradingResultContent');
    const totalScoreEl = document.getElementById('continuationTotalScore');
    const scoreStarsEl = document.getElementById('continuationScoreStars');
    const contentScoreEl = document.getElementById('continuationContentScore');
    const languageScoreEl = document.getElementById('continuationLanguageScore');
    const structureScoreEl = document.getElementById('continuationStructureScore');
    const normScoreEl = document.getElementById('continuationNormScore');
    const copyResultBtn = document.getElementById('copyContinuationResultBtn');
    const downloadResultBtn = document.getElementById('downloadContinuationResultBtn');
    const newGradingBtn = document.getElementById('newContinuationGradingBtn');
    
    // ========== OCR部分 ==========
    
    // 点击上传
    selectBtn.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.closest('svg') || e.target.closest('p')) {
            fileInput.click();
        }
    });
    
    // 文件选择（支持多选）
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            addImagesToList(files);
        }
    });
    
    // 拖拽
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            addImagesToList(files);
        }
    });
    
    // 添加图片到列表
    let continuationImages = [];
    function addImagesToList(files) {
        const validFiles = files.filter(file => validateImageFile(file, false));
        
        validFiles.forEach(file => {
            continuationImages.push(file);
        });
        
        updateImagePreviewList();
        
        if (continuationImages.length > 0) {
            imagePreviewList.classList.remove('hidden');
            startOcrBtn.classList.remove('hidden');
        }
    }
    
    // 更新图片预览列表
    function updateImagePreviewList() {
        imagePreviewList.innerHTML = '';
        
        continuationImages.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            
            const reader = new FileReader();
            reader.onload = (e) => {
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="预览">
                    <div class="info">
                        <div class="name">${file.name}</div>
                        <div class="size">${(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button class="remove-btn" data-index="${index}">删除</button>
                `;
                
                // 删除按钮
                previewItem.querySelector('.remove-btn').addEventListener('click', () => {
                    continuationImages.splice(index, 1);
                    updateImagePreviewList();
                    
                    if (continuationImages.length === 0) {
                        imagePreviewList.classList.add('hidden');
                        startOcrBtn.classList.add('hidden');
                    }
                });
            };
            reader.readAsDataURL(file);
            
            imagePreviewList.appendChild(previewItem);
        });
    }
    
    // 开始OCR识别
    startOcrBtn.addEventListener('click', async () => {
        if (continuationImages.length === 0) return;
        
        try {
            // 隐藏上传区域，显示进度
            imagePreviewList.classList.add('hidden');
            startOcrBtn.classList.add('hidden');
            progressDiv.classList.remove('hidden');
            ocrResult.classList.add('hidden');
            
            const ocrResults = [];
            const model = ocrModel.value;
            
            // 逐个识别图片
            for (let i = 0; i < continuationImages.length; i++) {
                const file = continuationImages[i];
                
                // 更新进度
                progressCount.textContent = `${i + 1}/${continuationImages.length}`;
                progressText.textContent = `正在识别第 ${i + 1} 张图片...`;
                progressBar.style.width = `${((i) / continuationImages.length) * 100}%`;
                
                // 转换为base64
                const base64 = await fileToBase64(file);
                
                // 调用OCR
                const result = await callEssayOCR(base64, model);
                ocrResults.push(result.text);
                
                // 更新进度
                progressBar.style.width = `${((i + 1) / continuationImages.length) * 100}%`;
            }
            
            // 完成
            progressText.textContent = '识别完成！';
            
            setTimeout(() => {
                progressDiv.classList.add('hidden');
                
                // 分别显示在三个文本框中
                if (ocrResults.length >= 1) topicTextarea.value = ocrResults[0];
                if (ocrResults.length >= 2) originalTextarea.value = ocrResults[1];
                if (ocrResults.length >= 3) contentTextarea.value = ocrResults[2];
                
                // 更新字数统计
                updateWordCount(contentTextarea.value, wordCount, wordHint);
                sendBtn.disabled = !contentTextarea.value.trim();
                
                ocrResult.classList.remove('hidden');
                showToast(`成功识别 ${continuationImages.length} 张图片`, 'success');
                
                // 清空图片列表
                continuationImages = [];
                fileInput.value = '';
            }, 500);
            
        } catch (error) {
            console.error('OCR失败:', error);
            progressDiv.classList.add('hidden');
            imagePreviewList.classList.remove('hidden');
            startOcrBtn.classList.remove('hidden');
            showToast('识别失败: ' + error.message, 'error');
        }
    });
    
    // 字数统计
    contentTextarea.addEventListener('input', () => {
        updateWordCount(contentTextarea.value, wordCount, wordHint);
        sendBtn.disabled = !contentTextarea.value.trim();
    });
    
    // 发送到批改区
    sendBtn.addEventListener('click', () => {
        if (confirm('📤 发送到批改区\n\n识别结果将复制到批改区。\n\n点击确定继续。')) {
            gradingTopic.value = topicTextarea.value;
            gradingOriginal.value = originalTextarea.value;
            gradingContent.value = contentTextarea.value;
            
            const count = countWords(gradingContent.value);
            gradingWordCount.textContent = count;
            
            // 更新字数状态
            gradingContent.dispatchEvent(new Event('input'));
            
            // 滚动到批改区
            document.querySelector('#continuationGradingInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast('已发送到批改区', 'success');
        }
    });
    
    // ========== 批改区部分 ==========
    
    // 批改区字数统计
    gradingContent.addEventListener('input', () => {
        const count = countWords(gradingContent.value);
        gradingWordCount.textContent = count;
        
        // 字数状态提示
        if (count === 0) {
            gradingWordStatus.textContent = '';
            gradingWordStatus.className = 'text-xs';
        } else if (count >= 130) {
            gradingWordStatus.textContent = '✅ 字数合适';
            gradingWordStatus.className = 'text-xs word-count-good';
        } else {
            gradingWordStatus.textContent = `⚠️ 还需约 ${130 - count} 词`;
            gradingWordStatus.className = 'text-xs word-count-warning';
        }
        
        updateGradingButtons();
    });
    
    gradingTopic.addEventListener('input', () => {
        updateGradingButtons();
    });
    
    // 更新按钮状态
    function updateGradingButtons() {
        const hasTopic = gradingTopic.value.trim().length > 0;
        const hasContent = gradingContent.value.trim().length > 0;
        
        // 只有题目：可以获取思路
        getGuidanceBtn.disabled = !hasTopic;
        
        // 题目+续写：可以批改
        startGradingBtn.disabled = !hasTopic || !hasContent;
    }
    
    // 获取写作思路
    getGuidanceBtn.addEventListener('click', async () => {
        try {
            gradingInput.classList.add('hidden');
            gradingProgress.classList.remove('hidden');
            gradingResult.classList.add('hidden');
            
            const topic = gradingTopic.value;
            const model = gradingModel.value;
            
            // 进度提示
            gradingProgressText.textContent = 'AI正在分析题目...';
            gradingTimeEst.textContent = '预计需要 10-15 秒';
            
            // 模拟进度
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 10;
                if (progress > 90) progress = 90;
                gradingProgressBar.style.width = `${progress}%`;
                
                if (progress < 40) {
                    gradingProgressText.textContent = 'AI正在分析题目...';
                } else if (progress < 70) {
                    gradingProgressText.textContent = 'AI正在构思故事框架...';
                } else {
                    gradingProgressText.textContent = 'AI正在生成范文示例...';
                }
            }, 400);
            
            const result = await getContinuationGuidance(topic, model);
            
            clearInterval(progressInterval);
            gradingProgressBar.style.width = '100%';
            gradingProgressText.textContent = '思路生成完成！';
            
            setTimeout(() => {
                gradingProgress.classList.add('hidden');
                displayGuidanceResult(result);
                gradingResult.classList.remove('hidden');
                showToast('写作思路已生成', 'success');
            }, 500);
            
        } catch (error) {
            console.error('思路生成失败:', error);
            gradingProgress.classList.add('hidden');
            gradingInput.classList.remove('hidden');
            showToast('思路生成失败: ' + error.message, 'error');
        }
    });
    
    // 开始批改
    startGradingBtn.addEventListener('click', async () => {
        try {
            gradingInput.classList.add('hidden');
            gradingProgress.classList.remove('hidden');
            gradingResult.classList.add('hidden');
            
            const topic = gradingTopic.value;
            const original = gradingOriginal.value;
            const content = gradingContent.value;
            const model = gradingModel.value;
            
            gradingTimeEst.textContent = '预计需要 15-20 秒';
            
            // 模拟进度条
            let progress = 0;
            const progressInterval = setInterval(() => {
                progress += Math.random() * 8;
                if (progress > 90) progress = 90;
                gradingProgressBar.style.width = `${progress}%`;
                
                if (progress < 30) {
                    gradingProgressText.textContent = 'AI正在阅读原文...';
                } else if (progress < 60) {
                    gradingProgressText.textContent = 'AI正在分析续写内容...';
                } else {
                    gradingProgressText.textContent = 'AI正在生成批改报告...';
                }
            }, 500);
            
            const result = await gradeContinuation(topic, original, content, model);
            
            clearInterval(progressInterval);
            gradingProgressBar.style.width = '100%';
            gradingProgressText.textContent = '批改完成！';
            
            setTimeout(() => {
                gradingProgress.classList.add('hidden');
                displayGradingResult(result);
                gradingResult.classList.remove('hidden');
                showToast('批改完成', 'success');
            }, 500);
            
        } catch (error) {
            console.error('批改失败:', error);
            gradingProgress.classList.add('hidden');
            gradingInput.classList.remove('hidden');
            showToast('批改失败: ' + error.message, 'error');
        }
    });
    
    // 显示批改结果
    function displayGradingResult(result) {
        let data;
        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('无法解析JSON');
            }
        } catch (e) {
            console.error('JSON解析失败:', e);
            data = {
                totalScore: 0,
                scores: { content: 0, language: 0, structure: 0, norm: 0 },
                contentReview: '批改结果解析失败，请重试',
                highlights: ['无法解析'],
                problems: ['无法解析'],
                suggestions: '请重试',
                modelAnswer: '无',
                tips: '请重试'
            };
        }
        
        // 更新总分
        totalScoreEl.textContent = `${data.totalScore}/25`;
        
        // 更新星级
        const stars = Math.round((data.totalScore / 25) * 5);
        scoreStarsEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
        
        // 更新分项得分
        contentScoreEl.textContent = `${data.scores.content}/8`;
        languageScoreEl.textContent = `${data.scores.language}/8`;
        structureScoreEl.textContent = `${data.scores.structure}/5`;
        normScoreEl.textContent = `${data.scores.norm}/4`;
        
        // 构建详细批改卡片
        gradingResultContent.innerHTML = `
            <div class="grading-card">
                <h4>✅ 内容点评</h4>
                <div class="content">${data.contentReview}</div>
            </div>
            
            <div class="grading-card">
                <h4>✨ 语言亮点</h4>
                <div class="content">
                    <ul>
                        ${data.highlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="grading-card">
                <h4>⚠️ 存在问题</h4>
                <div class="content">
                    <ul>
                        ${data.problems.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <div class="grading-card">
                <h4>💡 改进建议</h4>
                <div class="content">${data.suggestions}</div>
            </div>
            
            <div class="grading-card model-answer-card">
                <h4>📖 范文参考（约130词）</h4>
                <div class="content">${data.modelAnswer}</div>
            </div>
            
            <div class="grading-card">
                <h4>🎯 提分秘诀</h4>
                <div class="content">${data.tips}</div>
            </div>
        `;
    }
    
    // 显示写作思路
    function displayGuidanceResult(result) {
        // 将Markdown格式的文本转换为分块卡片
        const sections = result.split(/\n(?=\d\.\s\*\*)/);
        
        const htmlContent = sections.map(section => {
            if (!section.trim()) return '';
            
            const titleMatch = section.match(/\*\*(.*?)\*\*/);
            const title = titleMatch ? titleMatch[1] : '详情';
            
            let content = section.replace(/\d\.\s\*\*(.*?)\*\*\n?/, '').trim();
            
            // 进一步处理内容中的Markdown
            content = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // 加粗
                .replace(/-\s(.*?)(?=\n-|\n\n|$)/g, '<p class="mb-1 ml-4">&bull; $1</p>') // 列表项
                .replace(/\n/g, '<br>'); // 换行

            return `
                <div class="grading-card">
                    <h4>${title}</h4>
                    <div class="content">${content}</div>
                </div>
            `;
        }).join('');

        gradingResult.innerHTML = htmlContent;
    }
    
    // 批改结果按钮
    copyResultBtn.addEventListener('click', () => {
        const text = gradingResultContent.innerText;
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制到剪贴板', 'success');
        });
    });
    
    downloadResultBtn.addEventListener('click', () => {
        const totalScore = totalScoreEl.textContent;
        const text = `
英语读后续写批改报告

总分：${totalScore}

${gradingResultContent.innerText}

批改时间：${new Date().toLocaleString('zh-CN')}
        `.trim();
        
        downloadTextFile(text, `读后续写批改报告_${new Date().toISOString().slice(0, 10)}.txt`);
    });
    
    newGradingBtn.addEventListener('click', () => {
        gradingResult.classList.add('hidden');
        gradingInput.classList.remove('hidden');
        gradingTopic.value = '';
        gradingOriginal.value = '';
        gradingContent.value = '';
        gradingWordCount.textContent = '0';
        gradingWordStatus.textContent = '';
        updateGradingButtons();
        gradingProgressBar.style.width = '0%';
    });
}

// ========================================
// API调用函数
// ========================================

// 普通OCR
async function callOCR(imageBase64, model, apiKey = null) {
    const finalApiKey = apiKey || API_CONFIG.apiKey;
    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${finalApiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `请识别这张图片中的所有文字内容。要求：
1. 准确识别所有文字（中文、英文、数字、符号）
2. 保持原有格式和布局
3. 如果是表格，保持表格结构
4. 只输出识别的文字，不要添加任何解释

直接输出识别结果：`
                    },
                    {
                        type: "image_url",
                        image_url: { url: imageBase64 }
                    }
                ]
            }],
            max_tokens: 4000,
            temperature: 0.1
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return {
        text: data.choices[0].message.content.trim(),
        model: model
    };
}

// 作文OCR
async function callEssayOCR(imageBase64, model, apiKey = null) {
    const finalApiKey = apiKey || API_CONFIG.apiKey;
    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${finalApiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `请识别这张英语作文图片中的所有文字。这可能是高考英语应用文作文的题目要求或学生手写作文。

要求：
1. 准确识别所有英文内容（可能有手写体）
2. 保持拼写原样（即使有错误）
3. 保持段落和换行结构
4. 只输出识别的文字，不要添加评论

直接输出识别的文字：`
                    },
                    {
                        type: "image_url",
                        image_url: { url: imageBase64 }
                    }
                ]
            }],
            max_tokens: 4000,
            temperature: 0.1
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return {
        text: data.choices[0].message.content.trim(),
        model: model
    };
}

// 批改作文
async function gradeEssay(topic, essay, model) {
    const prompt = APPLICATION_GRADING_PROMPT
        .replace('{TOPIC}', topic)
        .replace('{ESSAY}', essay);
    
    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{
                role: "user",
                content: prompt
            }],
            max_tokens: 4000,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// 获取写作思路
async function getWritingGuidance(topic, model) {
    const prompt = WRITING_GUIDANCE_PROMPT.replace('{TOPIC}', topic);
    
    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{
                role: "user",
                content: prompt
            }],
            max_tokens: 3000,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// 批改读后续写
async function gradeContinuation(topic, original, content, model) {
    const prompt = CONTINUATION_GRADING_PROMPT
        .replace('{TOPIC}', topic)
        .replace('{ORIGINAL}', original)
        .replace('{CONTINUATION}', content);
    
    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{
                role: "user",
                content: prompt
            }],
            max_tokens: 4000,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// 获取读后续写思路指导
async function getContinuationGuidance(topic, model) {
    const prompt = CONTINUATION_GUIDANCE_PROMPT.replace('{TOPIC}', topic);
    
    const response = await fetch(`${API_CONFIG.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{
                role: "user",
                content: prompt
            }],
            max_tokens: 3000,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error?.message || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// ========================================
// 工具函数
// ========================================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function validateImageFile(file, showError = true) {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        if (showError) showToast('请选择图片文件 (JPG, PNG, WebP)', 'error');
        return false;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        if (showError) showToast('文件大小不能超过10MB', 'error');
        return false;
    }
    
    return true;
}

function countWords(text) {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
}

function updateWordCount(text, countEl, hintEl) {
    const count = countWords(text);
    countEl.textContent = `字数: ${count} 词`;
    
    if (count === 0) {
        hintEl.textContent = '建议: 80词左右';
        hintEl.className = 'text-xs text-[#3A3632] opacity-60';
    } else if (count >= 60 && count <= 100) {
        hintEl.textContent = '✅ 字数合适';
        hintEl.className = 'text-xs word-count-good';
    } else if (count < 60) {
        hintEl.textContent = `⚠️ 还需约 ${60 - count} 词`;
        hintEl.className = 'text-xs word-count-warning';
    } else if (count > 100) {
        hintEl.textContent = `⚠️ 超出约 ${count - 100} 词`;
        hintEl.className = 'text-xs word-count-warning';
    }
}

function downloadTextFile(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = type === 'success' ? 'success-toast' : 'error-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

})();
