# Plan: Rive Web 实时卡通 AI 助手

**Generated**: 2026-08-21  
**Estimated Complexity**: Medium–High  
**Recommended Duration**: 15–22 个工作日（美术与前端并行）；单人顺序完成约 4–6 周

## 1. Overview

将当前 Vue3 Web 页面里的 MP4 数字人播放器，替换为浏览器实时渲染的 Rive 卡通 AI 助手。角色风格参考豆包式 AI 伙伴：卡通、亲切、非真人写实；具备待机、聆听、思考、回答、被打断和异常状态，并根据腾讯云 TTS 音频实时控制嘴部开合。

现有业务能力保持不变：

- RAG 继续通过 `src/api/llm.ts` 流式返回答案和来源。
- 腾讯云 TTS 继续由 `server/tts.mjs` 代持密钥并返回音频。
- `src/store/agent.ts` 现有“流式文本按句切分并排队播报”能力继续使用。
- 登录、游客试问、来源展示、社区功能不因数字人改造而变化。
- 正式运行不依赖 MP4、云渲染视频流或海外 CDN。

目标架构：

```text
用户提交问题
    ↓
Agent Store：thinking
    ↓
现有 RAG 流式回答 ──────────────→ 聊天窗口显示文字与来源
    ↓ 按句切分
TTS Narration Queue
    ↓ 腾讯云 TTS 音频 Blob
HTMLAudioElement + Web Audio Analyser
    ├─ 播放声音
    ├─ 输出 mouthOpen 0..1
    └─ 输出 speaking / idle 事件
              ↓
RiveAvatarController
              ↓
Canvas 实时绘制 `.riv` 卡通角色
```

## 2. Scope and Assumptions

### 2.1 本期范围

- Web 端 Vue3 正式版本。
- 一个正式卡通角色，一个默认配色和一个默认音色。
- 文本提问与现有快捷问题入口。
- RAG 等待、TTS 播放、停止讲解、第二问覆盖第一问。
- 桌面 Chrome/Edge、Android Chrome、iOS Safari。
- 自托管 `.riv`、WASM 和静态降级图。
- 音量包络口型，不在首版追求逐音素真人级唇形。

### 2.2 本期不做

- 真人克隆、摄像头驱动、动作捕捉。
- 云端数字人视频流。
- 多角色商城、换装、用户自定义捏脸。
- 将 RAG 或 TTS 更换成 Rive 自带能力。
- 首版语音输入/ASR；如后续需要，作为独立迭代接入。
- 对移动端 `mobile-uniapp` 同步改造；首版只覆盖现有 Web 页面。

### 2.3 关键前提

- 需要一份拥有正式使用授权的 `.riv` 角色资产。
- Rive Runtime 可商业使用，但从 Rive Editor 导出生产 `.riv` 需要相应付费计划；采购与账号归属必须在 Sprint 0 确认。
- 生产环境必须自托管 Rive WASM，不能依赖默认 `unpkg` 地址。
- 如果学校要求全链路国产化，应单独评估工具合规；本方案的运行资源可以部署在国内服务器，但 Rive 编辑工具本身不是国内产品。

## 3. Current Codebase Findings

### 3.1 可以直接复用的能力

- `src/store/agent.ts`
  - 已存在 RAG 流式 delta 处理。
  - 已存在 `splitSpeakableChunks` 分句与尾句补播。
  - 已存在 narration tick 和停止播报语义。
- `src/components/DigitalHumanPlayer.vue`
  - 已存在腾讯 TTS 请求、分段、队列和 ObjectURL 回收。
  - 已存在停止信号、组件卸载清理和播报结束事件。
- `src/views/AgentChat.vue`
  - 已有数字人舞台、停止讲解按钮和桌面/移动布局基础。
- `server/tts.mjs`、`src/api/tts.ts`
  - TTS 密钥已位于服务端，前端只接收音频 Blob。

### 3.2 需要拆分的耦合

当前 `DigitalHumanPlayer.vue` 同时承担视频资源探测、视频状态、TTS 队列、音频播放和 UI。正式改造必须拆成三层：

1. `RiveAvatarCanvas.vue`：只负责 Rive 加载和绘制。
2. `TtsNarrationController.ts`：只负责文本队列、TTS 请求、音频播放和取消。
3. `DigitalHumanPlayer.vue`：编排状态、错误降级和向父组件发事件。

## 4. Character and Rive Asset Contract

正式美术资产不是“交付一个看起来会动的文件”即可，必须符合下面的运行时契约。

