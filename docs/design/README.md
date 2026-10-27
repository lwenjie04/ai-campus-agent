# Figma 设计交付

视觉依据：Figma 文件 `AanmCyrCvXPqzdrzTIlIJu`。下表 P0 PNG 使用 Figma Export 导出，不是画布截图。响应式与控件状态补充稿共 9 张；本轮已通过 Figma Export 导出 7 张并归档，另有 2 张待补。

## P0 画板导出

| 节点 | 内容 | 导出文件 | 尺寸 |
| --- | --- | --- | --- |
| `10:94` | 桌面首页 | [home-1440-2x.png](10-94/home-1440-2x.png) | 2880 × 3172（1440 画布，2x） |
| `10:95` | 桌面对话与展开的来源面板 | [chat-sources-1440.png](10-94/chat-sources-1440.png) | 1440 × 1000 |
| `10:96` | 手机对话 | [chat-mobile-390.png](10-94/chat-mobile-390.png) | 390 × 844 |
| `22:35` | 登录 / 注册 | [login-register-1440.png](22-34/login-register-1440.png) | 1440 × 900 |
| `22:70` | 历史、来源与语音 | [history-sources-voice-1440.png](22-34/history-sources-voice-1440.png) | 1440 × 900 |
| `22:107` | 搜索、账号相关状态 | [search-account-1440.png](22-34/search-account-1440.png) | 1440 × 900 |
| `22:131` | 办事指南列表 | [services-list-1440.png](22-34/services-list-1440.png) | 1440 × 900 |
| `22:176` | 办事指南详情 | [service-detail-1440.png](22-34/service-detail-1440.png) | 1440 × 900 |
| `22:206` | 社区及后台的空、加载、错误等状态 | [community-admin-states-1440.png](22-34/community-admin-states-1440.png) | 1440 × 900 |

## 响应式与控件状态补充稿

Figma Starter 文件最多保留 3 个页面，因此补充画板放在既有页面 `02 · 银白极简 / 深绿`（`10:34`），没有新增页面。节点均为可编辑的 Figma 画板，沿用现有银白背景、深绿色操作和 Noto Sans SC 字体。

| 节点 | 内容 | 尺寸 | Figma | PNG 导出 |
| --- | --- | --- | --- | --- |
| `33:92` | 1024 首页与回答预览 | 1024 × 860 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=33-92) | [1024-home-answer.png](10-34/1024-home-answer.png) |
| `33:135` | 768 平板首页 | 768 × 900 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=33-135) | [768-home.png](10-34/768-home.png) |
| `33:176` | 390 移动首页、常用服务、最近对话 | 390 × 844 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=33-176) | 待补：Starter 调用上限 |
| `33:212` | 1024 问答与来源侧栏 | 1024 × 880 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=33-212) | 待补：Starter 调用上限 |
| `33:259` | 768 问答与右侧来源抽屉 | 768 × 880 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=33-259) | [768-chat-sources.png](10-34/768-chat-sources.png) |
| `33:300` | 390 问答与底部来源抽屉 | 390 × 844 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=33-300) | [390-chat-sources.png](10-34/390-chat-sources.png) |
| `33:332` | 390 登录 / 注册 | 390 × 844 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=33-332) | [390-login.png](10-34/390-login.png) |
| `33:355` | 390 办事指南列表 | 390 × 844 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=33-355) | [390-services.png](10-34/390-services.png) |
| `35:134` | 按钮、输入框、来源面板状态 | 1440 × 940 | [打开画板](https://www.figma.com/design/AanmCyrCvXPqzdrzTIlIJu/Campus-AI?node-id=35-134) | [controls-states-1440.png](10-34/controls-states-1440.png) |

新增画板已在 Figma 预览检查：390 首页、390 来源抽屉、1440 控件状态均已查看。控件稿中“次要操作”标题由 y=222 调整到 y=204，标题与状态标签已分开；导出图确认标题不再重叠。七张已归档 PNG 的签名和画布尺寸均已核对。

## 配套材料

- [准确文案](copy.md)：记录原画板与补充画板的关键文本。
- [设计 token 与组件状态](tokens.md)：颜色、字体、尺寸、阴影和状态稿。
- [交互和响应式说明](interaction.md)：按 `docs/interaction-flow-v2.md` 对照入口、断点与抽屉行为。
- [Figma SVG 图标](icons/README.md)：列出可用矢量图标、节点来源和当前缺项。

## 仍待补齐

- `22:34` 中有登录、历史/来源/语音、搜索/账号、办事指南及社区/后台状态画板；没有独立的“有来源问答”画板，问答及展开的来源面板以 `10:95` 为准。
- `33:176`（390 移动首页）与 `33:212`（1024 问答与来源侧栏）尚未导出；Figma Starter 本轮达到调用上限，待额度恢复后补齐。
- 现有 SVG 中没有关闭、附件图标，也没有独立的品牌组合字标 SVG；字标由图标和可编辑文字组成。

