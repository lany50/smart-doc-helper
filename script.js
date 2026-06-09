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
let uploadedImages = []; // 存储上传文件及手动分区
let ocrResults = []; // 存储OCR结果
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
        if (!validateOcrFile(file)) return;

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



            // 调用OCR
            const model = modelSelect.value;
            const result = await callOCR(file, model);

            // 完成进度
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            progressText.textContent = '识别完成！';

            // 显示结果
            setTimeout(() => {
                progressDiv.classList.add('hidden');
                renderNormalPreview(previewImg, file);
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
                role: uploadedImages.length === 0 ? 'topic' : 'essay'
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
                    uploadedImages[index].role = role;
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
                        role: item.role,
                        text: result.text,
                        fileName: result.fileName || file.name
                    });
                } catch (error) {
                    console.warn('单个文件OCR失败:', file.name, error);
                    ocrResults.push({
                        ok: false,
                        role: item.role,
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

            progressText.textContent = '正在按标记整理题目和作文...';

            const groupedText = combineOcrByRoles(ocrResults, {
                topic: ['topic'],
                essay: ['essay']
            });
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
            } else if (model === 'mimo-v2.5') {
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
                role: continuationImages.length === 0 ? 'topic' : 'continuation'
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
                    continuationImages[index].role = role;
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
                        role: item.role,
                        text: result.text,
                        fileName: result.fileName || file.name
                    });
                } catch (error) {
                    console.warn('单个文件OCR失败:', file.name, error);
                    ocrResults.push({
                        ok: false,
                        role: item.role,
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

            progressText.textContent = '正在按标记整理题目、原文和续写...';
            const groupedText = combineOcrByRoles(ocrResults, {
                topic: ['topic'],
                original: ['original'],
                continuation: ['continuation']
            });
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
async function callOCR(file, model = 'gemini-3.5-flash') {
    return callVisionOCR(file, model);
}

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
async function getContinuationGuidance(topic, model) {
    const prompt = CONTINUATION_GUIDANCE_PROMPT.replace('{TOPIC}', topic);

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
    const role = fileItem.role;
    const roleOptions = options.roleOptions || [];
    const safeName = escapeHtml(file.name);
    const safeSize = escapeHtml(formatFileSize(file.size));
    const media = isImageFile(file)
        ? `<img src="${URL.createObjectURL(file)}" alt="预览">`
        : `<div class="file-preview-pdf">PDF</div>`;
    const roleControls = roleOptions.length > 0
        ? `<div class="file-role-group" role="group" aria-label="标记文件类型">
            ${roleOptions.map(option => `
                <button
                    class="file-role-btn ${option.value === role ? 'active' : ''}"
                    type="button"
                    data-role="${escapeHtml(option.value)}"
                    aria-pressed="${option.value === role ? 'true' : 'false'}">
                    ${escapeHtml(option.label)}
                </button>
            `).join('')}
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

function combineOcrByRoles(results, roleMap) {
    const grouped = {};
    Object.entries(roleMap).forEach(([target, roles]) => {
        grouped[target] = results
            .filter(result => result.ok && roles.includes(result.role))
            .map(result => result.text)
            .filter(Boolean)
            .join('\n\n');
    });
    return grouped;
}

function formatRoleOcrText(results, roleOptions) {
    return results.map((result, index) => {
        const label = getRoleLabel(result.role, roleOptions);
        const title = `【${index + 1}. ${label} - ${result.fileName || '未命名文件'}】`;
        const body = result.ok
            ? (result.text || '（未识别到文字）')
            : `识别失败：${result.error || '未知错误'}`;
        return `${title}\n${body}`;
    }).join('\n\n---\n\n');
}

function renderNormalPreview(previewImg, file) {
    const host = previewImg.parentElement;
    let placeholder = host.querySelector('.file-preview-placeholder');

    if (isImageFile(file)) {
        if (placeholder) placeholder.remove();
        previewImg.style.display = '';
        previewImg.src = URL.createObjectURL(file);
        previewImg.alt = file.name;
        return;
    }

    previewImg.removeAttribute('src');
    previewImg.style.display = 'none';
    if (!placeholder) {
        placeholder = document.createElement('div');
        placeholder.className = 'file-preview-placeholder';
        host.appendChild(placeholder);
    }
    placeholder.innerHTML = `
        <div class="file-preview-pdf large">PDF</div>
        <div class="file-preview-name">${escapeHtml(file.name)}</div>
        <div class="file-preview-size">${escapeHtml(formatFileSize(file.size))}</div>
    `;
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