### 4.1 角色视觉规范

- 头肩或半身构图，适合左侧舞台与移动端卡片。
- 卡通/2.5D 风格，不使用写实皮肤和真人克隆。
- 默认视线面向用户，五官简洁，嘴部至少支持连续开合。
- 使用学校品牌色的点缀，但校徽作为独立审核资产，不让生成式工具自行仿制。
- 背景透明，光圈、粒子和状态提示放在角色独立图层。
- 角色在 `Contain` 布局下不得裁切头顶、下巴和肩部。

### 4.2 Rive 文件命名契约

| 类型 | 名称 | 说明 |
|---|---|---|
| Artboard | `CampusAssistant` | 唯一正式角色画板 |
| State Machine | `AssistantStateMachine` | 唯一由 Web 运行的状态机 |
| View Model | `AssistantViewModel` | 前端数据绑定入口 |
| Enum | `mode` | `idle/listening/thinking/speaking/error` |
| Number | `mouthOpen` | 范围 `0..1`，控制嘴部开合 |
| Number | `energy` | 范围 `0..1`，控制回答时身体/光圈强度 |
| Boolean | `reducedMotion` | 减少动态模式 |
| Boolean | `muted` | 静音状态的视觉反馈 |
| Trigger | `greet` | 首次进入或重置时短暂问候 |
| Trigger | `interrupt` | 被用户停止或新问题覆盖时的短反馈 |

新资产优先使用 Rive Data Binding/View Model，而不是新建 legacy state-machine inputs。前端只依赖上述公开契约，不直接操作美术层级节点。

### 4.3 动画层设计

- Base 层：呼吸、轻微身体摆动、自然眨眼。
- Mode 层：聆听、思考、回答、异常之间的过渡。
- Face 层：嘴部开合和轻微表情。
- FX 层：声波、光圈、思考粒子。
- Reduced Motion：关闭大幅身体和粒子动画，只保留状态颜色与必要嘴部反馈。

### 4.4 资产交付物

- `public/avatar/campus-assistant.v1.riv`
- `public/avatar/campus-assistant-fallback.svg` 或 PNG/WebP
- `public/avatar/manifest.json`：版本、artboard、state machine、view model、hash、发布日期
- 美术源文件和 Rive 项目所有权说明
- 字体、图标、角色、学校标识的授权记录
- 一份状态演示录屏，逐项展示所有 mode 和 trigger

## 5. Technical Decisions

### 5.1 Runtime

首选 `@rive-app/canvas` 高级 Web API：

- 单角色矢量动画不需要 Three.js 或 WebGL 数字人引擎。
- Canvas 兼容性和故障面更适合校园公共 Web。
- POC 后若确认资产不使用 Text、Audio、Layout 或 Scripting，可评估 `canvas-lite`，但不把缩包作为首版阻塞项。
- 不使用低级 runtime API，不自行维护第二套渲染循环。

### 5.2 Production Asset Hosting

- `.riv` 和 `rive.wasm` 与 Web 应用同源部署。
- 固定 npm 版本和 `package-lock.json`。
- `manifest.json` 短缓存；带版本/hash 的 `.riv`、WASM 长缓存。
- `.gitattributes` 增加 `*.riv binary`，避免 Windows 换行处理损坏二进制资源。

### 5.3 Mouth Sync

首版采用音频能量包络：

```text
HTMLAudioElement
    ↓ createMediaElementSource（只创建一次并复用）
AnalyserNode
    ↓ time-domain RMS
noise gate → normalize → attack/release smoothing
    ↓
mouthOpen 0..1 + energy 0..1
```

建议初始参数：

- FFT size：1024 或 2048，真机性能测试后确定。
- noise gate：0.02 左右，避免无声时嘴部抖动。
- attack：约 50–80ms。
- release：约 120–180ms。
- `mouthOpen` 最大值由美术文件校准，不在代码中假设角色嘴型幅度。

### 5.4 State Ownership

业务状态由应用掌握，Rive 只是展示层：

| 应用事件 | Avatar mode |
|---|---|
| 页面加载完成 | `idle`，可触发一次 `greet` |
| 用户正在输入 | `idle` |
| 用户提交问题、RAG 尚未可播 | `thinking` |
| 第一段音频真正开始播放 | `speaking` |
| TTS 队列全部结束 | `idle` |
| 点击停止或下一问覆盖 | `interrupt` → `idle/thinking` |
| RAG 或 TTS 失败 | 短暂 `error` → `idle` |
| 用户关闭数字人 | `disabled`，仅保留文字问答 |

