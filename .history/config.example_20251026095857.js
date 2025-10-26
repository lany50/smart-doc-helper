// config.example.js - 配置文件示例
// ⚠️ 使用说明：
// 1. 复制本文件为 config.js
// 2. 填入你的API密钥
// 3. config.js 不会被上传到GitHub（已在.gitignore中配置）

// 配置方式1：使用 window.LOCAL_API_CONFIG（推荐）
window.LOCAL_API_CONFIG = {
    baseURL: 'https://platform.openai.com/v1',  // API基础地址
    apiKey: 'your-api-key-here'             // ⚠️ 请替换为你的API密钥
};

// 配置方式2：兼容旧版本
const API_CONFIG = window.LOCAL_API_CONFIG;

// 支持Node.js环境（可选）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}

// ========================================
// 使用步骤：
// ========================================
// 
// 1. 复制本文件：
//    cp config.example.js config.js
//
// 2. 编辑 config.js，填入你的API密钥：
//    apiKey: 'sk-xxxxxxxxxxxxxxxxxxxxxxx'
//
// 3. 本地运行项目：
//    python3 -m http.server 8000
//    或
//    npx serve
//
// 4. 访问：http://localhost:8000
//
// ========================================
// 如何获取API密钥？
// ========================================
//
// 本项目需要兼容 OpenAI API 格式的接口。
// 
// 推荐API提供商：
// - OpenRouter: https://openrouter.ai/
// - OpenAI: https://platform.openai.com/
// - 其他兼容OpenAI格式的API服务
//
// ========================================
// 注意事项：
// ========================================
//
// ⚠️ 不要将 config.js 提交到Git仓库
// ✅ 已在 .gitignore 中配置
// ✅ 只在本地开发时使用
// ✅ Netlify部署使用环境变量（不需要config.js）
//