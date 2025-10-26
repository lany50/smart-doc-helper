// config.js - 本地开发配置
// ⚠️ 此文件不会被推送到GitHub

window.LOCAL_API_CONFIG = {
    baseURL: 'https://api.st0722.top/v1',
    apiKey: 'sk-2ucC4n6e2m2HiYTZhpXk964gIaSLuOqpR8OUhYp7TJarde0Q'
};

// 兼容旧版本
const API_CONFIG = window.LOCAL_API_CONFIG;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}