`store.loading`、LLM 流结束、TTS 队列结束和音频播放结束是四个不同事件，不得复用一个布尔变量。

## 6. Sprint 0: 需求冻结、资产规范和技术验证准备

**Duration**: 1–2 个工作日  
**Goal**: 冻结“豆包式卡通助手”的视觉边界、运行契约、授权和验收标准。  
**Demo/Validation**:

- 能查看角色静态稿和五种状态分镜。
- 能确认 Rive 账号、导出权限和资源归属。
- 前后端、设计人员对属性命名契约无歧义。

### Task 0.1: 冻结视觉方向

- **Location**: `docs/rive-avatar-visual-brief.md`（实施时新增）
- **Description**: 形成正面静态稿、配色、构图、安全区、动作强度和禁止项。
- **Dependencies**: 无。
- **Acceptance Criteria**:
  - 明确是原创校园助手，不复制豆包具体角色造型。
  - 确认头肩/半身、性格、年龄感、服装和学校元素。
  - 桌面和手机各有一张尺寸示意图。
- **Validation**: 产品、美术、前端共同签字确认。

### Task 0.2: 冻结 Rive 运行契约

- **Location**: `docs/rive-avatar-runtime-contract.md`
- **Description**: 将第 4 节名称、范围、默认值和状态迁移整理成版本化契约。
- **Dependencies**: Task 0.1。
- **Acceptance Criteria**:
  - `.riv` 在没有后端时也能通过测试面板触发全部状态。
  - `mouthOpen=0/0.5/1` 的效果可验收。
  - 契约变更必须升级版本并同步代码。
- **Validation**: 用最小测试 `.riv` 执行契约检查。

### Task 0.3: 处理工具、版权和账号

- **Location**: `docs/rive-avatar-asset-register.md`
- **Description**: 记录 Rive 付费导出、编辑账号归属、源文件访问、字体和品牌资产授权。
- **Dependencies**: Task 0.1。
- **Acceptance Criteria**:
  - 生产 `.riv` 可合法导出和部署。
  - 不使用来源不明的模板角色。
  - 离职/外包交付后项目仍能继续编辑。
- **Validation**: 资产登记审查。

## 7. Sprint 1: 隔离 Rive POC

**Duration**: 2–3 个工作日  
**Goal**: 不改 RAG 主链路，证明 Rive 在当前 Vite/Vue3 项目中可自托管加载、响应状态并稳定清理。  
**Demo/Validation**:

- 独立路由或开发面板展示测试角色。
- 按钮可以切换 idle/thinking/speaking/error。
- 滑块可以实时设置 `mouthOpen`。
- 断网后刷新，只要应用静态资源已部署，仍不访问海外 CDN。

### Task 1.1: 安装并固定 Rive Web Runtime

- **Location**: `package.json`, `package-lock.json`
- **Description**: 添加 `@rive-app/canvas`，固定版本并记录升级策略。
- **Dependencies**: Task 0.3。
- **Acceptance Criteria**:
  - `npm run build` 通过。
  - 浏览器 Network 中没有 `unpkg.com` 或 `cdn.rive.app` 请求。
- **Validation**: 构建产物和网络面板检查。

### Task 1.2: 配置 WASM 自托管

- **Location**: `src/avatar/rive/runtime.ts`, `vite.config.ts`（按实际打包方式）
- **Description**: 在创建 Rive 实例前通过 `RuntimeLoader.setWasmUrl` 指向本地构建资源。
- **Dependencies**: Task 1.1。
- **Acceptance Criteria**:
  - 开发、预览和正式子路径部署均能正确加载 WASM。
  - WASM MIME 正确，不发生跨域请求。
- **Validation**: `npm run dev`、`npm run preview`、生产域名分别验证。

### Task 1.3: 建立 POC 组件

- **Location**: `src/components/RiveAvatarCanvas.vue`
- **Description**: 使用 `<canvas>` 初始化 Rive、开启 `autoBind`、访问 View Model 属性并提供最小控制 API。
- **Dependencies**: Tasks 1.1–1.2。
- **Acceptance Criteria**:
  - 加载成功/失败状态明确。
  - `ResizeObserver` 调用 `resizeDrawingSurfaceToCanvas`。
  - `onBeforeUnmount` 调用 `cleanup()`。
  - 同一路由进出十次不增加活动渲染实例。
- **Validation**: 手工路由切换、内存快照和组件测试。

### Task 1.4: 建立契约测试面板

