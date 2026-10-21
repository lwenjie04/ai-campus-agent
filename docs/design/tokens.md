# 银白 / 深绿设计 token

来源：Figma 文件 `AanmCyrCvXPqzdrzTIlIJu`，页面 `02 · 银白极简 / 深绿`（节点 `10:34`）中的 `Silver / Primitives`、`Silver / UI` 变量及本地文字/效果样式。变量名和数值按当前文件读取；补充状态画板 `22:34` 使用同一颜色变量。

## 颜色

| Token | Hex | 用途 |
| --- | --- | --- |
| `color/white` | `#FFFFFF` | 主表面、按钮文字 |
| `color/silver` | `#F5F5F7` | 页面浅灰背景、卡片 |
| `color/text` | `#1D1D1F` | 主文字 |
| `color/muted` | `#6E6E73` | 次级说明 |
| `color/faint` | `#86868B` | 占位文字、弱化信息 |
| `color/brand` | `#005B46` | 主按钮、当前状态、强调操作 |
| `color/brandHover` | `#007055` | 主按钮悬停 |
| `color/link` | `#00664F` | 链接、可点击文字 |
| `color/tint` | `#E7F1EC` | 浅绿背景、选中标签 |
| `color/border` | `#D2D2D7` | 输入框、卡片边线 |
| `color/soft` | `#E8E8ED` | 分割线、细边界 |
| `color/dark` | `#101014` | 深色辅助 token，当前核心页面未见主面积使用 |

当前 token 集没有独立的成功、错误、警告色。错误状态画板使用中性色文案；实现时不要自行把红色当成已批准的设计 token。

## 字体

中文使用 `Noto Sans SC`；拉丁字符与导航使用 `SF Pro`。字号和行高单位均为 px。

| 样式 | Family / Weight | 字号 / 行高 | 字距 |
| --- | --- | --- | --- |
| `Silver/Display` | Noto Sans SC / Bold 700 | 72 / 84 | -2 px |
| `Silver/DisplaySmall` | Noto Sans SC / Bold 700 | 48 / 60 | -1.2 px |
| `Silver/Title` | Noto Sans SC / Medium 500 | 32 / 44 | -0.6 px |
| `Silver/H2` | Noto Sans SC / Medium 500 | 24 / 34 | -0.3 px |
| `Silver/H3` | Noto Sans SC / Medium 500 | 20 / 30 | -0.2 px |
| `Silver/Body` | Noto Sans SC / Regular 400 | 17 / 28 | 0 |
| `Silver/Small` | Noto Sans SC / Regular 400 | 14 / 23 | 0 |
| `Silver/Label` | Noto Sans SC / Medium 500 | 14 / 22 | 0 |
| `Silver/Caption` | Noto Sans SC / Regular 400 | 12 / 20 | 0 |
| `Silver/Nav` | SF Pro / Regular 400 | 12 / 18 | 0 |
| `Silver/Product` | SF Pro / Semibold 590 | 22 / 28 | 0 |
| `Silver/Latin` | SF Pro / Regular 400 | 16 / 24 | 0 |

## 间距、圆角与阴影

- 间距刻度：`4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96 px`。
- 圆角刻度：`12, 16, 20, 24, 28, 32 px`；胶囊按钮使用 `99 px`。
- `Silver / Floating product` 只用于首页产品预览：`0 22px 64px -10px #0D0F171A`，叠加 `0 2px 10px 0 #0D0F170A`。其余页面以细边框和浅灰面为主。

## 组件状态与尺寸

| 项目 | Figma 中已有 | 尚未画出 |
| --- | --- | --- |
| 主按钮 | default `#005B46`；hover `#007055`；胶囊圆角 | focus、disabled |
| 输入框 | 默认边框 `#D2D2D7` | focus、error |
| 来源面板 | 桌面对话中展开，参考栏宽 `276 px`；手机画板显示“查看 1 份官方来源”入口 | 收起状态、390 宽来源抽屉展开稿及抽屉关闭图标 |
| 错误/空/加载 | 补充稿含社区 loading/empty/error、无权限、语音失败、来源不可用 | 独立状态色 token 与通用输入错误样式 |

## 画板与响应式边界

| 宽度 | 现有画板 | 布局证据 |
| --- | --- | --- |
| 1440 | 首页 `10:94`、问答 `10:95`、补充状态 `22:34` 下 6 个画板 | 首页 hero 内容宽 `1000 px`，常办事项内容宽 `1028 px`；问答阅读区 `720 px`，来源栏 `276 px` |
| 1024 | 无 | 需按布局实现并在浏览器验证，不是 Figma 定稿 |
| 768 | 无 | 需按布局实现并在浏览器验证，不是 Figma 定稿 |
| 390 | 手机问答 `10:96`（390 × 844） | 紧凑导航、单列阅读、底部固定输入区；有来源入口，未提供展开后的抽屉画板 |

`22:34` 是一张补充画板页，不是一个可缩放的 390 px 页面。它的六个子画板均为 1440 × 900。
