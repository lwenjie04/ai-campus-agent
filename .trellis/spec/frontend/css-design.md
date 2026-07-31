# CSS 与设计约定

> 本项目样式**全部写在 SFC 的 `<style scoped>`** 中，不使用独立 CSS 文件、不使用 Tailwind。覆盖 Element Plus 内部样式用 `:deep()`。

---

## 组织方式

### 样式一律 scoped

```vue
<style scoped>
.community-page {
  min-height: 100vh;
  padding: 24px;
}
</style>
```

没有全局 `styles/` 目录、没有 CSS 变量主题文件（除 `VoiceOrb.vue` 用 CSS 变量做内联参数）。新增样式就近写在所属组件的 `<style scoped>`。

### 覆盖 Element Plus 用 `:deep()`

Element Plus 组件内部样式需要调整时，用 `:deep()` 包裹，并给目标元素一个自定义类：

```scss
// src/components/InputBox.vue —— 圆角输入框
:deep(.el-input__wrapper) {
  border-radius: 999px;
  min-height: 52px;
  padding: 0 16px;
  background: rgba(243, 243, 243, 0.95);
  box-shadow:
    inset 0 0 0 1px rgba(50, 110, 51, 0.12),
    0 8px 14px rgba(33, 95, 40, 0.06) !important;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow:
    inset 0 0 0 1px rgba(47, 137, 66, 0.28),
    0 0 0 4px rgba(98, 219, 93, 0.13) !important;
}
```

弹窗整体样式覆盖（`AgentChat.vue` 的 `settings-dialog`）：

```scss
:deep(.settings-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(248, 252, 246, 0.98) 0%, rgba(233, 247, 228, 0.96) 100%);
}
```

---

## 类名命名（BEM 风格）

使用 BEM 风格区分 block / element / modifier，保持层级关系清晰：

```scss
.top-nav__inner { }          // block__element
.top-nav__tab--active { }    // block__element--modifier
.stat-card__label { }        // AdminReviewView
.login-card__head { }        // LoginView
```

规则：

1. Block 用 kebab-case（`top-nav`、`post-card`、`stat-card`）。
2. Element 用双下划线 `__`（`__inner`、`__label`、`__actions`）。
3. Modifier 用双连字符 `--`（`--active`、`--dialog`、`--full`）。
4. 避免深层嵌套：`.block__element__sub` 不要出现。

---

## 设计语言

统一使用「绿色玻璃拟态」风格：

| 要素 | 约定 | 示例 |
| --- | --- | --- |
| 页面背景 | 径向渐变 + 多色绿 | `radial-gradient(circle at top left, rgba(241,255,238,.98), rgba(216,248,206,.92) 42%, rgba(137,223,98,.95) 100%)` |
| 卡片 | 半透明白 + 圆角 + 阴影 + 毛玻璃 | `background: rgba(251,255,248,0.78); border-radius: 28px; box-shadow: 0 18px 38px rgba(52,118,66,0.12); backdrop-filter: blur(18px);` |
| 圆角 | 大卡片 20–28px，小控件 14–18px，胶囊 999px | `border-radius: 999px` |
| 主文字色 | 深绿 | `#174d2e`、`#184e30`、`#1f6a39` |
| 次文字色 | 深绿带透明度 | `rgba(23,77,46,0.72)` |
| 强调 / 成功 | 绿 | `#2f7b40`、`#20653d` |

### 常见重复模式

```scss
// 页面级背景（CommunityView / PostDetailView / App.vue 一致）
background:
  radial-gradient(circle at top left, rgba(241,255,238,0.98), rgba(216,248,206,0.92) 42%, rgba(137,223,98,0.95) 100%);

// 毛玻璃卡片
background: rgba(251,255,248,0.78);
border: 1px solid rgba(83,156,89,0.18);
border-radius: 28px;
box-shadow: 0 18px 38px rgba(52,118,66,0.12);
backdrop-filter: blur(18px);

// 胶囊标签
display: inline-flex;
padding: 6px 12px;
border-radius: 999px;
background: rgba(122,202,117,0.14);
color: #2f7b40;
font-size: 13px;
font-weight: 700;
```

---

## 布局与响应式

### 大屏两栏、小屏单栏

`AgentChat.vue` 主界面用 grid 两栏，`@media (max-width: 980px)` 收成单栏：

```scss
.app-shell {
  width: min(1200px, 100%);
  height: calc(100vh - 28px);
  display: grid;
  grid-template-columns: minmax(360px, 44%) minmax(0, 56%);
  gap: 14px;
}

@media (max-width: 980px) {
  .app-shell {
    grid-template-columns: 1fr;
    height: auto;
  }
}
```

### 常见断点

| 断点 | 场景 |
| --- | --- |
| `max-width: 980px` | 主界面两栏 → 单栏 |
| `max-width: 900px` | 列表 / 详情页卡片纵向排布 |
| `max-width: 680px` | 表单、小屏压缩 |
| `max-width: 640px` | 设置面板单列 |

移动端适配时把并排布局改成 `flex-direction: column; align-items: stretch;`。

### 响应式尺寸写法

```scss
width: min(720px, calc(100vw - 32px));  // 弹窗宽度
font-size: clamp(18px, 1.8vw, 24px);    // 品牌标题
```

---

## 交互动效

- hover：轻微上浮 + 阴影增强。

```scss
.post-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(60, 133, 72, 0.12);
}
```

- 过渡统一 `transition: all 0.2s ease` 或针对属性的 `transition`。
- 视频切换 / 光球用 `@keyframes`（见 `VoiceOrb.vue`、`DigitalHumanPlayer.vue`）。
- 打字光标用 `steps()` 步进动画（`MessageItem.vue`）。

---

## 自定义滚动条

保留 webkit 滚动条定制风格，颜色与主题一致：

```scss
.chat-window::-webkit-scrollbar {
  width: 6px;
}
.chat-window::-webkit-scrollbar-thumb {
  background: rgba(46, 113, 53, 0.18);
  border-radius: 999px;
}
```

---

## 避免

- 不使用 Tailwind / 独立 CSS 文件 / CSS Modules。
- 不在模板里写内联 `style`（`VoiceOrb.vue` 用 CSS 变量传参是唯一例外）。
- 不引入深色模式变量系统。
- 覆盖 Element Plus 样式时不要用 `!important` 以外的全局选择器；`:deep()` + 自定义类优先。