- **Location**: `src/views/AvatarLabView.vue` 或仅开发环境组件
- **Description**: 提供 mode、mouthOpen、energy、reducedMotion、greet 和 interrupt 控件。
- **Dependencies**: Task 1.3。
- **Acceptance Criteria**:
  - 每项属性均有当前值显示。
  - 缺失属性时显示契约错误，而不是静默失败。
- **Validation**: 美术和前端使用同一页面验收 `.riv`。

## 8. Sprint 2: 正式组件架构与静态降级

**Duration**: 2–3 个工作日  
**Goal**: 将当前视频播放器重构为与渲染技术解耦的数字人编排组件，Rive 失败时不影响问答。  
**Demo/Validation**:

- 当前 AgentChat 页面显示 Rive 测试角色而非 `<video>`。
- 模型 404、WASM 失败时显示静态卡通图。
- RAG、来源、登录和游客试问保持可用。

### Task 2.1: 定义 Avatar 类型和驱动接口

- **Location**: `src/avatar/types.ts`, `src/avatar/RiveAvatarController.ts`
- **Description**: 定义 `AvatarMode`、事件、初始化、状态更新、嘴部更新、暂停和销毁接口。
- **Dependencies**: Sprint 1。
- **Acceptance Criteria**:
  - 业务层不直接 import Rive 类型。
  - 所有属性更新在未 ready 时安全排队或忽略并记录原因。
- **Validation**: fake controller 单元测试。

### Task 2.2: 重构 `DigitalHumanPlayer.vue`

- **Location**: `src/components/DigitalHumanPlayer.vue`
- **Description**: 移除正式路径上的视频资源探测和 `<video>`，嵌入 `RiveAvatarCanvas`，保留现有 props/events 的兼容层。
- **Dependencies**: Task 2.1。
- **Acceptance Criteria**:
  - `AgentChat.vue` 可以暂时不大改即可跑通。
  - 现有 `stopSignal`、`narration-ended` 仍有效。
  - 不再请求 `public/videos/digital-human/*.mp4`。
- **Validation**: Network 检查、现有服务旅程回归。

### Task 2.3: 增加静态降级驱动

- **Location**: `src/avatar/StaticAvatarFallback.vue`, `public/avatar/campus-assistant-fallback.svg`
- **Description**: 在 Rive 初始化超时、契约错误或运行时异常时展示静态角色和 CSS 状态光圈。
- **Dependencies**: Task 2.2。
- **Acceptance Criteria**:
  - 降级不使用 MP4/WebM。
  - 用户仍能听 TTS、停止播报和阅读文字来源。
  - 只重试一次，避免初始化抖动。
- **Validation**: 拦截 `.riv`/WASM 请求进行故障注入。

### Task 2.4: 建立 Feature Flag

- **Location**: `src/config/app.ts`, `server/.env.example`
- **Description**: 增加 `VITE_AVATAR_DRIVER=rive|static|off` 和资源路径配置。
- **Dependencies**: Tasks 2.2–2.3。
- **Acceptance Criteria**:
  - `static` 和 `off` 不加载 Rive/WASM。
  - 切换配置不影响 RAG 和 TTS 服务端。
- **Validation**: 三种构建模式分别验证。

## 9. Sprint 3: TTS 队列解耦与实时口型

**Duration**: 3–4 个工作日  
**Goal**: 将现有 TTS 播放器变成可测试的 narration controller，并用 Web Audio 实时驱动嘴部。  
**Demo/Validation**:

- 固定测试文本可边播边驱动嘴部。
- 停止后 100ms 内声音停止、嘴部归零。
- 连续十段音频按顺序播放，不发生重叠和旧回调污染。

### Task 3.1: 提取文本清理和分段函数

- **Location**: `src/avatar/narration/text.ts`
- **Description**: 从 `DigitalHumanPlayer.vue` 提取 Markdown 清理、140 字限制和按句分段。
- **Dependencies**: Sprint 2。
- **Acceptance Criteria**:
  - 中文标点、Markdown 链接、URL、超长无标点文本均有测试。
  - 不改变现有 TTS 长度保护行为。
- **Validation**: Vitest 单元测试。

### Task 3.2: 建立 `TtsNarrationController`

- **Location**: `src/avatar/narration/TtsNarrationController.ts`
- **Description**: 封装队列、session token、TTS 请求、Audio 元素、ObjectURL、开始/结束/错误事件。
- **Dependencies**: Task 3.1。
- **Acceptance Criteria**:
  - 新 session 原子取消旧队列。
  - `stop()` 幂等。
  - 每个 ObjectURL 最终只 revoke 一次。
  - 组件销毁后没有异步回调更新 UI。
