<div align="center">

# 智能文档识别助手 📄✨

**基于 AI 的 OCR 识别和英语作文批改工具**

[![GitHub release](https://img.shields.io/github/v/release/lany50/smart-doc-helper?color=blue)](https://github.com/lany50/smart-doc-helper/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/lany50/smart-doc-helper?style=social)](https://github.com/lany50/smart-doc-helper/stargazers)

[在线体验](https://smartocrhelper.netlify.app/) · [功能演示](#-功能演示) · [快速开始](#-快速开始) · [部署指南](#-部署指南)

<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
<img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" />
<img src="https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" />

</div>

---

## 📖 目录

- [✨ 功能特性](#-功能特性)
- [🎬 功能演示](#-功能演示)
- [🚀 快速开始](#-快速开始)
- [📦 部署指南](#-部署指南)
- [⚙️ 配置说明](#️-配置说明)
- [🎯 使用指南](#-使用指南)
- [🛠️ 技术栈](#️-技术栈)
- [📊 项目结构](#-项目结构)
- [🤝 贡献指南](#-贡献指南)
- [📝 更新日志](#-更新日志)
- [📄 开源协议](#-开源协议)
- [💖 致谢](#-致谢)

---

## ✨ 功能特性

### 📸 普通 OCR 识别

- ✅ **高精度识别** - 支持中英文、数字、符号、表格
- ✅ **多模型支持** - Gemini Flash、Qwen3-VL、GPT-5 Mini
- ✅ **快速响应** - 平均识别时间 2-5 秒
- ✅ **一键复制** - 识别结果可直接复制或下载

### ✍️ 英语作文批改（15分制）

- ✅ **智能评分** - 内容(5分) + 语言(7分) + 结构(3分)
- ✅ **详细报告** - 内容点评、语言亮点、问题分析
- ✅ **范文参考** - 提供约80词的优秀范文
- ✅ **改进建议** - 针对性的提分秘诀
- ✅ **多图上传** - 支持分别拍摄题目和作文

### 💡 写作思路指导

- ✅ **题目分析** - 识别作文类型和关键要点
- ✅ **写作框架** - 提供开头、主体、结尾结构
- ✅ **语言建议** - 推荐高级词汇和句式
- ✅ **范文示例** - AI生成符合要求的范文

### 🎨 其他特性

- 📱 **响应式设计** - 完美支持手机、平板、电脑
- 🎨 **优雅界面** - 基于 Tailwind CSS 的现代设计
- 🚀 **极速部署** - 支持 Netlify、Vercel、GitHub Pages
- 🔐 **环境变量** - 支持安全的 API 密钥配置
- 📝 **完整文档** - 详细的使用和部署说明

---

## 🎬 功能演示

### 普通 OCR 识别



### 英语作文批改



### 写作思路指导



---

## 🚀 快速开始

### 📋 前置要求

- 现代浏览器（Chrome、Firefox、Safari、Edge）
- 兼容 OpenAI API 的密钥（可选，仅本地开发需要）

### 💻 本地开发

#### 1️⃣ 克隆项目

```bash
git clone https://github.com/lany50/smart-doc-helper.git
cd smart-doc-helper
```

#### 2️⃣ 配置 API 密钥

```bash
# 复制配置示例
cp config.example.js config.js

# 编辑 config.js，填入你的 API 密钥
# Windows:
notepad config.js

# macOS/Linux:
nano config.js
```

`config.js` 内容：

```javascript
window.LOCAL_API_CONFIG = {
    baseURL: 'https://api.st0722.top/v1',  // API 基础地址
    apiKey: 'your-api-key-here'             // 替换为你的 API 密钥
};

const API_CONFIG = window.LOCAL_API_CONFIG;
```

#### 3️⃣ 运行服务

```bash
# 方式1：使用 Python（推荐）
python3 -m http.server 8000

# 方式2：使用 Node.js
npx serve

# 方式3：使用 PHP
php -S localhost:8000
```

#### 4️⃣ 访问应用

打开浏览器访问：**http://localhost:8000**

---

## 📦 部署指南

### 🔷 部署到 Netlify（推荐）

#### 方式一：通过 GitHub（自动部署）

1. **Fork 本项目到你的 GitHub**

2. **登录 Netlify**
   - 访问 [netlify.com](https://www.netlify.com/)
   - 点击 `Add new site` → `Import an existing project`

3. **连接 GitHub**
   - 选择 `GitHub`
   - 授权访问
   - 选择 `smart-doc-helper` 仓库

4. **配置部署**
   ```
   Build command: [留空]
   Publish directory: .
   ```

5. **添加环境变量**
   - `Site settings` → `Environment variables`
   - 添加以下变量：
     ```
     API_BASE_URL = https://api.st0722.top/v1
     API_KEY = your-api-key-here
     ```

6. **部署**
   - 点击 `Deploy site`
   - 等待 2-3 分钟
   - 获得 `https://your-site.netlify.app` 地址

#### 方式二：手动部署

```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录
netlify login

# 部署
netlify deploy --prod

# 按提示操作
```

---

### 🔷 部署到 Vercel

1. **访问 [vercel.com](https://vercel.com/)**
2. **点击 `New Project`**
3. **导入 GitHub 仓库**
4. **配置环境变量**（同 Netlify）
5. **点击 Deploy**

---

### 🔷 部署到 GitHub Pages

1. **创建 `gh-pages` 分支**
   ```bash
   git checkout -b gh-pages
   ```

2. **修改配置**
   - 将 API 密钥硬编码到 `index.html`（仅 Private 仓库）

3. **推送并启用 Pages**
   ```bash
   git push origin gh-pages
   ```
   - 进入仓库 `Settings` → `Pages`
   - Source: `gh-pages` 分支
   - 点击 `Save`

4. **访问**
   - `https://your-username.github.io/smart-doc-helper/`

---

## ⚙️ 配置说明

### 🔐 API 配置

本项目需要兼容 OpenAI API 格式的接口。

#### 支持的 API 提供商

- [OpenAI](https://platform.openai.com/)
- [OpenRouter](https://openrouter.ai/)
- [API2D](https://api2d.com/)
- 自建 API 服务

#### 环境变量配置

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `API_BASE_URL` | API 基础地址 | `https://api.openai.com/v1` |
| `API_KEY` | API 密钥 | `sk-...` |

---

### 🤖 模型配置

#### OCR 识别模型

| 模型 | 提供商 | 速度 | 准确度 | 推荐场景 |
|------|--------|------|--------|----------|
| `gemini-flash-lite-latest` | Google | ⚡⚡⚡ | ⭐⭐⭐⭐ | 快速识别 |
| `Qwen3-VL-235B` | Alibaba | ⚡⚡ | ⭐⭐⭐⭐⭐ | 高精度识别 |
| `gpt-5-mini` | OpenAI | ⚡⚡⚡ | ⭐⭐⭐⭐ | 通用识别 |

#### 批改模型

| 模型 | 速度 | 质量 | 适用场景 |
|------|------|------|----------|
| `GPT-OSS-120B` | ⚡⚡⚡ | ⭐⭐⭐⭐ | 快速批改（推荐）|
| `enterprise-gpt-5` | ⚡⚡ | ⭐⭐⭐⭐⭐ | 高质量批改 |
| `enterprise-gemini-2.5-pro` | ⚡ | ⭐⭐⭐⭐⭐ | 深度分析 |

---

## 🎯 使用指南

### 📸 普通 OCR 识别

1. 切换到 **"普通 OCR"** 模式
2. 拖拽或点击上传图片（支持 JPG、PNG、WebP）
3. 选择识别模型
4. 等待识别完成（2-5秒）
5. 复制或下载识别结果

**支持的内容**：
- ✅ 中文、英文、数字、符号
- ✅ 印刷体和手写体
- ✅ 表格和复杂排版
- ✅ 最大 10MB 图片

---

### ✍️ 英语作文批改

#### 完整流程

1. **上传作文图片**
   - 切换到 **"英语作文批改"** 模式
   - 拖拽或点击上传图片（支持多张）
   - 可分别拍摄题目和作文

2. **OCR 识别**
   - 选择识别模型
   - 点击 **"开始识别"**
   - 等待识别完成

3. **分配内容**
   - 点击 **"发送到批改区"**
   - 手动将题目部分复制到 **"题目要求"** 框
   - 作文部分已自动填入 **"学生作文"** 框

4. **开始批改**
   - 选择批改模型（推荐 GPT-OSS-120B）
   - 点击 **"开始批改"**
   - 等待 10-15 秒

5. **查看报告**
   - 总分和分项得分
   - 内容点评
   - 语言亮点和问题
   - 改进建议
   - 范文参考
   - 提分秘诀

#### 评分标准

**满分 15 分**

- **内容完整性**（5分）
  - 是否覆盖所有题目要点
  - 内容是否切题

- **语言表达**（7分）
  - 词汇的准确性和多样性
  - 语法正确性
  - 句式丰富度

- **篇章结构**（3分）
  - 逻辑性
  - 衔接性
  - 格式规范

**字数要求**：
- 建议：80 词左右
- 合理区间：60-100 词
- 过少或过多会适当扣分

---

### 💡 获取写作思路

1. 在批改区只填写 **"题目要求"**
2. **"学生作文"** 留空
3. 点击 **"💡 获取写作思路"**
4. AI 将提供：
   - 题目分析
   - 写作框架
   - 语言建议
   - 范文示例

---

## 🛠️ 技术栈

### 前端

- **原生 JavaScript** - 无框架依赖，轻量高效
- **Tailwind CSS** - 现代化 UI 设计
- **Google Fonts** - Crimson Pro + Inter 字体

### AI 模型

- **视觉模型** - Gemini Flash、Qwen3-VL、GPT-5 Mini
- **语言模型** - GPT-OSS、GPT-5、Gemini 2.5 Pro

### 部署

- **Netlify** - 自动部署和 CDN 加速
- **GitHub Pages** - 免费静态托管
- **Vercel** - 边缘函数支持

---

## 📊 项目结构

```
smart-doc-helper/
├── index.html              # 主页面
├── script.js               # 核心逻辑（900+ 行）
├── style.css               # 自定义样式
├── config.js               # 本地配置（不上传）
├── config.example.js       # 配置示例
├── .gitignore              # Git 忽略规则
├── README.md               # 项目文档
├── LICENSE                 # MIT 开源协议
├── netlify.toml            # Netlify 配置
└── .history/               # 历史记录（本地）
```

### 核心文件说明

| 文件 | 大小 | 说明 |
|------|------|------|
| `index.html` | ~15 KB | HTML 结构和 UI |
| `script.js` | ~45 KB | 业务逻辑和 API 调用 |
| `style.css` | ~8 KB | 自定义样式 |

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. **Fork 本仓库**

2. **创建特性分支**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **提交更改**
   ```bash
   git commit -m "feat: Add amazing feature"
   ```

4. **推送到分支**
   ```bash
   git push origin feature/amazing-feature
   ```

5. **提交 Pull Request**

### Commit 规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `style:` 代码格式调整
- `refactor:` 重构
- `test:` 测试相关
- `chore:` 构建/工具相关

示例：
```bash
git commit -m "feat: Add PDF export feature"
git commit -m "fix: Resolve OCR timeout issue"
git commit -m "docs: Update deployment guide"
```

---

## 📝 更新日志

### [v1.0.0] - 2025-10-25

#### ✨ 新增

- 📸 普通 OCR 识别功能
- ✍️ 英语作文批改（15分制）
- 💡 写作思路指导
- 📱 响应式设计
- 🎨 优雅的 UI 界面

#### 🛠️ 技术

- 支持环境变量配置
- 多模型支持
- Netlify 一键部署

查看完整更新日志：[CHANGELOG.md](./CHANGELOG.md)

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

```
MIT License

Copyright (c) 2024 lany50

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

## 💖 致谢

### 技术支持

- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Google Fonts](https://fonts.google.com/) - 字体服务
- [Netlify](https://www.netlify.com/) - 部署平台

### AI 模型

- [OpenAI](https://openai.com/) - GPT 系列
- [Google Gemini](https://deepmind.google/technologies/gemini/) - Gemini 系列
- [Alibaba Qwen](https://github.com/QwenLM/Qwen) - 通义千问

### 灵感来源

感谢所有为教育工具开发做出贡献的开发者！

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=lany50/smart-doc-helper&type=Date)](https://star-history.com/#lany50/smart-doc-helper&Date)

---

## 📮 联系方式

- **GitHub**: [@lany50](https://github.com/lany50)
- **Email**: kklkklsb@163.com
- **Issues**: [提交问题](https://github.com/lany50/smart-doc-helper/issues)

---

## 🎉 支持项目

如果这个项目对你有帮助，请：

- ⭐ 给项目一个 Star
- 🍴 Fork 项目并参与贡献
- 📣 分享给更多人

---

<div align="center">

**Made with ❤️ by [lany50](https://github.com/lany50)**

[⬆ 回到顶部](#智能文档识别助手-)

</div>
