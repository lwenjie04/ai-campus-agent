# Figma 设计交付

视觉依据：Figma 文件 `AanmCyrCvXPqzdrzTIlIJu`。PNG 使用 Figma Export 导出，不是画布截图。

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

**移动稿：**仅有 `10:96` 的 390 × 844 对话画板。首页和 `22:34` 下的画板没有移动版；1024 与 768 也没有对应定稿。

## 配套材料

- [准确文案](copy.md)：从各导出画板的文本图层提取，保留原换行。
- [设计 token 与组件状态](tokens.md)：颜色、字体、尺寸、阴影，以及缺失状态说明。
- [交互和响应式说明](interaction.md)：按 `docs/interaction-flow-v2.md` 对照主要入口与目标。
- [Figma SVG 图标](icons/README.md)：列出可用矢量图标、节点来源和当前缺项。

## 还没有的设计

- `22:34` 中有登录、历史/来源/语音、搜索/账号、办事指南及社区/后台状态画板；没有独立的“有来源问答”画板，问答及展开的来源面板以 `10:95` 为准。
- 没有 390 宽来源抽屉展开稿，也没有 1024、768 响应式稿。
- 没有按钮 focus/disabled、输入框 focus/error 的完整控件状态。
- 现有 SVG 中没有关闭、附件图标，也没有独立的品牌组合字标 SVG；字标由图标和可编辑文字组成。