- **Validation**: fake fetch/audio 测试乱序、超时、失败、停止和销毁。

### Task 3.3: 建立 `AudioLipSync`

- **Location**: `src/avatar/audio/AudioLipSync.ts`
- **Description**: 复用一个 AudioContext、MediaElementSource 和 AnalyserNode，按帧计算 RMS 并输出平滑的 mouthOpen/energy。
- **Dependencies**: Task 3.2。
- **Acceptance Criteria**:
  - 静音时 `mouthOpen=0`。
  - attack/release 参数可配置。
  - stop/end/error/unmount 全部归零并停止 RAF。
  - 不对同一个 Audio 元素重复 `createMediaElementSource`。
- **Validation**: 合成波形单元测试与真机录屏。

### Task 3.4: 处理浏览器音频解锁

- **Location**: `src/views/AgentChat.vue`, `src/avatar/narration/TtsNarrationController.ts`
- **Description**: 在用户发送、点击快捷问题或明确开启声音时 `resume()` AudioContext；欢迎动画默认无声。
- **Dependencies**: Task 3.3。
- **Acceptance Criteria**:
  - Chrome/Safari 首次访问不依赖有声自动播放。
  - 播放被阻止时给出“点击开启语音”的可操作提示。
- **Validation**: 清除站点权限后重新测试桌面和 iOS Safari。

### Task 3.5: 连接 Rive 口型属性

- **Location**: `src/components/DigitalHumanPlayer.vue`, `src/avatar/RiveAvatarController.ts`
- **Description**: 将 `AudioLipSync` 输出批量写入 `mouthOpen` 和 `energy`，只在数值变化超过阈值时更新。
- **Dependencies**: Tasks 3.3–3.4。
- **Acceptance Criteria**:
  - 回答开始前嘴部不动。
  - 音频段之间自然闭合，不长时间张嘴。
  - reduced-motion 不关闭嘴部必要反馈。
- **Validation**: 固定音频 A/B 和低端手机性能测试。

## 10. Sprint 4: RAG、TTS 与 Avatar 状态机整合

**Duration**: 2–3 个工作日  
**Goal**: 让卡通助手准确表达“正在思考/正在说话/已停止”，而不是用视频 cue 近似表示。  
**Demo/Validation**:

- 用户发送后立即进入 thinking。
- 第一段音频真正播放时进入 speaking。
- RAG 已结束但语音未结束时仍保持 speaking。
- 点击停止只停止讲解，不丢失正在生成的文字答案。

### Task 4.1: 引入显式 Avatar Store 状态

- **Location**: `src/store/agent.ts`, `src/types/agent.ts`
- **Description**: 新增 `avatarMode` 和 narration session 状态，逐步替换 `videoCueKey/videoPlayTick` 命名。
- **Dependencies**: Sprint 3。
- **Acceptance Criteria**:
  - store 不包含 Rive 实例或音频节点。
  - 持久化会话不保存瞬时 speaking/thinking 状态。
  - 刷新后默认回到 idle。
- **Validation**: store 单元测试和会话恢复测试。

### Task 4.2: 重构 narration 事件

- **Location**: `src/components/DigitalHumanPlayer.vue`, `src/store/agent.ts`
- **Description**: 增加 `narration-started`、`segment-started`、`narration-ended`、`narration-error`、`narration-stopped`。
- **Dependencies**: Task 4.1。
- **Acceptance Criteria**:
  - speaking 由“音频开始”事件触发，不由“文本入队”触发。
  - 旧 session 的 ended 事件不能把新 session 切回 idle。
- **Validation**: 快速连续两问、停止后再问和慢 TTS 测试。

### Task 4.3: 建立合法状态迁移

- **Location**: `src/avatar/AvatarStateMachine.ts`
- **Description**: 定义 idle → thinking → speaking → idle，以及 interrupt/error 的合法路径和 sessionId 校验。
- **Dependencies**: Task 4.2。
- **Acceptance Criteria**:
  - 非法旧事件被忽略并仅在 debug 模式记录。
  - TTS 失败不阻止 RAG 文字和来源完成。
  - 第二问会立即终止上一问的音频并进入 thinking。
- **Validation**: 状态转换表驱动测试。

### Task 4.4: 更新页面控制语义

