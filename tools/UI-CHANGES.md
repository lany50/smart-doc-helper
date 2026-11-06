# 作文工作台修改与本地验证

2026-11-06：输入、加载、思路、批改、失败统一通过 `setComposerState` 切换。

- 上传和粘贴会切换实际布局；桌面上传区可拖动或使用左右方向键调宽。
- OCR 直接填入唯一的编辑区，原始识别文字留在折叠区供核对。
- 查看结果时隐藏上传与输入区，报告自然延伸，提交材料可折叠查看。
- 返回修改保留文字；历史版本也通过相同状态入口展示。
- 失败保留输入、可重试，错误报告不会显示默认分数或存成成功记录。
- 客户端与 Functions 共用 `composition-validation.js`，拦截占位输入，真实短作文只提示。
- 评分结果需具备有效分项、点评和建议，总分需等于分项之和。无效报告退回卡次数或免费额度。

## 验证命令

```sh
npm install
npm test
npm run test:ui
npm run build
```

浏览器测试自动使用 macOS 上的 Microsoft Edge；其他环境可运行 `npx playwright install chromium`，或通过 `BROWSER_EXECUTABLE_PATH` 指定浏览器。设置 `UI_SCREENSHOT_DIR` 可保存界面截图。

测试仅使用本地模拟响应，不连接真实模型，不消耗用户额度。覆盖两种作文类型、OCR 单标签和多标签、长报告、错误重试、复制下载、历史版本、360–1440 CSS 像素宽度，以及 CSS zoom 200% 的放大模拟。

## 接口与发布

`chat-completion` 的 grade/guidance 请求需包含 `composition: { type, topic, original?, content? }`。旧页面缺少该字段时会收到刷新提示。发布时应同时发布前端与 Functions；构建会将共享校验脚本复制到 `dist`。本地修改与构建不代表已上线；生产版本以 Netlify 部署记录及其对应的 Git 提交为准。
