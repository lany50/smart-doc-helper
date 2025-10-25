// API配置
const API_CONFIG = {
    baseURL: 'https://api.st0722.top/v1',
    apiKey: 'sk-2ucC4n6e2m2HiYTZhpXk964gIaSLuOqpR8OUhYp7TJarde0Q'
};

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

评分标准（满分15分）：
- 内容完整性（5分）：是否完成题目要求的所有要点
- 语言表达（7分）：词汇、语法、句式的准确性和多样性
- 篇章结构（3分）：逻辑性、衔接性、格式规范

字数要求：
- 应用文建议80词左右
- 60-100词之间为合理区间
- 低于60词或高于100词会适当扣分

注意：
1. totalScore = content + language + structure，满分15分
2. 所有文字内容使用简体中文
3. highlights和problems数组至少各包含2-3条
4. modelAnswer必须是完整的范文，约80词
5. 请确保输出是有效的JSON格式

请开始批改：`;

// 全局变量
let uploadedImages = []; // 存储上传的图片
let ocrResults = []; // 存储OCR结果

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
}

// ========================================
// 普通OCR模式（保持不变）
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
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OCR识别结果_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
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
// 英语作文模式（修改版）
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
    
    // 修改：使用单个文本框
    const ocrResultTextarea = document.getElementById('essayContent');
    const wordCount = document.getElementById('essayWordCount');
    const wordHint = document.getElementById('essayWordHint');
    const sendBtn = document.getElementById('sendToGradeBtn');
    const clearEssayBtn = document.getElementById('clearEssayBtn');
    
    const gradingTopic = document.getElementById('gradingTopic');
    const gradingEssay = document.getElementById('gradingEssay');
    const gradingWordCount = document.getElementById('gradingWordCount');
    const gradingWordStatus = document.getElementById('gradingWordStatus');
    const gradingModel = document.getElementById('gradingModel');
    const startGradingBtn = document.getElementById('startGradingBtn');
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
            
            // 合并所有识别结果（不再自动分割）
            const mergedText = ocrResults.join('\n\n---\n\n');
            
            setTimeout(() => {
                progressDiv.classList.add('hidden');
                
                // 全部显示在一个文本框中
                ocrResultTextarea.value = mergedText;
                updateWordCount(mergedText, wordCount, wordHint);
                sendBtn.disabled = !mergedText.trim();
                
                ocrResult.classList.remove('hidden');
                showToast(`成功识别 ${uploadedImages.length} 张图片，请手动分配题目和作文`, 'success');
                
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
    
    // 清空按钮
    clearEssayBtn.addEventListener('click', () => {
        ocrResultTextarea.value = '';
        wordCount.textContent = '字数: 0 词';
        wordHint.textContent = '建议: 80词左右';
        sendBtn.disabled = true;
    });
    
    // 字数统计（修改：80词标准）
    ocrResultTextarea.addEventListener('input', () => {
        updateWordCount(ocrResultTextarea.value, wordCount, wordHint);
        sendBtn.disabled = !ocrResultTextarea.value.trim();
    });
    
    // 批改区字数统计（修改：80词标准）
    gradingEssay.addEventListener('input', () => {
        const count = countWords(gradingEssay.value);
        gradingWordCount.textContent = count;
        
        // 字数状态提示（60-100词为合理区间）
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
        
        startGradingBtn.disabled = !gradingEssay.value.trim() || !gradingTopic.value.trim();
    });
    
    gradingTopic.addEventListener('input', () => {
        startGradingBtn.disabled = !gradingEssay.value.trim() || !gradingTopic.value.trim();
    });
    
    // 发送到批改区（修改：提示用户手动分配）
    sendBtn.addEventListener('click', () => {
        const fullText = ocrResultTextarea.value;
        
        // 显示提示
        if (confirm('📤 发送到批改区\n\n识别结果将复制到作文框。\n请您手动将题目部分复制到"题目要求"框中。\n\n点击确定继续。')) {
            gradingTopic.value = ''; // 清空题目框
            gradingEssay.value = fullText; // 全部文本放入作文框
            
            const count = countWords(gradingEssay.value);
            gradingWordCount.textContent = count;
            
            // 更新字数状态
            gradingEssay.dispatchEvent(new Event('input'));
            
            startGradingBtn.disabled = true; // 需要填写题目后才能批改
            
            // 滚动到批改区
            document.querySelector('#gradingInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast('已发送！请将题目部分复制到"题目要求"框', 'success');
        }
    });
    
    // 开始批改
    startGradingBtn.addEventListener('click', async () => {
        try {
            gradingInput.classList.add('hidden');
            gradingProgress.classList.remove('hidden');
            gradingResult.classList.add('hidden');
            
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
    
    // 显示批改结果（修改：15分制）
    function displayGradingResult(result) {
        // 解析JSON结果
        let data;
        try {
            // 尝试提取JSON部分
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                data = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('无法解析JSON');
            }
        } catch (e) {
            console.error('JSON解析失败:', e);
            // 使用默认值（15分制）
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
        
        // 更新总分（15分制）
        totalScoreEl.textContent = `${data.totalScore}/15`;
        
        // 更新星级（按15分制计算）
        const stars = Math.round((data.totalScore / 15) * 5);
        scoreStarsEl.textContent = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
        
        // 更新分项得分（5+7+3=15）
        contentScoreEl.textContent = `${data.scores.content}/5`;
        languageScoreEl.textContent = `${data.scores.language}/7`;
        structureScoreEl.textContent = `${data.scores.structure}/3`;
        
        // 构建详细批改卡片
        gradingResultContent.innerHTML = `
            <!-- 内容点评 -->
            <div class="grading-card">
                <h4>✅ 内容点评</h4>
                <div class="content">${data.contentReview}</div>
            </div>
            
            <!-- 语言亮点 -->
            <div class="grading-card">
                <h4>✨ 语言亮点</h4>
                <div class="content">
                    <ul>
                        ${data.highlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <!-- 存在问题 -->
            <div class="grading-card">
                <h4>⚠️ 存在问题</h4>
                <div class="content">
                    <ul>
                        ${data.problems.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            </div>
            
            <!-- 改进建议 -->
            <div class="grading-card">
                <h4>💡 改进建议</h4>
                <div class="content">${data.suggestions}</div>
            </div>
            
            <!-- 范文参考 -->
            <div class="grading-card model-answer-card">
                <h4>📖 范文参考（约80词）</h4>
                <div class="content">${data.modelAnswer}</div>
            </div>
            
            <!-- 提分秘诀 -->
            <div class="grading-card">
                <h4>🎯 提分秘诀</h4>
                <div class="content">${data.tips}</div>
            </div>
        `;
    }
    
    // 复制结果
    copyResultBtn.addEventListener('click', () => {
        const text = gradingResultContent.innerText;
        navigator.clipboard.writeText(text).then(() => {
            showToast('已复制到剪贴板', 'success');
        });
    });
    
    // 下载结果
    downloadResultBtn.addEventListener('click', () => {
        const totalScore = totalScoreEl.textContent;
        const text = `
英语作文批改报告
==================

总分：${totalScore}

${gradingResultContent.innerText}

批改时间：${new Date().toLocaleString('zh-CN')}
        `.trim();
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `作文批改报告_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // 批改新作文
    newGradingBtn.addEventListener('click', () => {
        gradingResult.classList.add('hidden');
        gradingInput.classList.remove('hidden');
        gradingTopic.value = '';
        gradingEssay.value = '';
        gradingWordCount.textContent = '0';
        gradingWordStatus.textContent = '';
        startGradingBtn.disabled = true;
        gradingProgressBar.style.width = '0%';
    });
}

// ========================================
// API调用函数（保持不变）
// ========================================

// 普通OCR
async function callOCR(imageBase64, model) {
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

// 作文OCR（带特殊提示）
async function callEssayOCR(imageBase64, model) {
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

// 修改：80词标准
function updateWordCount(text, countEl, hintEl) {
    const count = countWords(text);
    countEl.textContent = `字数: ${count} 词`;
    
    // 更新提示（60-100词为合理区间，建议80词）
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