- **Location**: `src/views/AgentChat.vue`
- **Description**: 将“停止讲解”连接到 narration stop；增加静音/开启声音，状态标签显示真实的待机、思考、讲解和降级。
- **Dependencies**: Task 4.3。
- **Acceptance Criteria**:
  - 停止按钮不取消 RAG 请求。
  - 静音设置刷新后保持。
  - 状态标签不再固定显示 ONLINE。
- **Validation**: 键盘操作和全链路人工测试。

## 11. Sprint 5: 正式视觉、响应式、性能与无障碍

**Duration**: 3–5 个工作日，与 Sprint 1–4 的前端工作并行  
**Goal**: 接入正式角色并满足桌面、手机、性能和无障碍要求。  
**Demo/Validation**:

- 正式角色在五档屏幕宽度下完整可见。
- 低性能设备、后台标签和减少动态模式行为正确。
- 角色不遮挡聊天输入、答案来源或登录提示。

### Task 5.1: 交付正式 `.riv`

- **Location**: `public/avatar/`
- **Description**: 美术按契约导出 v1 资产，通过 AvatarLab 全状态验收。
- **Dependencies**: Sprint 0。
- **Acceptance Criteria**:
  - 契约字段零缺失。
  - 角色动作自然，不复制第三方 IP。
  - 透明背景和安全区正确。
- **Validation**: 设计验收清单和录屏。

### Task 5.2: 更新数字人舞台 UI

- **Location**: `src/views/AgentChat.vue`, `src/components/DigitalHumanPlayer.vue`, `src/styles/design-system.css`
- **Description**: 建立豆包式渐变舞台、柔和光圈、状态文案和控制区，保持现有校园品牌风格。
- **Dependencies**: Task 5.1、Sprint 2。
- **Acceptance Criteria**:
  - 数字人是辅助信息，不压过回答与来源。
  - 动画背景不与 `.riv` 内 FX 重复叠加造成噪声。
- **Validation**: 桌面/手机截图评审。

### Task 5.3: 响应式画布与 DPR 控制

- **Location**: `src/components/RiveAvatarCanvas.vue`, `src/views/AgentChat.vue`
- **Description**: 使用 ResizeObserver，限制渲染 DPR，按容器尺寸调整 Rive drawing surface。
- **Dependencies**: Task 5.2。
- **Acceptance Criteria**:
  - 五档宽度无横向溢出。
  - 移动端优先显示聊天内容和输入框。
  - 高清屏保持清晰但不无限放大 Canvas 内存。
- **Validation**: 现有 `ui:inspect:mobile` 脚本和真机检查。

### Task 5.4: 页面可见性和低性能策略

- **Location**: `src/components/RiveAvatarCanvas.vue`, `src/avatar/RiveAvatarController.ts`
- **Description**: 后台标签停止渲染；回到前台恢复；持续低帧时关闭 FX 或切静态降级。
- **Dependencies**: Task 5.3。
- **Acceptance Criteria**:
  - 后台不持续运行嘴部 RAF。
  - 低帧降级不停止音频和文字服务。
  - 不发生 Rive/static 来回抖动。
- **Validation**: CPU 节流、visibilitychange 和连续十轮测试。

### Task 5.5: 无障碍与用户偏好

- **Location**: `src/components/DigitalHumanPlayer.vue`, `src/config/app.ts`
- **Description**: 支持 `prefers-reduced-motion`、关闭数字人、静音持久化和可访问状态文本。
- **Dependencies**: Task 5.2。
- **Acceptance Criteria**:
  - Canvas 对屏幕阅读器隐藏，并用文本状态描述角色状态。
  - 控件可键盘访问且有可见焦点。
  - 关闭数字人后不加载 Rive/WASM。
- **Validation**: 键盘、屏幕阅读器快速检查和系统减少动态设置。

## 12. Sprint 6: 测试、部署、灰度和回滚

**Duration**: 3–4 个工作日  
**Goal**: 把 Rive 卡通助手纳入正式发布门禁，完成真实腾讯 TTS、目标设备和故障回滚验证。  
**Demo/Validation**:

- CI/本地测试覆盖队列、状态、口型和降级。
- 正式域名完成 Chrome、Edge、Android、iOS 验收。
- 一个配置即可切换为 static/off。

### Task 6.1: 增加前端测试基础

- **Location**: `package.json`, `vitest.config.ts`, `src/**/__tests__/`
- **Description**: 引入 Vitest 与 Vue Test Utils，封装可替换的 AudioContext、Audio 和 Rive controller。
- **Dependencies**: Sprint 2。
- **Acceptance Criteria**:
  - 测试不需要真实 GPU、扬声器或腾讯云账户。
  - narration、lip-sync、state machine 和组件清理均可自动测试。
