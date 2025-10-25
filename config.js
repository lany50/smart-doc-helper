// config.js - 本地配置文件
// ⚠️ 此文件不应上传到GitHub（已在.gitignore中）

const API_CONFIG = {
    baseURL: 'https://api.st0722.top/v1',
    apiKey: 'sk-2ucC4n6e2m2HiYTZhpXk964gIaSLuOqpR8OUhYp7TJarde0Q'
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}