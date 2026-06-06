// config.example.js
// Copy this file to config.js for local development.
//
// This browser-side config is only for the OpenAI-compatible text model
// used by essay grading and writing guidance.
//
// MinerU OCR uses the server-side Netlify environment variable:
// MINERU_API_TOKEN=your-mineru-token

window.LOCAL_API_CONFIG = {
    baseURL: 'https://api.chatst.org/v1',
    apiKey: 'your-openai-compatible-api-key'
};

const API_CONFIG = window.LOCAL_API_CONFIG;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = API_CONFIG;
}
