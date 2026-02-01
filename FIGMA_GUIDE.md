# Figma 落地指南（ChatGPT 极简风格）

## 目标
把当前界面稳定复刻到「大留白 + 中性配色 + 输入框为中心 + chips 工具入口 + 消息流输出」的 ChatGPT 风格，并让设计与代码共享同一套 Tokens（便于后续迭代）。

## 文件结构建议（Figma）
建议在同一个 Figma File 内建 4 个 Page：
1. Tokens
2. Components
3. Layouts
4. Screens

## Tokens（Variables）
### Color
对应代码 [style.css](file:///d:/Program/smart-doc-helper/style.css) 的 `:root`：
- `bg` → `--bg`
- `surface` → `--surface`
- `surface/2` → `--surface-2`
- `border` → `--border`
- `text` → `--text`
- `muted` → `--muted`
- `focus` → `--focus`

建议在 Figma 里用两个 mode（可选）：`Light`、`Dark`。当前代码仅实现 Light tokens；Dark 可先占位。

### Radius
对应代码 tokens：
- `radius/sm` → `--radius-sm`
- `radius/md` → `--radius-md`
- `radius/lg` → `--radius-lg`

### Shadow
对应代码 tokens：
- `shadow/sm` → `--shadow-sm`
- `shadow/md` → `--shadow-md`

### Spacing
建议统一 4/8 体系，并与代码 tokens 对齐：
- `space/2` → `--space-2`
- `space/3` → `--space-3`
- `space/4` → `--space-4`
- `space/6` → `--space-6`
- `space/8` → `--space-8`

### Typography
当前代码使用：
- Inter：正文与 UI 文本
- Crimson Pro：仅用于旧版标题；新版标题已改为 Inter 风格（更接近 ChatGPT）

建议在 Figma 里定义 Text Styles：
- `Title/L`：32/40, Medium
- `Body/M`：14/20, Regular
- `Caption/S`：12/16, Regular

## Components（建议组件与属性）
### TopBar
结构：
- 左：Brand（圆形 Badge + 标题）
- 右：Action（设置按钮）

建议属性：
- `showAction`（Boolean）

### Composer（输入框）
结构：
- Row：Attach Button + Input + Send Button
- Chips Row：OCR / 作文批改 / 模型 / 更多
- Panel Slot：可折叠面板（显示不同 tool form）

建议属性：
- `state`：default / focused / disabled
- `panel`：none / ocr / essay / model / more

### Chip
建议属性：
- `active`（Boolean）
- `icon`（可选）

### Message
结构：
- 容器（左/右对齐）
- 内容区（纯文本/富文本）
- Meta Actions（复制/下载）

建议属性：
- `role`：user / assistant
- `hasActions`：Boolean

### Panel（工具面板）
建议做成通用容器 + 具体内容作为 Slot：
- OCR Panel：Model Select + File List + Start/Clear
- Essay Panel：Type Select + Topic + Text + (Original) + Buttons
- Model Panel：Text Model Select + API Status
- More Panel：Open Legacy / Back

## Auto Layout（关键规则）
- TopBar：横向 Auto Layout，左右两端对齐，固定高度 56。
- Empty State：纵向 Auto Layout，居中对齐，标题与输入区域保持 24~32 间距。
- Suggestions：纵向 Auto Layout，按钮高度一致，分隔线 1px。
- Composer：纵向 Auto Layout；输入行固定高度；chips 支持 wrap。
- Messages：纵向 Auto Layout，行间距 12~14；user 右对齐，assistant 左对齐。

## Layouts（断点建议）
建议至少做两套 Frame：
- Desktop：内容宽度 760（对应 `--max-content`）
- Mobile：375 宽，TopBar/Composer 左右 padding 14

## 和代码的映射（落点）
新版 UI 主要落点：
- 结构： [index.html](file:///d:/Program/smart-doc-helper/index.html) 的 `#app`（旧版放在 `#legacyApp`）
- 样式： [style.css](file:///d:/Program/smart-doc-helper/style.css) 的 tokens 与 `.ui-*` 组件类
- 交互： [script.js](file:///d:/Program/smart-doc-helper/script.js) 的 `initNewPanels()` / `initNewChatApp()`

## 交付检查清单（Design QA）
- 标题、输入框、chips、建议列表在空态居中对齐，留白足够
- 输入框 focus ring 明显但不刺眼（focus token）
- 组件边框、圆角、阴影风格一致（不混用多套样式）
- 移动端下 Composer 不遮挡内容（消息区留底部 padding）

