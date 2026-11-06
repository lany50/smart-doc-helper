// inject-env.js - 构建时注入环境变量

const fs = require('fs');
const path = require('path');

console.log('🔧 开始注入环境变量...');

// 读取HTML文件
const htmlPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

html = html.replace(
    /\n<script>\s*\/\/ Netlify[\s\S]*?window\.NETLIFY_CONFIG[\s\S]*?<\/script>\s*\n/g,
    '\n'
);

// 生成站内端点注入脚本。密钥只保存在 Netlify Functions 环境变量中。
const envScript = `
<script>
// Netlify站内端点注入
window.NETLIFY_CONFIG = {
    textModelEndpoint: '/.netlify/functions/chat-completion',
    ocrEndpoint: '/.netlify/functions/vision-ocr'
};
console.log('✅ 站内端点已加载');
</script>
`;

// 在script.js之前注入
html = html.replace(
    '<script src="script.js">',
    `${envScript}\n    <script src="script.js">`
);

// 只发布浏览器需要的文件，避免把本地配置或测试资料上传到站点。
const outputDir = path.join(__dirname, 'dist');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html);
for (const file of ['script.js', 'style.css', 'composition-validation.js', 'admin.html']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(outputDir, file));
}

console.log('✅ 环境变量注入完成！');
