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

// 生成环境变量注入脚本
const envScript = `
<script>
// Netlify环境变量注入
window.NETLIFY_CONFIG = {
    baseURL: '${process.env.API_BASE_URL || 'https://api.st0722.top/v1'}',
    apiKey: '${process.env.API_KEY || ''}'
};
console.log('✅ 环境变量已加载');
</script>
`;

// 在script.js之前注入
html = html.replace(
    '<script src="script.js">',
    `${envScript}\n    <script src="script.js">`
);

// 写回文件
fs.writeFileSync(htmlPath, html);

console.log('✅ 环境变量注入完成！');