- **Validation**: 新增 `npm run test:frontend`。

### Task 6.2: 扩展服务旅程测试

- **Location**: `server/scripts/service-journey-browser.mjs`
- **Description**: 使用 fake Rive/fake TTS 验证 thinking → speaking → idle、停止、第二问覆盖和静态降级。
- **Dependencies**: Sprint 4、Task 6.1。
- **Acceptance Criteria**:
  - 数字人失败不掩盖 RAG 旅程结果。
  - 现有游客、登录和来源断言无回归。
- **Validation**: `npm run service:journey` 连续运行稳定。

### Task 6.3: 增加发布资源检查

- **Location**: `server/scripts/check-release-assets.mjs`, `.gitattributes`
- **Description**: 检查 `.riv`、fallback、WASM、manifest、hash 和二进制声明。
- **Dependencies**: Task 5.1。
- **Acceptance Criteria**:
  - 资源缺失、契约版本错误或 hash 不一致时发布门禁失败。
  - `dist` 不包含腾讯云永久密钥。
- **Validation**: 故意删除资源验证检查会失败。

### Task 6.4: 生产部署与缓存

- **Location**: `docs/deploy-server-checklist.md`, 实际 Web 服务器配置
- **Description**: 配置 WASM MIME、同源路径、缓存头、CSP 和 HTTPS。
- **Dependencies**: Task 6.3。
- **Acceptance Criteria**:
  - `.riv` 和 WASM 带版本长缓存。
  - manifest 可快速刷新和回滚。
  - CSP 不依赖海外域名通配符。
- **Validation**: 正式域名 Network 与响应头检查。

### Task 6.5: 真实设备验收

- **Location**: `docs/rive-avatar-live-validation.md`
- **Description**: 用真实 RAG、腾讯 TTS 和正式角色验证完整链路。
- **Dependencies**: Tasks 6.1–6.4。
- **Acceptance Criteria**:
  - 覆盖首次进入、发送、慢回答、长回答、停止、第二问、网络中断、后台恢复和连续十轮。
  - 覆盖 Windows Chrome/Edge、Android Chrome、iOS Safari。
- **Validation**: 记录构建提交、资产版本、设备、结果和录屏。

### Task 6.6: 灰度发布

- **Location**: 部署配置与发布记录
- **Description**: 按开发环境 → 内部成员 → 小比例用户 → 全量启用。
- **Dependencies**: Task 6.5。
- **Acceptance Criteria**:
  - 每阶段观察初始化成功率、静态降级率、TTS 错误和停止率。
  - 超过门槛立即切到 `VITE_AVATAR_DRIVER=static`。
- **Validation**: 每阶段形成发布决策记录。

## 13. Testing Strategy

### 13.1 Unit Tests

- 文本清理和分句：中文标点、Markdown、URL、超长文本。
- TTS 队列：顺序、取消、超时、失败、旧 session、destroy。
- 音量口型：静音阈值、归一化、attack/release、结束归零。
- Avatar 状态机：正常迁移、停止、错误、第二问覆盖、旧事件。
- Rive 契约：属性缺失、类型错误、版本不匹配。

### 13.2 Component Tests

- Rive ready 后显示 Canvas。
- `.riv` 或 WASM 失败后显示静态降级。
- narration-started 切 speaking，queue ended 切 idle。
- stop signal 同时停音频和口型，不取消文字回答。
- unmount 清理 Rive、ResizeObserver、RAF、AudioNode 和 ObjectURL。

### 13.3 Browser/E2E

- 首次访问不自动有声播放。
- 点击发送后成功解锁 AudioContext。
- RAG 流式文字与数字人状态互不阻塞。
- TTS 失败时仍展示完整回答和来源。
- 第二问不会听到上一问残留声音。
- 静音、关闭数字人和 reduced-motion 刷新后保持。

### 13.4 Performance Budgets

- 首屏不阻塞聊天区域渲染；Rive 可延迟加载。
- `.riv` 建议控制在 1MB 内，超过 2MB 必须做资产审查。
- 正常设备目标 50–60 FPS；低端移动设备最低可接受 30 FPS。
- 连续十轮问答后，Rive 实例、AudioNode、RAF 和 ObjectURL 数量不增长。
- 页面后台时停止口型采样和非必要渲染。

## 14. Observability

建议记录以下匿名指标：

- `avatar_init_duration_ms`
- `avatar_init_success_rate`
- `avatar_fallback_total{reason}`
- `avatar_mode_transition_total{from,to}`
- `tts_request_duration_ms`
- `narration_queue_depth`
- `narration_stop_total{reason}`
- `audio_context_resume_failure_total`

