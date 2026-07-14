// script.js

(function () {

// ========================================
// API端点
// ========================================

const OCR_ENDPOINT = window.NETLIFY_CONFIG?.ocrEndpoint || '/.netlify/functions/vision-ocr';
const TEXT_MODEL_ENDPOINT = window.NETLIFY_CONFIG?.textModelEndpoint || '/.netlify/functions/chat-completion';

console.log('API配置状态:', {
    ocrEndpoint: OCR_ENDPOINT,
    textModelEndpoint: TEXT_MODEL_ENDPOINT
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
  "tips": "提分秘诀文字...",
  "rubricEvidence": ["评分依据1", "评分依据2"],
  "missingRequirements": ["缺失要点；没有则写‘无’"],
  "confidence": "高/中/低，并用一句话说明原因",
  "revisionTasks": [{"original":"需要改的原句或内容","issue":"具体问题","suggestion":"建议如何改","reason":"为什么这样改","practice":"本次练习目标"}]
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
5. rubricEvidence 至少列出2条能在学生作文中找到的具体依据；missingRequirements 没有时返回 ["无"]
6. revisionTasks 返回 2-3 项，优先选择最影响得分的问题；每项字段都必须填写
7. 请确保输出是有效的JSON格式

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
  "tips": "提分秘诀文字...",
  "rubricEvidence": ["评分依据1", "评分依据2"],
  "missingRequirements": ["缺失要点；没有则写‘无’"],
  "confidence": "高/中/低，并用一句话说明原因",
  "revisionTasks": [{"original":"需要改的原句或内容","issue":"具体问题","suggestion":"建议如何改","reason":"为什么这样改","practice":"本次练习目标"}]
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
5. rubricEvidence 至少列出2条能在学生续写或原文中找到的具体依据；missingRequirements 没有时返回 ["无"]
6. revisionTasks 返回 2-3 项，优先选择最影响得分的问题；每项字段都必须填写
7. 请确保输出是有效的JSON格式

请开始批改：`;

// 读后续写思路指导提示词
const CONTINUATION_GUIDANCE_PROMPT = `你是一名精通中国高考英语读后续写写作指导的老师。

学生向你提供了以下读后续写材料：

【题目要求】
{TOPIC}

【原文内容】
{ORIGINAL}

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
let uploadedImages = []; // 存储上传文件及手动分区
let ocrResults = []; // 存储OCR结果
const OCR_SPLIT_MODEL = 'gemini-3.5-flash';
const APPLICATION_OCR_ROLE_OPTIONS = [
    { value: 'topic', label: '题目' },
    { value: 'essay', label: '作文' }
];
const CONTINUATION_OCR_ROLE_OPTIONS = [
    { value: 'topic', label: '题目' },
    { value: 'original', label: '原文' },
    { value: 'continuation', label: '续写' }
];

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    initStudentExperience();
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
    const ocrTopicTextarea = document.getElementById('essayOcrTopic');
    const ocrResultTextarea = document.getElementById('essayContent');
    const rawOcrTextarea = document.getElementById('essayRawOcrText');
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
        const validFiles = files.filter(file => validateOcrFile(file, false));

        validFiles.forEach(file => {
            uploadedImages.push({
                file,
                roles: uploadedImages.length === 0 ? ['topic'] : ['essay']
            });
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

        uploadedImages.forEach((item, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            renderFilePreviewItem(previewItem, item, {
                roleOptions: APPLICATION_OCR_ROLE_OPTIONS,
                onRoleChange: (role) => {
                    uploadedImages[index].roles = toggleFileRole(uploadedImages[index].roles, role);
                    updateImagePreviewList();
                }
            });
            previewItem.querySelector('.remove-btn').addEventListener('click', () => {
                uploadedImages.splice(index, 1);
                updateImagePreviewList();

                if (uploadedImages.length === 0) {
                    imagePreviewList.classList.add('hidden');
                    startOcrBtn.classList.add('hidden');
                }
            });
            imagePreviewList.appendChild(previewItem);
        });
    }

    // 开始OCR识别
    startOcrBtn.addEventListener('click', async () => {
        if (uploadedImages.length === 0) return;

        try {
            // 隐藏上传区域，显示进度
            dropZone.classList.add('hidden');
            imagePreviewList.classList.add('hidden');
            startOcrBtn.classList.add('hidden');
            progressDiv.classList.remove('hidden');
            ocrResult.classList.add('hidden');

            ocrResults = [];
            const model = ocrModel.value;

            // 逐个识别文件，单个失败不影响其他文件
            for (let i = 0; i < uploadedImages.length; i++) {
                const item = uploadedImages[i];
                const file = item.file;

                progressCount.textContent = `${i + 1}/${uploadedImages.length}`;
                progressText.textContent = `正在识别第 ${i + 1} 个文件...`;
                progressBar.style.width = `${(i / uploadedImages.length) * 100}%`;

                try {
                    const result = await callEssayOCR(file, model);
                    ocrResults.push({
                        ok: true,
                        roles: normalizeRoles(item.roles),
                        text: result.text,
                        fileName: result.fileName || file.name
                    });
                } catch (error) {
                    console.warn('单个文件OCR失败:', file.name, error);
                    ocrResults.push({
                        ok: false,
                        roles: normalizeRoles(item.roles),
                        text: '',
                        fileName: file.name,
                        error: error.message
                    });
                }

                progressBar.style.width = `${((i + 1) / uploadedImages.length) * 100}%`;
            }

            const successCount = ocrResults.filter(result => result.ok).length;
            if (successCount === 0) {
                throw new Error('所有文件都识别失败，请检查图片清晰度或稍后重试');
            }

            progressText.textContent = '正在按多选标签整理题目和作文...';

            const groupedText = await organizeOcrByRoles(ocrResults, APPLICATION_OCR_ROLE_OPTIONS, OCR_SPLIT_MODEL);
            const mergedText = formatRoleOcrText(ocrResults, APPLICATION_OCR_ROLE_OPTIONS);

            setTimeout(() => {
                progressDiv.classList.add('hidden');

                const topicText = groupedText.topic;
                const essayText = groupedText.essay;

                ocrTopicTextarea.value = topicText;
                ocrResultTextarea.value = essayText;
                rawOcrTextarea.value = mergedText;
                syncApplicationOcrToGrading();
                updateWordCount(essayText, wordCount, wordHint);
                sendBtn.disabled = !essayText.trim();

                ocrResult.classList.remove('hidden');
                const failedCount = ocrResults.length - successCount;
                showToast(
                    failedCount > 0
                        ? `已整理 ${successCount} 个文件，${failedCount} 个文件识别失败`
                        : `成功识别并整理 ${successCount} 个文件`,
                    failedCount > 0 ? 'error' : 'success'
                );

                // 清空图片列表
                uploadedImages = [];
                fileInput.value = '';
            }, 500);

        } catch (error) {
            console.error('OCR失败:', error);
            progressDiv.classList.add('hidden');
            dropZone.classList.remove('hidden');
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
        ocrTopicTextarea.value = '';
        ocrResultTextarea.value = '';
        rawOcrTextarea.value = '';
        ocrResult.classList.add('hidden');
        dropZone.classList.remove('hidden');
        wordCount.textContent = '字数: 0 词';
        wordHint.textContent = '建议: 80词左右';
        sendBtn.disabled = true;
    });

    // 字数统计
    ocrResultTextarea.addEventListener('input', () => {
        updateWordCount(ocrResultTextarea.value, wordCount, wordHint);
        sendBtn.disabled = !ocrResultTextarea.value.trim();
    });

    ocrTopicTextarea.addEventListener('input', () => {
        sendBtn.disabled = !ocrResultTextarea.value.trim();
    });

    function syncApplicationOcrToGrading() {
        gradingTopic.value = ocrTopicTextarea.value.trim();
        gradingEssay.value = ocrResultTextarea.value.trim();

        const count = countWords(gradingEssay.value);
        gradingWordCount.textContent = count;

        gradingTopic.dispatchEvent(new Event('input'));
        gradingEssay.dispatchEvent(new Event('input'));
    }

    // 发送到批改区
    sendBtn.addEventListener('click', () => {
        syncApplicationOcrToGrading();
        document.querySelector('#gradingInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('已同步到批改区', 'success');
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
            if (model === 'deepseek-v4-flash') {
                estimatedTime = '5-10 秒';
            } else if (model === 'tencent/hy3:free') {
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
    const rawOcrTextarea = document.getElementById('continuationRawOcrText');
    const wordCount = document.getElementById('continuationWordCount');
    const wordHint = document.getElementById('continuationWordHint');
    const sendBtn = document.getElementById('sendToContinuationGradeBtn');
    const clearOcrBtn = document.getElementById('clearContinuationOcrBtn');

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
        const validFiles = files.filter(file => validateOcrFile(file, false));

        validFiles.forEach(file => {
            continuationImages.push({
                file,
                roles: continuationImages.length === 0 ? ['topic', 'original'] : ['continuation']
            });
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

        continuationImages.forEach((item, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            renderFilePreviewItem(previewItem, item, {
                roleOptions: CONTINUATION_OCR_ROLE_OPTIONS,
                onRoleChange: (role) => {
                    continuationImages[index].roles = toggleFileRole(continuationImages[index].roles, role);
                    updateImagePreviewList();
                }
            });
            previewItem.querySelector('.remove-btn').addEventListener('click', () => {
                continuationImages.splice(index, 1);
                updateImagePreviewList();

                if (continuationImages.length === 0) {
                    imagePreviewList.classList.add('hidden');
                    startOcrBtn.classList.add('hidden');
                }
            });
            imagePreviewList.appendChild(previewItem);
        });
    }

    // 开始OCR识别
    startOcrBtn.addEventListener('click', async () => {
        if (continuationImages.length === 0) return;

        try {
            // 隐藏上传区域，显示进度
            dropZone.classList.add('hidden');
            imagePreviewList.classList.add('hidden');
            startOcrBtn.classList.add('hidden');
            progressDiv.classList.remove('hidden');
            ocrResult.classList.add('hidden');

            const ocrResults = [];
            const model = ocrModel.value;

            // 逐个识别文件，单个失败不影响其他文件
            for (let i = 0; i < continuationImages.length; i++) {
                const item = continuationImages[i];
                const file = item.file;

                progressCount.textContent = `${i + 1}/${continuationImages.length}`;
                progressText.textContent = `正在识别第 ${i + 1} 个文件...`;
                progressBar.style.width = `${(i / continuationImages.length) * 100}%`;

                try {
                    const result = await callEssayOCR(file, model);
                    ocrResults.push({
                        ok: true,
                        roles: normalizeRoles(item.roles),
                        text: result.text,
                        fileName: result.fileName || file.name
                    });
                } catch (error) {
                    console.warn('单个文件OCR失败:', file.name, error);
                    ocrResults.push({
                        ok: false,
                        roles: normalizeRoles(item.roles),
                        text: '',
                        fileName: file.name,
                        error: error.message
                    });
                }

                progressBar.style.width = `${((i + 1) / continuationImages.length) * 100}%`;
            }

            const successCount = ocrResults.filter(result => result.ok).length;
            if (successCount === 0) {
                throw new Error('所有文件都识别失败，请检查图片清晰度或稍后重试');
            }

            progressText.textContent = '正在按多选标签整理题目、原文和续写...';
            const groupedText = await organizeOcrByRoles(ocrResults, CONTINUATION_OCR_ROLE_OPTIONS, OCR_SPLIT_MODEL);
            const mergedText = formatRoleOcrText(ocrResults, CONTINUATION_OCR_ROLE_OPTIONS);

            setTimeout(() => {
                progressDiv.classList.add('hidden');

                topicTextarea.value = groupedText.topic;
                originalTextarea.value = groupedText.original;
                contentTextarea.value = groupedText.continuation;
                rawOcrTextarea.value = mergedText;

                // 更新字数统计
                updateWordCount(contentTextarea.value, wordCount, wordHint);
                sendBtn.disabled = !contentTextarea.value.trim();
                syncContinuationOcrToGrading();

                ocrResult.classList.remove('hidden');
                const failedCount = ocrResults.length - successCount;
                showToast(
                    failedCount > 0
                        ? `已整理 ${successCount} 个文件，${failedCount} 个文件识别失败`
                        : `成功识别并整理 ${successCount} 个文件`,
                    failedCount > 0 ? 'error' : 'success'
                );

                // 清空图片列表
                continuationImages = [];
                fileInput.value = '';
            }, 500);

        } catch (error) {
            console.error('OCR失败:', error);
            progressDiv.classList.add('hidden');
            dropZone.classList.remove('hidden');
            imagePreviewList.classList.remove('hidden');
            startOcrBtn.classList.remove('hidden');
            showToast('识别失败: ' + error.message, 'error');
        }
    });

    clearOcrBtn.addEventListener('click', () => {
        topicTextarea.value = '';
        originalTextarea.value = '';
        contentTextarea.value = '';
        rawOcrTextarea.value = '';
        ocrResult.classList.add('hidden');
        dropZone.classList.remove('hidden');
        updateWordCount('', wordCount, wordHint);
        sendBtn.disabled = true;
    });

    // 字数统计
    contentTextarea.addEventListener('input', () => {
        updateWordCount(contentTextarea.value, wordCount, wordHint);
        sendBtn.disabled = !contentTextarea.value.trim();
    });

    topicTextarea.addEventListener('input', () => {
        sendBtn.disabled = !contentTextarea.value.trim();
    });

    originalTextarea.addEventListener('input', () => {
        sendBtn.disabled = !contentTextarea.value.trim();
    });

    function syncContinuationOcrToGrading() {
        gradingTopic.value = topicTextarea.value.trim();
        gradingOriginal.value = originalTextarea.value.trim();
        gradingContent.value = contentTextarea.value.trim();

        const count = countWords(gradingContent.value);
        gradingWordCount.textContent = count;

        gradingTopic.dispatchEvent(new Event('input'));
        gradingOriginal.dispatchEvent(new Event('input'));
        gradingContent.dispatchEvent(new Event('input'));
    }

    // 发送到批改区
    sendBtn.addEventListener('click', () => {
        syncContinuationOcrToGrading();
        document.querySelector('#continuationGradingInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('已同步到批改区', 'success');
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

            const result = await getContinuationGuidance(topic, gradingOriginal.value, model);

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

// 作文OCR
async function callEssayOCR(file, model = 'gemini-3.5-flash') {
    return callVisionOCR(file, model);
}

async function callVisionOCR(file, model = 'gemini-3.5-flash') {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('model', model);

    const response = await fetch(OCR_ENDPOINT, {
        method: 'POST',
        body: formData
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }

    return {
        text: (data.text || '').trim(),
        model: data.model || model,
        fileName: data.fileName || file.name
    };
}

async function splitApplicationOcrText(rawText, model = 'deepseek-v4-flash') {
    const prompt = `你是一个高考英语作文 OCR 文本整理助手。请只根据 OCR 原文，把内容拆成题目要求和学生作文。

要求：
1. 只输出 JSON，不要 Markdown，不要解释。
2. JSON 必须是：{"topic":"...","essay":"..."}
3. topic 放题目、写作背景、任务要求、注意事项等。
4. essay 放学生已经写出的作文正文。
5. 不要改写、润色或纠错，只做拆分和去除明显的 OCR 分隔符。
6. 如果无法判断题目，topic 用空字符串；如果无法判断作文，essay 放主要正文。

OCR 原文：
${rawText}`;

    const json = await callJsonCompletion(prompt, model, 1400);
    return {
        topic: typeof json.topic === 'string' ? json.topic.trim() : '',
        essay: typeof json.essay === 'string' ? json.essay.trim() : ''
    };
}

async function splitContinuationOcrText(rawText, model = 'deepseek-v4-flash') {
    const prompt = `你是一个高考英语读后续写 OCR 文本整理助手。请只根据 OCR 原文，把内容拆成题目要求、原文内容和学生续写。

要求：
1. 只输出 JSON，不要 Markdown，不要解释。
2. JSON 必须是：{"topic":"...","original":"...","continuation":"..."}
3. topic 放题目说明、续写要求、给定首句、注意事项等。
4. original 放阅读原文、故事背景、原文段落。
5. continuation 放学生已经写出的续写内容。
6. 不要改写、润色或纠错，只做拆分和去除明显的 OCR 分隔符。
7. 如果无法判断某一段，对应字段用空字符串；尽量不要丢失原文信息。

OCR 原文：
${rawText}`;

    const json = await callJsonCompletion(prompt, model, 1800);
    return {
        topic: typeof json.topic === 'string' ? json.topic.trim() : '',
        original: typeof json.original === 'string' ? json.original.trim() : '',
        continuation: typeof json.continuation === 'string' ? json.continuation.trim() : ''
    };
}

async function callJsonCompletion(prompt, model, maxTokens) {
    const content = await callTextCompletion({
        model,
        messages: [{
            role: 'user',
            content: prompt
        }],
        maxTokens,
        temperature: 0.1
    });
    return parseJsonObject(content);
}

async function callTextCompletion({ model, messages, maxTokens, temperature = 0.7 }) {
    const response = await fetch(TEXT_MODEL_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }

    const content = data.content || data.choices?.[0]?.message?.content || '';
    if (!content.trim()) {
        throw new Error('AI 返回内容为空');
    }

    return content.trim();
}

function parseJsonObject(output) {
    const trimmed = String(output || '').trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;

    try {
        return JSON.parse(candidate);
    } catch {
        const jsonMatch = candidate.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI 拆分结果不是 JSON');
        return JSON.parse(jsonMatch[0]);
    }
}

// 批改作文
async function gradeEssay(topic, essay, model) {
    const prompt = APPLICATION_GRADING_PROMPT
        .replace('{TOPIC}', topic)
        .replace('{ESSAY}', essay);

    return callTextCompletion({
        model,
        messages: [{
            role: "user",
            content: prompt
        }],
        maxTokens: 4000,
        temperature: 0.7
    });
}

// 获取写作思路
async function getWritingGuidance(topic, model) {
    const prompt = WRITING_GUIDANCE_PROMPT.replace('{TOPIC}', topic);

    return callTextCompletion({
        model,
        messages: [{
            role: "user",
            content: prompt
        }],
        maxTokens: 3000,
        temperature: 0.7
    });
}

// 批改读后续写
async function gradeContinuation(topic, original, content, model) {
    const prompt = CONTINUATION_GRADING_PROMPT
        .replace('{TOPIC}', topic)
        .replace('{ORIGINAL}', original)
        .replace('{CONTINUATION}', content);

    return callTextCompletion({
        model,
        messages: [{
            role: "user",
            content: prompt
        }],
        maxTokens: 4000,
        temperature: 0.7
    });
}

// 获取读后续写思路指导
async function getContinuationGuidance(topic, original, model) {
    const prompt = CONTINUATION_GUIDANCE_PROMPT
        .replace('{TOPIC}', topic)
        .replace('{ORIGINAL}', original);

    return callTextCompletion({
        model,
        messages: [{
            role: "user",
            content: prompt
        }],
        maxTokens: 3000,
        temperature: 0.7
    });
}

// ========================================
// 工具函数
// ========================================


function isPdfFile(file) {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function isImageFile(file) {
    return file.type.startsWith('image/');
}

function formatFileSize(size) {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    return `${(size / 1024).toFixed(1)} KB`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function validateOcrFile(file, showError = true) {
    const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    const isValidImage = validImageTypes.includes(file.type);
    const isValidPdf = isPdfFile(file);

    if (!isValidImage && !isValidPdf) {
        if (showError) showToast('请选择图片或 PDF 文件', 'error');
        return false;
    }

    if (file.size > 200 * 1024 * 1024) {
        if (showError) showToast('文件大小不能超过 200MB', 'error');
        return false;
    }

    return true;
}

function renderFilePreviewItem(previewItem, fileItem, options = {}) {
    const file = fileItem.file || fileItem;
    const roles = normalizeRoles(fileItem.roles || fileItem.role);
    const roleOptions = options.roleOptions || [];
    const safeName = escapeHtml(file.name);
    const safeSize = escapeHtml(formatFileSize(file.size));
    const media = isImageFile(file)
        ? `<img src="${URL.createObjectURL(file)}" alt="预览">`
        : `<div class="file-preview-pdf">PDF</div>`;
    const roleControls = roleOptions.length > 0
        ? `<div class="file-role-shell">
            <div class="file-role-help">可多选</div>
            <div class="file-role-group" role="group" aria-label="标记文件包含的内容">
            ${roleOptions.map(option => `
                <button
                    class="file-role-btn ${roles.includes(option.value) ? 'active' : ''}"
                    type="button"
                    data-role="${escapeHtml(option.value)}"
                    aria-pressed="${roles.includes(option.value) ? 'true' : 'false'}">
                    ${escapeHtml(option.label)}
                    <span class="file-role-check" aria-hidden="true">✓</span>
                </button>
            `).join('')}
            </div>
        </div>`
        : '';

    previewItem.innerHTML = `
        ${media}
        <div class="info">
            <div class="name">${safeName}</div>
            <div class="size">${safeSize}</div>
        </div>
        ${roleControls}
        <button class="remove-btn" type="button">删除</button>
    `;

    if (roleOptions.length > 0 && typeof options.onRoleChange === 'function') {
        previewItem.querySelectorAll('.file-role-btn').forEach(button => {
            button.addEventListener('click', () => options.onRoleChange(button.dataset.role));
        });
    }
}

function getRoleLabel(role, roleOptions) {
    return roleOptions.find(option => option.value === role)?.label || role || '未标记';
}

function normalizeRoles(roles) {
    if (Array.isArray(roles)) return roles.filter(Boolean);
    return roles ? [roles] : [];
}

function toggleFileRole(roles, role) {
    const current = normalizeRoles(roles);
    if (current.includes(role)) {
        return current.length === 1 ? current : current.filter(item => item !== role);
    }
    return [...current, role];
}

async function organizeOcrByRoles(results, roleOptions, model) {
    const grouped = Object.fromEntries(roleOptions.map(option => [option.value, []]));

    for (const result of results) {
        const rawText = String(result.text || '').trim();
        if (!result.ok || !rawText) continue;

        const roles = normalizeRoles(result.roles || result.role);
        if (roles.length === 0) continue;

        if (roles.length === 1) {
            grouped[roles[0]]?.push(rawText);
            continue;
        }

        try {
            const split = await splitTaggedOcrText(rawText, roles, roleOptions, model);
            let hasSegment = false;
            roles.forEach(role => {
                const segment = typeof split[role] === 'string' ? split[role].trim() : '';
                if (segment) {
                    grouped[role]?.push(segment);
                    hasSegment = true;
                }
            });

            if (!hasSegment) {
                grouped[getFallbackRole(roles)]?.push(rawText);
            }
        } catch (error) {
            console.warn('多标签OCR分段失败:', result.fileName, error);
            grouped[getFallbackRole(roles)]?.push(rawText);
        }
    }

    return Object.fromEntries(Object.entries(grouped).map(([role, chunks]) => [role, chunks.join('\n\n')]));
}

async function splitTaggedOcrText(rawText, roles, roleOptions, model) {
    const response = await fetch(OCR_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            action: 'split_ocr_text',
            rawText,
            roles,
            model
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
    }

    return parseJsonObject(data.content || '');
}

function getFallbackRole(roles) {
    return ['essay', 'continuation', 'original', 'topic'].find(role => roles.includes(role)) || roles[0];
}

function combineOcrByRoles(results, roleMap) {
    const grouped = {};
    Object.entries(roleMap).forEach(([target, roles]) => {
        grouped[target] = results
            .filter(result => result.ok && normalizeRoles(result.roles || result.role).some(role => roles.includes(role)))
            .map(result => result.text)
            .filter(Boolean)
            .join('\n\n');
    });
    return grouped;
}

function formatRoleOcrText(results, roleOptions) {
    return results.map((result, index) => {
        const roles = normalizeRoles(result.roles || result.role);
        const label = roles.map(role => getRoleLabel(role, roleOptions)).join(' + ') || '未标记';
        const title = `【${index + 1}. ${label} - ${result.fileName || '未命名文件'}】`;
        const body = result.ok
            ? (result.text || '（未识别到文字）')
            : `识别失败：${result.error || '未知错误'}`;
        return `${title}\n${body}`;
    }).join('\n\n---\n\n');
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
        hintEl.className = 'text-xs text-muted';
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

function iconHtml(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
}

function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 轻量 Markdown 渲染：先整体转义再转换，模型输出无法注入 HTML
function markdownToHtml(text) {
    const inline = s => s
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
    const lines = escapeHtml(text || '').split(/\r?\n/);
    let html = '';
    let listTag = null;
    const closeList = () => { if (listTag) { html += `</${listTag}>`; listTag = null; } };
    const openList = tag => { if (listTag !== tag) { closeList(); html += `<${tag}>`; listTag = tag; } };
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) { closeList(); continue; }
        let match;
        if ((match = line.match(/^#{1,6}\s+(.+)/))) {
            closeList();
            html += `<h5>${inline(match[1])}</h5>`;
        } else if ((match = line.match(/^[-*•]\s+(.+)/))) {
            openList('ul');
            html += `<li>${inline(match[1])}</li>`;
        } else if ((match = line.match(/^\d+[.、)]\s+(.+)/))) {
            openList('ol');
            html += `<li>${inline(match[1])}</li>`;
        } else {
            closeList();
            html += `<p>${inline(line)}</p>`;
        }
    }
    closeList();
    return html;
}

// 动态卡片标题的 emoji 前缀 → 图标映射；未命中时按纯文本渲染
const HEADING_ICONS = [
    ['🧭', 'compass'], ['🔎', 'search'], ['📍', 'map-pin'], ['✅', 'check-circle'],
    ['✨', 'sparkles'], ['⚠️', 'alert-triangle'], ['💡', 'lightbulb'], ['📖', 'book-open'],
    ['🎯', 'target'], ['✍️', 'pencil'], ['📊', 'chart'], ['📋', 'clipboard']
];

function renderIconHeading(heading, title) {
    const entry = HEADING_ICONS.find(([emoji]) => title.startsWith(emoji));
    if (!entry) {
        heading.textContent = title;
        return;
    }
    // 图标是固定字符串走 innerHTML；标题文字必须走 textNode，防止注入
    heading.innerHTML = iconHtml(entry[1]);
    heading.append(document.createTextNode(' ' + title.slice(entry[0].length).trim()));
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = type === 'success' ? 'success-toast' : 'error-toast';
    toast.innerHTML = iconHtml(type === 'success' ? 'check-circle' : 'alert-triangle');
    toast.append(document.createTextNode(message));
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// 学生学习闭环
// ========================================
const STUDENT_HISTORY_KEY = 'smart-doc-helper:learning-history:v1';
const STUDENT_THEME_KEY = 'smart-doc-helper:theme';
const STUDENT_HISTORY_MAX_WORKS = 30;
const STUDENT_HISTORY_MAX_VERSIONS = 10;
const STUDENT_HISTORY_MAX_BYTES = 3.5 * 1024 * 1024;
const studentComposers = {};
let activeStudentType = 'application';
let activeCropEditor = null;

function initStudentExperience() {
    initThemeToggle();
    initStudentTabs();
    initStudentOnboarding();
    initPhotoEditor();
    initStudentHistory();

    studentComposers.application = initStudentComposer({
        type: 'application',
        maxScore: 15,
        roles: APPLICATION_OCR_ROLE_OPTIONS,
        fileInput: 'essayFileInput', selectButton: 'essaySelectBtn', dropZone: 'essayDropZone', previewList: 'imagePreviewList', startOcr: 'startOcrBtn',
        ocrModel: 'essayOcrModel', progress: 'essayProgress', progressText: 'essayProgressText', progressCount: 'essayProgressCount', progressBar: 'essayProgressBar', ocrResult: 'essayOcrResult',
        ocrFields: { topic: 'essayOcrTopic', content: 'essayContent', raw: 'essayRawOcrText' }, wordCount: 'essayWordCount', wordHint: 'essayWordHint', syncButton: 'sendToGradeBtn', clearOcr: 'clearEssayBtn',
        gradeFields: { topic: 'gradingTopic', content: 'gradingEssay' }, gradeWordCount: 'gradingWordCount', gradeWordStatus: 'gradingWordStatus', gradeModel: 'gradingModel', guideButton: 'getGuidanceBtn', gradeButton: 'startGradingBtn', gradeInput: 'gradingInput', gradeProgress: 'gradingProgress', gradeProgressText: 'gradingProgressText', gradeProgressTime: 'gradingTimeEst', gradeProgressBar: 'gradingProgressBar', gradeResult: 'gradingResult', gradeResultContent: 'gradingResultContent',
        guidanceResult: 'guidanceResult', guidanceContent: 'guidanceContent', score: { total: 'totalScore', stars: 'scoreStars', content: 'contentScore', language: 'languageScore', structure: 'structureScore' },
        copyResult: 'copyResultBtn', downloadResult: 'downloadResultBtn', newWork: 'newGradingBtn', copyGuidance: 'copyGuidanceBtn', downloadGuidance: 'downloadGuidanceBtn', backFromGuidance: 'newGuidanceBtn'
    });

    studentComposers.continuation = initStudentComposer({
        type: 'continuation',
        maxScore: 25,
        roles: CONTINUATION_OCR_ROLE_OPTIONS,
        fileInput: 'continuationFileInput', selectButton: 'continuationSelectBtn', dropZone: 'continuationDropZone', previewList: 'continuationImagePreviewList', startOcr: 'startContinuationOcrBtn',
        ocrModel: 'continuationOcrModel', progress: 'continuationProgress', progressText: 'continuationProgressText', progressCount: 'continuationProgressCount', progressBar: 'continuationProgressBar', ocrResult: 'continuationOcrResult',
        ocrFields: { topic: 'continuationTopic', original: 'continuationOriginal', content: 'continuationContent', raw: 'continuationRawOcrText' }, wordCount: 'continuationWordCount', wordHint: 'continuationWordHint', syncButton: 'sendToContinuationGradeBtn', clearOcr: 'clearContinuationOcrBtn',
        gradeFields: { topic: 'continuationGradingTopic', original: 'continuationGradingOriginal', content: 'continuationGradingContent' }, gradeWordCount: 'continuationGradingWordCount', gradeWordStatus: 'continuationGradingWordStatus', gradeModel: 'continuationGradingModel', guideButton: 'getContinuationGuidanceBtn', gradeButton: 'startContinuationGradingBtn', gradeInput: 'continuationGradingInput', gradeProgress: 'continuationGradingProgress', gradeProgressText: 'continuationGradingProgressText', gradeProgressTime: 'continuationGradingTimeEst', gradeProgressBar: 'continuationGradingProgressBar', gradeResult: 'continuationGradingResult', gradeResultContent: 'continuationGradingResultContent',
        guidanceResult: 'continuationGuidanceResult', guidanceContent: 'continuationGuidanceContent', score: { total: 'continuationTotalScore', stars: 'continuationScoreStars', content: 'continuationContentScore', language: 'continuationLanguageScore', structure: 'continuationStructureScore', norm: 'continuationNormScore' },
        copyResult: 'copyContinuationResultBtn', downloadResult: 'downloadContinuationResultBtn', newWork: 'newContinuationGradingBtn', copyGuidance: 'copyContinuationGuidanceBtn', downloadGuidance: 'downloadContinuationGuidanceBtn', backFromGuidance: 'newContinuationGuidanceBtn'
    });
}

function initThemeToggle() {
    const button = getById('themeToggleBtn');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    const readSavedTheme = () => {
        try { return localStorage.getItem(STUDENT_THEME_KEY); } catch { return null; }
    };
    const applyTheme = (theme, persist = false) => {
        const isNight = theme === 'night';
        document.body.classList.toggle('night-mode', isNight);
        button.setAttribute('aria-pressed', String(isNight));
        button.innerHTML = isNight ? `${iconHtml('sun')} 日间模式` : `${iconHtml('moon')} 夜间模式`;
        button.title = isNight ? '切换到日间模式' : '切换到夜间模式';
        // 只有学生手动切换才持久化；未手动设置时始终跟随系统
        if (persist) {
            try { localStorage.setItem(STUDENT_THEME_KEY, theme); } catch { /* 本机隐私模式下仍可临时切换 */ }
        }
    };
    const savedTheme = readSavedTheme();
    if (savedTheme) {
        applyTheme(savedTheme === 'night' ? 'night' : 'light');
    } else {
        applyTheme(systemDark.matches ? 'night' : 'light');
    }
    systemDark.addEventListener('change', event => {
        if (!readSavedTheme()) applyTheme(event.matches ? 'night' : 'light');
    });
    button.addEventListener('click', () => applyTheme(document.body.classList.contains('night-mode') ? 'light' : 'night', true));
}

function getById(id) { return document.getElementById(id); }

function initStudentTabs() {
    const applicationButton = getById('applicationBtn');
    const continuationButton = getById('continuationBtn');
    const application = getById('applicationSection');
    const continuation = getById('continuationSection');
    const setType = (type) => {
        activeStudentType = type;
        const applicationActive = type === 'application';
        applicationButton.classList.toggle('active', applicationActive);
        continuationButton.classList.toggle('active', !applicationActive);
        application.classList.toggle('hidden', !applicationActive);
        continuation.classList.toggle('hidden', applicationActive);
    };
    applicationButton.addEventListener('click', () => setType('application'));
    continuationButton.addEventListener('click', () => setType('continuation'));
}

function initStudentOnboarding() {
    document.querySelectorAll('.student-input-choice').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.student-input-choice').forEach(item => item.classList.toggle('is-active', item === button));
            const composer = studentComposers[activeStudentType];
            if (!composer) return;
            const target = button.dataset.inputMode === 'paste' ? composer.gradeFields.content : composer.dropZone;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (button.dataset.inputMode === 'paste') setTimeout(() => composer.gradeFields.content.focus(), 450);
        });
    });
}

function initStudentComposer(config) {
    const composer = {
        ...config,
        files: [],
        activeWorkId: null,
        currentHistoryRef: null,
        fileInput: getById(config.fileInput), selectButton: getById(config.selectButton), dropZone: getById(config.dropZone), previewList: getById(config.previewList), startOcr: getById(config.startOcr),
        ocrModel: getById(config.ocrModel), progress: getById(config.progress), progressText: getById(config.progressText), progressCount: getById(config.progressCount), progressBar: getById(config.progressBar), ocrResult: getById(config.ocrResult),
        wordCount: getById(config.wordCount), wordHint: getById(config.wordHint), syncButton: getById(config.syncButton), clearOcr: getById(config.clearOcr),
        gradeWordCount: getById(config.gradeWordCount), gradeWordStatus: getById(config.gradeWordStatus), gradeModel: getById(config.gradeModel), guideButton: getById(config.guideButton), gradeButton: getById(config.gradeButton), gradeInput: getById(config.gradeInput), gradeProgress: getById(config.gradeProgress), gradeProgressText: getById(config.gradeProgressText), gradeProgressTime: getById(config.gradeProgressTime), gradeProgressBar: getById(config.gradeProgressBar), gradeResult: getById(config.gradeResult), gradeResultContent: getById(config.gradeResultContent),
        guidanceResult: getById(config.guidanceResult), guidanceContent: getById(config.guidanceContent),
        total: getById(config.score.total), stars: getById(config.score.stars), contentScore: getById(config.score.content), languageScore: getById(config.score.language), structureScore: getById(config.score.structure), normScore: config.score.norm ? getById(config.score.norm) : null,
        copyResult: getById(config.copyResult), downloadResult: getById(config.downloadResult), newWork: getById(config.newWork), copyGuidance: getById(config.copyGuidance), downloadGuidance: getById(config.downloadGuidance), backFromGuidance: getById(config.backFromGuidance)
    };
    composer.ocrFields = Object.fromEntries(Object.entries(config.ocrFields).map(([key, id]) => [key, getById(id)]));
    composer.gradeFields = Object.fromEntries(Object.entries(config.gradeFields).map(([key, id]) => [key, getById(id)]));

    composer.selectButton.addEventListener('click', () => composer.fileInput.click());
    composer.dropZone.addEventListener('click', event => {
        if (!event.target.closest('button') && !event.target.closest('input')) composer.fileInput.click();
    });
    composer.fileInput.addEventListener('change', event => addStudentFiles(composer, Array.from(event.target.files)));
    ['dragover', 'dragenter'].forEach(name => composer.dropZone.addEventListener(name, event => { event.preventDefault(); composer.dropZone.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(name => composer.dropZone.addEventListener(name, event => composer.dropZone.classList.remove('dragover')));
    composer.dropZone.addEventListener('drop', event => { event.preventDefault(); addStudentFiles(composer, Array.from(event.dataTransfer.files)); });
    composer.startOcr.addEventListener('click', () => runStudentOcr(composer));
    composer.syncButton.addEventListener('click', () => syncOcrToGrade(composer, true));
    composer.clearOcr.addEventListener('click', () => {
        Object.values(composer.ocrFields).forEach(field => field.value = '');
        composer.ocrResult.classList.add('hidden');
        composer.wordCount.textContent = '字数: 0 词';
        composer.wordHint.textContent = composer.type === 'continuation' ? '建议: 130词以上' : '建议: 80词左右';
        showToast('已清空识别文字，照片仍可重新识别');
    });
    Object.values(composer.gradeFields).forEach(field => field.addEventListener('input', () => updateComposerButtons(composer)));
    composer.guideButton.addEventListener('click', () => runGuidance(composer));
    composer.gradeButton.addEventListener('click', () => runGrading(composer));
    composer.copyResult.addEventListener('click', () => copyText(composer.gradeResultContent.innerText));
    composer.downloadResult.addEventListener('click', () => downloadTextFile(buildReportText(composer), `${composer.type === 'application' ? '应用文' : '读后续写'}批改报告_${dateKey()}.txt`));
    composer.copyGuidance.addEventListener('click', () => copyText(composer.guidanceContent.innerText));
    composer.downloadGuidance.addEventListener('click', () => downloadTextFile(composer.guidanceContent.innerText, `${composer.type === 'application' ? '应用文' : '读后续写'}写作思路_${dateKey()}.txt`));
    composer.backFromGuidance.addEventListener('click', () => { composer.guidanceResult.classList.add('hidden'); composer.gradeInput.classList.remove('hidden'); });
    composer.newWork.addEventListener('click', () => resetStudentWork(composer));
    bindOcrCopyButtons(composer);
    updateComposerButtons(composer);
    return composer;
}

function bindOcrCopyButtons(composer) {
    const scope = composer.ocrResult.parentElement;
    scope.querySelectorAll('.copy-topic-btn').forEach(button => button.addEventListener('click', () => copyText(composer.ocrFields.topic.value)));
    scope.querySelectorAll('.copy-original-btn').forEach(button => button.addEventListener('click', () => copyText(composer.ocrFields.original.value)));
    scope.querySelectorAll('.copy-continuation-btn').forEach(button => button.addEventListener('click', () => copyText(composer.ocrFields.content.value)));
    const copyAll = scope.querySelector('#copyAllBtn');
    if (copyAll) copyAll.addEventListener('click', () => copyText(composer.ocrFields.content.value));
}

function addStudentFiles(composer, files) {
    const valid = files.filter(file => validateOcrFile(file));
    valid.forEach(file => composer.files.push({
        id: createId(), file, roles: composer.files.length === 0 ? composer.roles.slice(0, composer.type === 'application' ? 1 : 2).map(role => role.value) : [composer.roles[composer.roles.length - 1].value],
        rotation: 0, crop: null
    }));
    composer.fileInput.value = '';
    renderStudentFiles(composer);
}

function renderStudentFiles(composer) {
    composer.previewList.replaceChildren();
    composer.files.forEach((item, index) => {
        const row = document.createElement('article');
        row.className = 'student-file-item';
        const preview = document.createElement('div'); preview.className = 'student-file-preview';
        if (isImageFile(item.file)) {
            const image = document.createElement('img'); image.src = URL.createObjectURL(item.file); image.alt = `${item.file.name} 预览`; image.style.transform = `rotate(${item.rotation}deg)`; preview.append(image);
        } else preview.textContent = 'PDF';
        const details = document.createElement('div'); details.className = 'student-file-details';
        const name = document.createElement('strong'); name.textContent = item.file.name;
        const meta = document.createElement('span'); meta.textContent = `${formatFileSize(item.file.size)}${item.crop ? ' · 已裁剪' : ''}`;
        details.append(name, meta);
        const roles = document.createElement('div'); roles.className = 'student-role-buttons';
        composer.roles.forEach(role => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = role.label; button.className = item.roles.includes(role.value) ? 'active' : '';
            button.addEventListener('click', () => { item.roles = toggleFileRole(item.roles, role.value); renderStudentFiles(composer); }); roles.append(button);
        });
        const tools = document.createElement('div'); tools.className = 'student-file-tools';
        const moveUp = makeButton('↑', '上移'); moveUp.disabled = index === 0; moveUp.addEventListener('click', () => moveStudentFile(composer, index, -1));
        const moveDown = makeButton('↓', '下移'); moveDown.disabled = index === composer.files.length - 1; moveDown.addEventListener('click', () => moveStudentFile(composer, index, 1));
        const left = makeButton('↺', '向左旋转'); left.addEventListener('click', () => { item.rotation = (item.rotation + 270) % 360; renderStudentFiles(composer); });
        const right = makeButton('↻', '向右旋转'); right.addEventListener('click', () => { item.rotation = (item.rotation + 90) % 360; renderStudentFiles(composer); });
        const crop = makeButton('裁剪', '裁剪照片'); crop.disabled = !isImageFile(item.file); crop.addEventListener('click', () => openCropEditor(item, () => renderStudentFiles(composer)));
        const remove = makeButton('删除', '删除照片'); remove.addEventListener('click', () => { composer.files.splice(index, 1); renderStudentFiles(composer); });
        tools.append(moveUp, moveDown, left, right, crop, remove); row.append(preview, details, roles, tools); composer.previewList.append(row);
    });
    const hasFiles = composer.files.length > 0;
    composer.previewList.classList.toggle('hidden', !hasFiles);
    composer.startOcr.classList.toggle('hidden', !hasFiles);
}

function makeButton(text, label) { const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.setAttribute('aria-label', label); button.title = label; return button; }
function moveStudentFile(composer, index, direction) { const destination = index + direction; if (destination < 0 || destination >= composer.files.length) return; [composer.files[index], composer.files[destination]] = [composer.files[destination], composer.files[index]]; renderStudentFiles(composer); }

async function runStudentOcr(composer) {
    if (!composer.files.length) return;
    setComposerBusy(composer, true, '正在识别照片…');
    const results = [];
    try {
        for (let index = 0; index < composer.files.length; index += 1) {
            const item = composer.files[index];
            composer.progressCount.textContent = `${index + 1}/${composer.files.length}`;
            composer.progressText.textContent = `正在识别第 ${index + 1} 张…`;
            composer.progressBar.style.width = `${(index / composer.files.length) * 100}%`;
            try {
                const file = await buildProcessedFile(item);
                const result = await callEssayOCR(file, composer.ocrModel.value);
                results.push({ ok: true, roles: item.roles, text: result.text, fileName: item.file.name });
            } catch (error) { results.push({ ok: false, roles: item.roles, text: '', fileName: item.file.name, error: error.message }); }
        }
        const success = results.filter(result => result.ok).length;
        if (!success) throw new Error('所有文件都识别失败，请检查图片清晰度后重试');
        composer.progressText.textContent = '正在整理题目和作文…';
        const grouped = await organizeOcrByRoles(results, composer.roles, OCR_SPLIT_MODEL);
        Object.keys(composer.ocrFields).forEach(key => { if (key !== 'raw') composer.ocrFields[key].value = grouped[key] || ''; });
        composer.ocrFields.raw.value = formatRoleOcrText(results, composer.roles);
        updateOcrWordCount(composer);
        syncOcrToGrade(composer, false);
        composer.ocrResult.classList.remove('hidden');
        composer.progressBar.style.width = '100%';
        showToast(success === results.length ? '识别完成，请先检查文字' : `已识别 ${success} 张，另有 ${results.length - success} 张失败`, success === results.length ? 'success' : 'error');
    } catch (error) {
        showToast(`识别失败：${error.message}`, 'error');
    } finally { setComposerBusy(composer, false); }
}

function updateOcrWordCount(composer) {
    const count = countWords(composer.ocrFields.content.value);
    composer.wordCount.textContent = `字数: ${count} 词`;
    const min = composer.type === 'continuation' ? 130 : 60;
    composer.wordHint.textContent = count >= min ? '✅ 字数合适' : `⚠️ 还需约 ${min - count} 词`;
}

function syncOcrToGrade(composer, scroll) {
    ['topic', 'original', 'content'].forEach(key => { if (composer.gradeFields[key] && composer.ocrFields[key]) composer.gradeFields[key].value = composer.ocrFields[key].value.trim(); });
    updateComposerButtons(composer);
    if (scroll) { composer.gradeInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); showToast('已同步到批改区'); }
}

function updateComposerButtons(composer) {
    const topic = composer.gradeFields.topic.value.trim();
    const original = composer.gradeFields.original?.value.trim() || '';
    const content = composer.gradeFields.content.value.trim();
    const min = composer.type === 'continuation' ? 130 : 60;
    const count = countWords(content);
    composer.gradeWordCount.textContent = count;
    composer.gradeWordStatus.textContent = count ? (count >= min ? '✅ 字数达标' : `⚠️ 还需约 ${min - count} 词`) : '';
    const guideReady = composer.type === 'continuation' ? Boolean(topic && original) : Boolean(topic);
    const gradeReady = composer.type === 'continuation' ? Boolean(topic && original && content) : Boolean(topic && content);
    composer.guideButton.disabled = !guideReady;
    composer.gradeButton.disabled = !gradeReady;
    if (!guideReady && composer.type === 'continuation') composer.guideButton.title = '请先填写题目要求和原文内容';
    if (!gradeReady) composer.gradeButton.title = composer.type === 'continuation' ? '请填写题目、原文和续写' : '请填写题目和作文';
}

async function runGuidance(composer) {
    const input = readComposerInput(composer);
    if (!input.topic || (composer.type === 'continuation' && !input.original)) return;
    setComposerBusy(composer, true, 'AI 正在整理写作思路…');
    try {
        const result = composer.type === 'continuation'
            ? await getContinuationGuidance(input.topic, input.original, composer.gradeModel.value)
            : await getWritingGuidance(input.topic, composer.gradeModel.value);
        renderGuidance(composer.guidanceContent, result);
        const ref = recordStudentOutcome(composer, 'guidance', input, { text: result });
        composer.currentHistoryRef = ref;
        composer.guidanceResult.classList.remove('hidden');
        showToast('写作思路已保存到学习记录');
    } catch (error) { showToast(`思路生成失败：${error.message}`, 'error'); }
    finally { setComposerBusy(composer, false); }
}

async function runGrading(composer) {
    const input = readComposerInput(composer);
    if (!input.topic || !input.content || (composer.type === 'continuation' && !input.original)) return;
    setComposerBusy(composer, true, 'AI 正在生成批改报告…');
    try {
        const result = composer.type === 'continuation'
            ? await gradeContinuation(input.topic, input.original, input.content, composer.gradeModel.value)
            : await gradeEssay(input.topic, input.content, composer.gradeModel.value);
        const data = normalizeGradeResult(result, composer.type);
        const ref = recordStudentOutcome(composer, 'grading', input, data);
        composer.currentHistoryRef = ref;
        renderGradeResult(composer, data, ref);
        composer.gradeResult.classList.remove('hidden');
        showToast('批改完成，已加入学习记录');
    } catch (error) { showToast(`批改失败：${error.message}`, 'error'); }
    finally { setComposerBusy(composer, false); }
}

function setComposerBusy(composer, busy, message = '') {
    composer.gradeInput.classList.toggle('hidden', busy);
    composer.gradeProgress.classList.toggle('hidden', !busy);
    if (busy) { composer.gradeResult.classList.add('hidden'); composer.guidanceResult.classList.add('hidden'); composer.gradeProgressText.textContent = message; composer.gradeProgressTime.textContent = '通常需要几秒钟'; composer.gradeProgressBar.style.width = '60%'; }
    else composer.gradeProgressBar.style.width = '100%';
    composer.progress.classList.toggle('hidden', !busy || !composer.files.length);
}

function readComposerInput(composer) { return { topic: composer.gradeFields.topic.value.trim(), original: composer.gradeFields.original?.value.trim() || '', content: composer.gradeFields.content.value.trim() }; }

function normalizeGradeResult(raw, type) {
    const maxima = type === 'continuation' ? { content: 8, language: 8, structure: 5, norm: 4, total: 25 } : { content: 5, language: 7, structure: 3, total: 15 };
    let data;
    try { data = parseJsonObject(raw); } catch { data = {}; }
    const array = value => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : [];
    const text = value => typeof value === 'string' ? value.trim() : '';
    const tasks = Array.isArray(data.revisionTasks) ? data.revisionTasks.map(task => ({
        original: text(task.original) || '请定位原文中对应的问题句。', issue: text(task.issue) || '需要进一步修改', suggestion: text(task.suggestion) || '结合题目要求重写这句话。', reason: text(task.reason) || '让表达更准确、更符合评分要求。', practice: text(task.practice) || '完成一次针对性改写', completed: Boolean(task.completed)
    })).slice(0, 3) : [];
    const problems = array(data.problems);
    if (!tasks.length) problems.slice(0, 3).forEach(problem => tasks.push({ original: '请在原文中找到相关表达。', issue: problem, suggestion: '根据题目要求改写并检查语法。', reason: '减少影响理解或得分的问题。', practice: '完成一次改写', completed: false }));
    const scores = {};
    Object.entries(maxima).filter(([key]) => key !== 'total').forEach(([key, max]) => scores[key] = clampNumber(data.scores?.[key], 0, max));
    const calculated = Object.values(scores).reduce((sum, value) => sum + value, 0);
    return { totalScore: clampNumber(data.totalScore, 0, maxima.total, calculated), scores, contentReview: text(data.contentReview) || '本次报告未能完整解析，请参考以下改稿任务后重试。', highlights: array(data.highlights), problems, suggestions: text(data.suggestions) || '先完成优先改稿任务，再重新提交。', modelAnswer: text(data.modelAnswer) || '暂无范文参考。', tips: text(data.tips) || '修改后再批改一次，观察分数和问题的变化。', rubricEvidence: array(data.rubricEvidence), missingRequirements: array(data.missingRequirements), confidence: text(data.confidence) || '中：AI 只能依据提交的文字作出预估。', revisionTasks: tasks };
}

function clampNumber(value, min, max, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; }

function renderGradeResult(composer, data, ref) {
    composer.total.textContent = `${data.totalScore}/${composer.maxScore}`;
    composer.stars.textContent = '⭐'.repeat(Math.round(data.totalScore / composer.maxScore * 5)) + '☆'.repeat(5 - Math.round(data.totalScore / composer.maxScore * 5));
    composer.contentScore.textContent = `${data.scores.content}/${composer.type === 'continuation' ? 8 : 5}`;
    composer.languageScore.textContent = `${data.scores.language}/${composer.type === 'continuation' ? 8 : 7}`;
    composer.structureScore.textContent = `${data.scores.structure}/${composer.type === 'continuation' ? 5 : 3}`;
    if (composer.normScore) composer.normScore.textContent = `${data.scores.norm}/4`;
    composer.gradeResultContent.replaceChildren();
    appendTextCard(composer.gradeResultContent, '🧭 评分依据', data.rubricEvidence, 'AI 预估，建议以老师评分为准。');
    appendTextCard(composer.gradeResultContent, '🔎 缺失要点', data.missingRequirements, '未发现明显缺失。');
    appendTextCard(composer.gradeResultContent, '📍 AI 可信度', data.confidence);
    appendTextCard(composer.gradeResultContent, '✅ 内容点评', data.contentReview);
    appendTextCard(composer.gradeResultContent, '✨ 语言亮点', data.highlights, '暂未识别到明确亮点。');
    appendTextCard(composer.gradeResultContent, '⚠️ 存在问题', data.problems, '暂未列出问题。');
    appendRevisionTasks(composer.gradeResultContent, data.revisionTasks, ref);
    appendTextCard(composer.gradeResultContent, '💡 改进建议', data.suggestions);
    appendTextCard(composer.gradeResultContent, `📖 范文参考（约${composer.type === 'continuation' ? 130 : 80}词）`, data.modelAnswer, '', 'model-answer-card');
    appendTextCard(composer.gradeResultContent, '🎯 提分秘诀', data.tips);
}

function appendTextCard(parent, title, content, fallback = '', extraClass = '', asMarkdown = false) {
    const card = document.createElement('section'); card.className = `grading-card ${extraClass}`.trim();
    const heading = document.createElement('h4'); renderIconHeading(heading, title); card.append(heading);
    const body = document.createElement('div'); body.className = 'content';
    if (Array.isArray(content)) {
        const list = document.createElement('ul'); (content.length ? content : [fallback]).forEach(item => { const line = document.createElement('li'); line.textContent = item; list.append(line); }); body.append(list);
    } else if (asMarkdown) body.innerHTML = markdownToHtml(content || fallback); // markdownToHtml 内部已整体转义
    else body.textContent = content || fallback;
    card.append(body); parent.append(card);
}

function appendRevisionTasks(parent, tasks, ref) {
    const card = document.createElement('section'); card.className = 'grading-card revision-task-card';
    const heading = document.createElement('h4'); renderIconHeading(heading, '✍️ 优先改稿任务'); card.append(heading);
    tasks.forEach((task, index) => {
        const item = document.createElement('label'); item.className = 'revision-task';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.completed; checkbox.addEventListener('change', () => { task.completed = checkbox.checked; updateHistoryTask(ref, index, checkbox.checked); });
        const copy = document.createElement('span');
        [['原句', task.original], ['问题', task.issue], ['建议', task.suggestion], ['原因', task.reason], ['练习目标', task.practice]].forEach(([label, value]) => { const line = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = `${label}：`; line.append(strong, document.createTextNode(value)); copy.append(line); });
        item.append(checkbox, copy); card.append(item);
    });
    parent.append(card);
}

function renderGuidance(container, text) {
    container.replaceChildren();
    const sections = String(text || '').split(/\n(?=\d+\.\s*\*\*)/).filter(Boolean);
    (sections.length ? sections : [String(text || '')]).forEach(section => {
        const match = section.match(/\*\*(.*?)\*\*/); const title = match ? match[1] : '写作思路';
        appendTextCard(container, title, section.replace(/^\d+\.\s*\*\*.*?\*\*\s*/, '').trim(), '', '', true);
    });
}

function buildReportText(composer) { return `${composer.type === 'application' ? '英语应用文' : '英语读后续写'} AI 批改报告\n\nAI 预估分：${composer.total.textContent}\n\n${composer.gradeResultContent.innerText}\n\n生成时间：${new Date().toLocaleString('zh-CN')}`; }
function copyText(text) {
    if (!text.trim()) return showToast('没有可复制的内容', 'error');
    if (!navigator.clipboard?.writeText) return showToast('当前浏览器不支持自动复制，请手动选择文字', 'error');
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板')).catch(() => showToast('复制失败，请手动选择文字', 'error'));
}
function dateKey() { return new Date().toISOString().slice(0, 10); }
function createId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function resetStudentWork(composer) {
    Object.values(composer.gradeFields).forEach(field => field.value = '');
    composer.activeWorkId = null; composer.currentHistoryRef = null;
    composer.gradeResult.classList.add('hidden'); composer.guidanceResult.classList.add('hidden'); composer.gradeInput.classList.remove('hidden'); updateComposerButtons(composer);
}

function readStudentHistory() {
    try { const data = JSON.parse(localStorage.getItem(STUDENT_HISTORY_KEY) || '[]'); return Array.isArray(data) ? data : []; }
    catch { return []; }
}

function writeStudentHistory(history) {
    let next = history.map(work => ({ ...work, versions: (work.versions || []).slice(-STUDENT_HISTORY_MAX_VERSIONS) })).slice(-STUDENT_HISTORY_MAX_WORKS);
    let evicted = next.length < history.length;
    while (next.length && JSON.stringify(next).length > STUDENT_HISTORY_MAX_BYTES) { next.shift(); evicted = true; }
    try {
        localStorage.setItem(STUDENT_HISTORY_KEY, JSON.stringify(next));
        if (evicted) showToast('本机记录空间不足，已自动移除最早的学习记录', 'error');
    }
    catch { showToast('学习记录空间不足，未能保存本次内容', 'error'); }
    renderStudentHistory();
}

function recordStudentOutcome(composer, kind, input, outcome) {
    const history = readStudentHistory();
    let work = history.find(item => item.id === composer.activeWorkId);
    if (!work) {
        work = { id: createId(), type: composer.type, title: input.topic.replace(/\s+/g, ' ').slice(0, 36) || '未命名作文', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), versions: [] };
        composer.activeWorkId = work.id; history.push(work);
    }
    const version = { id: createId(), number: work.versions.length + 1, kind, createdAt: new Date().toISOString(), input: { ...input }, outcome };
    work.updatedAt = version.createdAt; work.versions.push(version);
    writeStudentHistory(history);
    return { workId: work.id, versionId: version.id };
}

function updateHistoryTask(ref, index, completed) {
    if (!ref) return;
    const history = readStudentHistory();
    const version = history.find(work => work.id === ref.workId)?.versions.find(item => item.id === ref.versionId);
    if (version?.outcome?.revisionTasks?.[index]) version.outcome.revisionTasks[index].completed = completed;
    writeStudentHistory(history);
}

function initStudentHistory() {
    const drawer = getById('learningHistoryDrawer'); const backdrop = getById('historyBackdrop'); const toggle = getById('historyToggleBtn');
    const setOpen = open => { drawer.classList.toggle('is-open', open); backdrop.classList.toggle('hidden', !open); drawer.setAttribute('aria-hidden', String(!open)); toggle.setAttribute('aria-expanded', String(open)); if (open) renderStudentHistory(); };
    toggle.addEventListener('click', () => setOpen(!drawer.classList.contains('is-open')));
    getById('historyCloseBtn').addEventListener('click', () => setOpen(false)); backdrop.addEventListener('click', () => setOpen(false));
    getById('clearLearningHistoryBtn').addEventListener('click', () => { if (window.confirm('确定清空这台设备上的全部学习记录吗？')) { localStorage.removeItem(STUDENT_HISTORY_KEY); getById('historyComparePanel').classList.add('hidden'); renderStudentHistory(); } });
    window.studentCloseHistory = () => setOpen(false);
    renderStudentHistory();
}

function renderStudentHistory() {
    const list = getById('learningHistoryList'); if (!list) return;
    const history = readStudentHistory().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); list.replaceChildren();
    if (!history.length) { const empty = document.createElement('p'); empty.className = 'history-empty'; empty.textContent = '还没有记录。完成一次思路指导或批改后，它会出现在这里。'; list.append(empty); return; }
    history.forEach(work => {
        const card = document.createElement('article'); card.className = 'history-work-card';
        const heading = document.createElement('h3'); heading.textContent = work.title;
        const meta = document.createElement('p'); meta.textContent = `${work.type === 'application' ? '应用文' : '读后续写'} · ${new Date(work.updatedAt).toLocaleString('zh-CN')} · ${work.versions.length} 个版本`;
        card.append(heading, meta);
        [...work.versions].reverse().forEach((version, reverseIndex) => {
            const row = document.createElement('div'); row.className = 'history-version-row';
            const label = document.createElement('span'); const score = version.kind === 'grading' ? ` · ${version.outcome.totalScore} 分` : ' · 思路指导'; label.textContent = `第 ${version.number} 版${score}`;
            const load = makeButton('打开', '打开该版本'); load.textContent = '打开'; load.addEventListener('click', () => loadHistoryVersion(work, version)); row.append(label, load);
            if (reverseIndex < work.versions.length - 1) { const compare = makeButton('对比', '与上一版对比'); compare.textContent = '对比'; compare.addEventListener('click', () => showHistoryComparison(work, version)); row.append(compare); }
            const remove = makeButton('删除', '删除此版本'); remove.textContent = '删除'; remove.addEventListener('click', () => deleteHistoryVersion(work.id, version.id)); row.append(remove); card.append(row);
        }); list.append(card);
    });
}

function loadHistoryVersion(work, version) {
    const composer = studentComposers[work.type]; if (!composer) return;
    activeStudentType = work.type; getById(work.type === 'application' ? 'applicationBtn' : 'continuationBtn').click();
    Object.entries(version.input).forEach(([key, value]) => { if (composer.gradeFields[key]) composer.gradeFields[key].value = value || ''; });
    composer.activeWorkId = work.id; composer.currentHistoryRef = { workId: work.id, versionId: version.id }; updateComposerButtons(composer);
    if (version.kind === 'grading') { renderGradeResult(composer, version.outcome, composer.currentHistoryRef); composer.gradeResult.classList.remove('hidden'); }
    else { renderGuidance(composer.guidanceContent, version.outcome.text); composer.guidanceResult.classList.remove('hidden'); }
    window.studentCloseHistory?.(); composer.gradeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteHistoryVersion(workId, versionId) {
    const history = readStudentHistory().map(work => work.id === workId ? { ...work, versions: work.versions.filter(version => version.id !== versionId) } : work).filter(work => work.versions.length);
    writeStudentHistory(history);
}

function showHistoryComparison(work, version) {
    const older = work.versions[version.number - 2]; if (!older) return;
    const panel = getById('historyComparePanel'); panel.replaceChildren(); panel.classList.remove('hidden');
    const title = document.createElement('h3'); title.textContent = `第 ${older.number} 版 → 第 ${version.number} 版`;
    const summary = document.createElement('p'); const oldScore = older.outcome.totalScore; const newScore = version.outcome.totalScore;
    summary.textContent = Number.isFinite(oldScore) && Number.isFinite(newScore) ? `AI 预估分变化：${oldScore} → ${newScore}（${newScore - oldScore >= 0 ? '+' : ''}${newScore - oldScore}）` : '此版本为思路指导，暂无分数对比。';
    const changes = document.createElement('p'); changes.textContent = summarizeTextChange(older.input.content || '', version.input.content || '');
    const before = document.createElement('details'); before.open = true; const beforeTitle = document.createElement('summary'); beforeTitle.textContent = '上一版正文'; const beforeText = document.createElement('pre'); beforeText.textContent = older.input.content || '（无正文）'; before.append(beforeTitle, beforeText);
    const after = document.createElement('details'); const afterTitle = document.createElement('summary'); afterTitle.textContent = '这一版正文'; const afterText = document.createElement('pre'); afterText.textContent = version.input.content || '（无正文）'; after.append(afterTitle, afterText);
    panel.append(title, summary, changes, before, after);
}

function summarizeTextChange(before, after) {
    const beforeWords = new Set(before.split(/\s+/).filter(Boolean)); const afterWords = new Set(after.split(/\s+/).filter(Boolean));
    const added = [...afterWords].filter(word => !beforeWords.has(word)).length; const removed = [...beforeWords].filter(word => !afterWords.has(word)).length;
    return `文本变化：新增或替换约 ${added} 个词，移除或替换约 ${removed} 个词。打开版本可查看完整内容。`;
}

function initPhotoEditor() {
    const modal = getById('photoEditorModal'); const close = () => { modal.classList.add('hidden'); activeCropEditor = null; };
    getById('photoEditorCloseBtn').addEventListener('click', close);
    modal.addEventListener('click', event => { if (event.target === modal) close(); });
    ['cropLeftInput', 'cropTopInput', 'cropWidthInput', 'cropHeightInput'].forEach(id => getById(id).addEventListener('input', drawCropPreview));
    getById('photoEditorResetBtn').addEventListener('click', () => { ['cropLeftInput', 'cropTopInput'].forEach(id => getById(id).value = 0); ['cropWidthInput', 'cropHeightInput'].forEach(id => getById(id).value = 100); drawCropPreview(); });
    getById('photoEditorApplyBtn').addEventListener('click', () => { if (!activeCropEditor) return; const { item, refresh } = activeCropEditor; item.crop = readCropValues(); refresh(); close(); });
}

function openCropEditor(item, refresh) {
    if (!isImageFile(item.file)) return showToast('PDF 暂不支持裁剪', 'error');
    activeCropEditor = { item, refresh, image: null };
    const crop = item.crop || { left: 0, top: 0, width: 100, height: 100 };
    getById('cropLeftInput').value = crop.left; getById('cropTopInput').value = crop.top; getById('cropWidthInput').value = crop.width; getById('cropHeightInput').value = crop.height;
    const image = new Image(); image.onload = () => { if (activeCropEditor) { activeCropEditor.image = image; drawCropPreview(); } }; image.src = URL.createObjectURL(item.file);
    getById('photoEditorModal').classList.remove('hidden');
}

function readCropValues() {
    let left = Number(getById('cropLeftInput').value); let top = Number(getById('cropTopInput').value); let width = Number(getById('cropWidthInput').value); let height = Number(getById('cropHeightInput').value);
    width = Math.min(width, 100 - left); height = Math.min(height, 100 - top);
    return { left, top, width, height };
}

function drawCropPreview() {
    const editor = activeCropEditor; if (!editor?.image) return;
    const canvas = getById('photoEditorCanvas'); const image = editor.image; const crop = readCropValues();
    canvas.width = 720; canvas.height = Math.max(240, Math.round(720 * image.height / image.width));
    const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(0,0,0,.45)'; const x = crop.left / 100 * canvas.width; const y = crop.top / 100 * canvas.height; const width = crop.width / 100 * canvas.width; const height = crop.height / 100 * canvas.height;
    context.fillRect(0, 0, canvas.width, canvas.height); context.clearRect(x, y, width, height); context.strokeStyle = '#ffffff'; context.lineWidth = 3; context.strokeRect(x, y, width, height);
}

async function buildProcessedFile(item) {
    if (!isImageFile(item.file) || (!item.rotation && !item.crop)) return item.file;
    const image = await loadImageFile(item.file); const crop = item.crop || { left: 0, top: 0, width: 100, height: 100 };
    const sourceX = Math.round(image.width * crop.left / 100); const sourceY = Math.round(image.height * crop.top / 100); const sourceWidth = Math.max(1, Math.round(image.width * crop.width / 100)); const sourceHeight = Math.max(1, Math.round(image.height * crop.height / 100));
    const swap = item.rotation % 180 !== 0; const canvas = document.createElement('canvas'); canvas.width = swap ? sourceHeight : sourceWidth; canvas.height = swap ? sourceWidth : sourceHeight;
    const context = canvas.getContext('2d'); context.translate(canvas.width / 2, canvas.height / 2); context.rotate(item.rotation * Math.PI / 180); context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, item.file.type || 'image/jpeg', .92));
    return new File([blob || item.file], item.file.name.replace(/(\.[^.]+)?$/, '-edited$1'), { type: item.file.type || 'image/jpeg' });
}

function loadImageFile(file) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('无法读取图片')); image.src = URL.createObjectURL(file); }); }

})();
