// netlify-env.js
// Netlify构建时自动注入环境变量

(function() {
    if (typeof process !== 'undefined' && process.env) {
        // Netlify环境：从环境变量读取
        window.NETLIFY_CONFIG = {
            baseURL: process.env.API_BASE_URL || 'https://api.st0722.top/v1',
            apiKey: process.env.API_KEY || ''
        };
        console.log('✅ Netlify环境变量已注入');
    }
})();