禁止记录用户问题正文、RAG 回答正文、音频内容、学校账号和腾讯云密钥。

## 15. Risks and Gotchas

1. **Rive 不是国内产品**：运行资源可以完全自托管在国内，但编辑/导出账号和采购需提前确认。
2. **生产导出需要付费计划**：免费编辑不等于可将正式 `.riv` 发布到产品。
3. **美术契约是主要交付风险**：如果先做动画后补属性命名，前端会频繁返工；必须先冻结 runtime contract。
4. **音量口型不是精确音素口型**：首版目标是自然卡通开合。若后续要求 a/i/u/e/o，可单独评估 TTS 音素时间戳或离线音素分析。
5. **浏览器自动播放限制**：第一段声音必须在用户手势之后恢复 AudioContext。
6. **同一个 Audio 元素只能建立一次 MediaElementSource**：重复创建会报错，必须长期复用音频图。
7. **LLM 完成不等于播报完成**：thinking、stream complete、TTS queue 和 audio ended 必须分别管理。
8. **当前工作区已有大量未提交修改**：实施时只做增量改动，不清理或覆盖其他修改。
9. **Rive 默认可能请求海外 WASM**：生产必须显式自托管并在网络面板验证。
10. **移动端高 DPR 会放大内存**：必须限制 canvas backing store 的 DPR。
11. **复杂粒子和矢量层会增加 CPU**：状态效果应克制，并准备静态降级。
12. **正式角色资产不可只保存在个人账号**：项目需要源文件、账号归属和授权证明。

## 16. Rollback Plan

### 16.1 即时配置回滚

```dotenv
VITE_AVATAR_DRIVER=static
```

重新构建后停止加载 Rive/WASM，保留静态卡通形象、RAG、TTS、文字和来源。

### 16.2 完全关闭

```dotenv
VITE_AVATAR_DRIVER=off
```

数字人舞台折叠或显示品牌插画，问答主链路继续工作。

### 16.3 资产回滚

- `manifest.json` 指向上一版 `.riv`。
- 每次资产使用新版本文件名，不覆盖旧文件。
- 至少保留一个稳定版本和对应 fallback 一个发布周期。

### 16.4 不推荐的回滚

正式发布后不把 MP4 重新设为默认驱动。视频方案只作为开发期视觉对照；正式故障降级应为 static/off，以满足“不是视频播放”的产品要求。

## 17. Recommended Execution Order

1. 冻结原创角色视觉与 Rive runtime contract。
2. 同时启动正式美术制作和前端最小 Rive POC。
3. 完成 WASM 自托管、Canvas 生命周期和静态降级。
4. 提取 TTS 队列并完成 Web Audio 口型。
5. 将 video cue 重构为 thinking/speaking 等真实业务状态。
6. 接入正式 `.riv`，完成响应式、性能和无障碍。
7. 补齐自动化、正式域名、真机和连续十轮验证。
8. 先内部灰度，再全量；始终保留 static/off 开关。

## 18. Definition of Done

- 正式页面不加载或播放 MP4/WebM 数字人视频。
- 卡通角色由 Rive Canvas 在浏览器实时渲染。
- 待机、思考、回答、停止和异常状态正确且可打断。
- 腾讯 TTS 播放时嘴部自然开合，停止/结束后立即归零。
- RAG 流式文字、来源、登录和游客流程无回归。
- `.riv` 和 WASM 全部同源自托管，生产不请求海外 CDN。
- Rive/TTS 任一失败都不阻塞文字问答，并降级为静态角色。
- 桌面、Android、iOS 验收通过，连续十轮无资源泄漏。
- 资产、Rive 导出、字体和品牌使用授权完成登记。
- 发布检查、灰度指标和 static/off 回滚演练均有记录。

## 19. Official References

- Rive Web Runtime: https://rive.app/docs/runtimes/web/web-js
- Rive Data Binding: https://rive.app/docs/runtimes/web/data-binding
- Rive State Machines: https://rive.app/docs/runtimes/web/state-machines
- Rive WASM Self-hosting: https://rive.app/docs/runtimes/web/preloading-wasm
- Rive Runtime Cleanup and Resize: https://rive.app/docs/runtimes/web/rive-parameters
- Rive Runtime Export: https://rive.app/docs/editor/exporting/exporting-for-runtime
- Rive Runtime License: https://rive.app/docs/runtimes/getting-started

