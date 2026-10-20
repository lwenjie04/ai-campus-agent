# Plan: Live2D Web 数字人接入现有 RAG

**Generated**: 2026-08-20  
**Estimated Complexity**: High  
**Target**: Vue 3 + Vite 纯 Web 正式版本  
**Selected Solution**: Live2D Cubism SDK for Web + 现有 RAG + 腾讯云 TTS

## 1. Overview

本计划把当前“预生成 MP4 + 腾讯云 TTS”数字人升级为浏览器本地渲染的 Live2D 数字人，同时保持现有 RAG、来源展示、登录、社区与知识运营链路不变。

核心原则：

1. RAG 决定“答什么”，Live2D 只负责“怎么呈现”。
2. 数字人是增强层，初始化、模型、WebGL 或 TTS 故障不得阻塞文字回答与来源展示。
3. 先保留当前 `DigitalHumanPlayer` 对外协议，再在内部引入可切换驱动层，避免一次性重写 `AgentChat` 和 Pinia 流程。
4. 第一阶段用 Web Audio 音量包络驱动嘴部开合，先获得稳定、可测试的正式能力；MotionSync 作为后续增强，在模型、许可和性能验证通过后启用。
5. 正式发布前必须完成 Live2D SDK 发布许可、模型版权、学校品牌使用和第三方素材授权核验。

### 1.1 默认范围

- 支持 PC Chrome/Edge、Android Chrome 和 iOS Safari 的当前主流版本。
- 首期保留文字输入，不新增 ASR。
- 继续使用现有服务端腾讯云 TTS，不把腾讯云永久密钥放入浏览器。
- Live2D 默认显示在当前左侧数字人舞台。
- 手机端保持聊天优先；数字人舞台允许延后加载、降低帧率或折叠。
- 保留 `greeting.mp4`、`idle.mp4`、`teaching.mp4` 作为自动降级资源。
- 第一版只支持一个“校园学姐导办员”模型，不建设多角色管理后台。

### 1.2 非目标

- 不改写 RAG 检索、提示词、来源排序和知识审核逻辑。
- 不接入 Live2D 摄像头面捕或用户表情捕捉。
- 不在浏览器中暴露腾讯云 `SecretId` / `SecretKey`。
- 不在首期制作复杂全身舞蹈、手势编排或多角色同屏。
- 不以保护模型文件不被下载为安全目标；Web 模型资产天然会下发到客户端。

## 2. Target Architecture

```text
用户提问
   │
   ▼
AgentChat.vue
   │
   ▼
Pinia agent store ── streamChat ── Node /chat/stream ── RAG + LLM
   │                                      │
   │                                      └── 回答文本、来源、requestId
   │
   ├── 聊天消息与来源卡片（主链路）
   │
   └── NarrationCommand（增强链路）
           │
           ▼
DigitalHumanPlayer.vue
           │
           ▼
DigitalHumanDriver 接口
   ├── Live2DDriver
   │      ├── Cubism WebGL renderer
   │      ├── model / motion / expression
   │      └── AudioLipSync
   │
   └── VideoFallbackDriver
          └── 当前 MP4 + Audio 播放

NarrationCommand ── TtsNarrationQueue ── POST /tts ── 腾讯云 TTS
                               │
                               ├── AudioContext 播放
                               └── AnalyserNode → ParamMouthOpenY
```

### 2.1 驱动层接口

计划新增统一驱动接口，避免 Live2D 逻辑渗入页面和 RAG store：

```ts
type DigitalHumanState = 'loading' | 'greeting' | 'idle' | 'thinking' | 'speaking' | 'error'

interface DigitalHumanDriver {
  init(container: HTMLElement): Promise<void>
  setState(state: DigitalHumanState): Promise<void> | void
  speak(command: NarrationCommand): Promise<void>
  stop(reason: 'user' | 'superseded' | 'unmount' | 'error'): void
  setMuted(muted: boolean): void
  destroy(): void
}
```

`DigitalHumanPlayer.vue` 只负责编排状态、驱动选择、降级和向父组件回传事件；具体渲染与音频实现放入独立模块。

## 3. Success Criteria

### 3.1 功能指标

- RAG 流式文字和来源展示在 Live2D 初始化失败时仍可完整使用。
- 第一段完整句子到达后，数字人进入 speaking 状态并开始 TTS 队列。
- 同一回答的句子严格按序播放，不重复、不跨回答串音。
- 用户点击“停止播放”后，当前音频、待播队列和口型在 300ms 内停止。
- 新问题开始时自动取消上一回答未播完的讲解。
- 页面隐藏、路由离开或组件卸载后不再播放音频，不残留 WebGL/AudioContext 资源。
- Live2D 失败时自动切换到 MP4；MP4 也失败时只关闭数字人，不影响问答。

### 3.2 体验指标

- 聊天界面先可用，Live2D SDK 和模型延迟加载，不阻塞首屏问答。
- 口型由实际播放的同一条音频驱动，主观音画漂移控制在可接受范围内。
- 360、390、768、1024、1440 像素目标宽度无页面横向溢出。
- 支持静音、停止讲解和减少动态效果；屏幕阅读器仍可读取完整回答。
- 浏览器禁止自动播放时，页面给出明确的“开启语音讲解”交互，不静默失败。

### 3.3 性能与稳定性指标

- Live2D 代码通过动态导入进入独立 chunk，不显著增加聊天主入口初始 JS。
- 移动端默认目标 24–30 FPS，桌面端目标 30 FPS；低性能设备允许自动降帧。
- 连续完成 10 轮问答后，音频对象 URL、WebGL 纹理和事件监听器均被释放。
- 模型加载超时、WebGL context lost、TTS 429/5xx、网络断开均有可观察状态和降级路径。

## 4. Prerequisites and Release Gates

### 4.1 必需输入

- Live2D Cubism SDK for Web 的正式下载包，而不是未经审核的社区运行时。
- 经授权的校园数字人模型：`.moc3`、`.model3.json`、纹理、动作、表情和物理文件。
- 模型至少具备：眨眼、呼吸、头部转动、身体轻微摆动、嘴部开合参数。
- 当前腾讯云 TTS 生产资源、音色 ID、调用额度和限流策略。
- 产品负责人确认模型形象、学校标识、服装和声音使用权。

### 4.2 P0 发布门槛

以下任一项未完成时，只允许内部 POC，不允许正式发布：

- Live2D SDK Publication License 适用性得到书面结论。
- 模型美术、绑定、动作、声音和校徽素材有清晰授权链。
- 明确仓库是否允许存放 Cubism Core；若不允许，改用私有制品库在 CI 构建时注入。
- 模型文件可被浏览器下载的风险得到业务接受。
- 腾讯 TTS 正式环境额度、费用预警和限流配置已确认。

### 4.3 官方资料基线

- Live2D Cubism SDK for Web：<https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/>
- Vite 接入说明：<https://docs.live2d.com/en/cubism-sdk-tutorials/use-sdk-in-js/>
- Web WAV 音量口型：<https://docs.live2d.com/en/cubism-sdk-tutorials/native-lipsync-from-wav-web/>
- MotionSync Web：<https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-motionsync-plugin-for-web/>
- Live2D 发布许可：<https://www.live2d.com/en/sdk/license/>
- 腾讯云基础 TTS：<https://cloud.tencent.com/document/api/1073/37995>

## 5. Sprint 0: POC、许可和模型契约

**Goal**: 在不接入业务页面的前提下，验证官方 SDK、Vite、目标浏览器和候选模型可运行，并冻结生产模型契约。  
**Demo/Validation**:

- 独立 POC 页面能加载官方示例模型并稳定显示待机动作。
- 桌面 Chrome/Edge、Android Chrome、iOS Safari 至少各完成一次真机验证。
- 一段本地 WAV 能驱动嘴部开合。
- 输出许可结论、模型资产清单和性能基线。

### Task 0.1: 建立许可与素材审核记录

- **Location**: `docs/live2d-license-and-assets.md`
- **Description**: 记录 SDK 许可适用范围、模型作者、声音来源、校徽授权、发布日期和负责人。
- **Dependencies**: 无，可与 Task 0.2 并行。
- **Acceptance Criteria**:
  - 每项资产有来源、用途、授权状态和到期日。
  - 未确认项明确标为阻塞，不使用“默认可商用”等推断。
- **Validation**: 产品负责人和项目负责人共同签字或在评审记录中确认。

### Task 0.2: 定义校园学姐模型交付规范

- **Location**: `docs/live2d-model-spec.md`
- **Description**: 固定画布比例、服装、品牌色、嘴部参数、动作组、表情组、纹理尺寸和移动端预算。
- **Dependencies**: 无，可与 Task 0.1 并行。
- **Acceptance Criteria**:
  - 定义 `Idle`、`Greeting`、`Thinking`、`Speaking` 四组动作。
  - 定义 `ParamMouthOpenY`，可选 `ParamMouthForm`。
  - 定义 neutral、smile、concern 三种表情，避免根据敏感身份推断情绪。
  - 明确模型缩放后在当前竖向舞台中的安全区域。
- **Validation**: 在 Cubism Viewer 中完成动作、表情和参数逐项验收。

### Task 0.3: 记录当前工程基线

- **Location**: `docs/live2d-poc-baseline.md`
- **Description**: 记录当前 Git 状态、生产构建体积、目标宽度截图、TTS 首包时间和连续问答行为。不得清理或覆盖现有未提交修改。
- **Dependencies**: 无。
- **Acceptance Criteria**:
  - 保存 `npm run build`、`npm run release:check` 结果。
  - 保存当前 MP4 数字人的桌面与移动截图。
  - 记录一轮完整问答的文字、TTS 和停止操作表现。
- **Validation**: 基线可由同一命令和同一测试问题复现。

### Task 0.4: 建立隔离 Live2D POC

- **Location**: `poc/live2d-web/` 或临时独立分支，不直接挂载到生产路由
- **Description**: 按官方 Vite 指引引入 Core/Framework，加载官方示例模型并实现 init/render/destroy。
- **Dependencies**: Task 0.1 的开发期许可确认。
- **Acceptance Criteria**:
  - 不依赖社区 `pixi-live2d-display`。
  - 页面重复进入和离开不出现重复 RAF 或 WebGL 报错。
  - SDK、Framework 和 Core 版本写入清单并保持一致。
- **Validation**: POC 构建通过，三类目标浏览器真机运行。

### Task 0.5: 验证基础口型方案

- **Location**: `poc/live2d-web/`
- **Description**: 使用同一 AudioContext 播放 WAV，并通过 `AnalyserNode` 的音量包络更新 `ParamMouthOpenY`。
- **Dependencies**: Task 0.4。
- **Acceptance Criteria**:
  - 播放、暂停、停止均正确影响嘴部状态。
  - 静音片段嘴部自然闭合，辅音和短停顿不持续张嘴。
  - iOS 在用户手势解锁音频后可正常播放。
- **Validation**: 使用固定 WAV 录屏，人工检查音画同步和抖动。

## 6. Sprint 1: 数字人驱动适配层与零回归降级

**Goal**: 在不改变现有视觉和播放结果的前提下，把当前播放器重构为驱动接口，建立后续 Live2D 的安全接入点。  
**Demo/Validation**:

- 默认配置仍使用现有 MP4 + TTS。
- `AgentChat.vue` 的 props/events 行为不变。
- 切换到不存在的驱动时自动回退视频驱动。

### Task 1.1: 定义驱动与播报命令类型

- **Location**: `src/digital-human/types.ts`
- **Description**: 定义状态、驱动接口、初始化结果、错误类型、播报命令和停止原因。
- **Dependencies**: Sprint 0 模型契约。
- **Acceptance Criteria**:
  - `NarrationCommand` 包含 sessionId、requestId、sequence、text、final。
  - 错误类型区分 SDK、MODEL、WEBGL、AUDIO、TTS 和 AUTOPLAY。
  - 接口不引用 Live2D 专有类型。
- **Validation**: `npm run type-check`。

### Task 1.2: 抽取现有视频驱动

- **Location**: `src/digital-human/drivers/VideoFallbackDriver.ts`
- **Description**: 将 `DigitalHumanPlayer.vue` 中视频探测、cue 切换、音频队列、停止和 URL 释放逻辑迁入视频驱动。
- **Dependencies**: Task 1.1。
- **Acceptance Criteria**:
  - greeting/idle/teaching 行为与当前一致。
  - 缺少视频时仍显示明确占位状态。
  - `destroy()` 释放 Audio、ObjectURL、timer 和事件回调。
- **Validation**: 现有手工流程和新增驱动单元测试通过。

### Task 1.3: 建立驱动工厂

- **Location**: `src/digital-human/createDigitalHumanDriver.ts`
- **Description**: 根据配置异步创建 `live2d`、`video` 或 `off` 驱动；Live2D 创建失败时回退视频驱动。
- **Dependencies**: Tasks 1.1–1.2。
- **Acceptance Criteria**:
  - 驱动选择不散落在组件和 store 中。
  - 回退原因可记录但不向用户暴露密钥或内部堆栈。
- **Validation**: 工厂测试覆盖三种模式和初始化失败场景。

### Task 1.4: 将播放器改为编排组件

- **Location**: `src/components/DigitalHumanPlayer.vue`
- **Description**: 保留现有 props/events，由组件调用驱动工厂并管理 init、state、speak、stop、destroy。
- **Dependencies**: Tasks 1.1–1.3。
- **Acceptance Criteria**:
  - `request-idle` 和 `narration-ended` 继续工作。
  - props 高频变化不会重复初始化驱动。
  - 卸载时只调用一次 `destroy()`。
- **Validation**: 组件测试和当前浏览器旅程通过。

### Task 1.5: 添加配置与功能开关

- **Location**: `src/config/app.ts`, `.env.example`, `docs/deploy-server-checklist.md`
- **Description**: 增加驱动、模型清单、调试和口型模式配置。
- **Dependencies**: Task 1.3。
- **Acceptance Criteria**:
  - 支持 `VITE_DIGITAL_HUMAN_DRIVER=video|live2d|off`。
  - 支持 `VITE_LIVE2D_MODEL_MANIFEST_URL` 和 `VITE_LIVE2D_LIPSYNC_MODE=volume|motionsync`。
  - 默认仍为 `video`，直到正式发布门槛完成。
  - 所有前端变量均不包含服务端密钥。
- **Validation**: 三种构建配置均通过类型检查和构建。

## 7. Sprint 2: Live2D 官方运行时集成

**Goal**: 在现有数字人舞台中加载正式候选模型，具备待机、缩放、生命周期和错误恢复能力。  
**Demo/Validation**:

- 设置 `VITE_DIGITAL_HUMAN_DRIVER=live2d` 后显示 Live2D 模型。
- 模型待机、眨眼、呼吸正常。
- 路由切换、标签页隐藏和窗口缩放后仍稳定。

### Task 2.1: 建立受控第三方 SDK 目录

- **Location**: `vendor/live2d/README.md`, `vendor/live2d/manifest.json`; Core/Framework 的实际位置由许可结论决定
- **Description**: 固定 SDK 版本、校验哈希、来源、许可文件和构建注入方式。
- **Dependencies**: Task 0.1。
- **Acceptance Criteria**:
  - 不通过未审核 CDN 动态加载 SDK。
  - Core 与 Framework 版本一致。
  - CI 缺少授权制品时给出清晰失败，不从未知地址下载。
- **Validation**: 校验脚本能检测缺失、版本不一致和哈希变化。

### Task 2.2: 配置 Vite 与动态导入

- **Location**: `vite.config.ts`, `src/digital-human/live2d/loadCubismRuntime.ts`
- **Description**: 按官方指引配置 TS/JS 解析，使用 `import()` 延迟加载 Live2D 代码。
- **Dependencies**: Task 2.1。
- **Acceptance Criteria**:
  - 聊天主入口可在 Live2D chunk 尚未下载时使用。
  - `video` 与 `off` 构建路径不执行 Live2D 初始化。
  - 生产构建不出现重复 Cubism Core。
- **Validation**: 检查 Vite chunk 清单并运行生产预览。

### Task 2.3: 建立模型清单和校验器

- **Location**: `public/live2d/models/campus-guide/`, `public/live2d/manifest.json`, `src/digital-human/live2d/validateModelManifest.ts`
- **Description**: 用清单描述模型、纹理、动作、表情和可选 MotionSync 文件，初始化前检查必需项。
- **Dependencies**: Task 0.2。
- **Acceptance Criteria**:
  - 模型清单包含版本、hash、入口、纹理和状态动作映射。
  - 缺失模型参数时在加载前失败并触发降级。
  - 资源路径支持部署在同源静态目录或 CDN 基础路径。
- **Validation**: 清单校验单元测试覆盖完整、缺失和非法路径。

### Task 2.4: 实现 Live2DDriver 初始化与渲染循环

- **Location**: `src/digital-human/live2d/Live2DDriver.ts`
- **Description**: 创建 Canvas/WebGL 上下文，加载模型，启动 RAF，并对外实现统一驱动接口。
- **Dependencies**: Tasks 2.1–2.3、Task 1.1。
- **Acceptance Criteria**:
  - 初始化具有超时和取消信号。
  - 高 DPR 设备限制实际渲染像素，避免纹理和 fill-rate 失控。
  - `destroy()` 停止 RAF 并释放纹理、模型和事件监听器。
- **Validation**: 连续挂载/卸载 20 次无重复 RAF 和明显内存增长。

### Task 2.5: 实现舞台自适应与安全区域

- **Location**: `src/digital-human/live2d/Live2DViewport.ts`, `src/components/DigitalHumanPlayer.vue`
- **Description**: 使用 ResizeObserver 适配舞台尺寸，按模型安全区计算缩放、底部对齐和裁切。
- **Dependencies**: Task 2.4。
- **Acceptance Criteria**:
  - 宽屏保持半身构图，手机不裁掉面部和口型区域。
  - ResizeObserver 被正确清理。
  - 低于最小舞台高度时进入紧凑布局而不是无限缩小。
- **Validation**: 五个目标宽度截图对比，无横向溢出。

### Task 2.6: 管理页面可见性和 WebGL 生命周期

- **Location**: `src/digital-human/live2d/Live2DDriver.ts`
- **Description**: 处理 `visibilitychange`、IntersectionObserver、`webglcontextlost` 和 `webglcontextrestored`。
- **Dependencies**: Task 2.4。
- **Acceptance Criteria**:
  - 页面隐藏或舞台离屏时暂停高频渲染。
  - context lost 时停止播报并尝试一次恢复；失败后回退视频驱动。
  - 页面恢复时不重复播放已结束音频。
- **Validation**: DevTools 模拟 context loss、切换标签页和滚动离屏。

## 8. Sprint 3: 流式回答、TTS 队列与基础口型

**Goal**: 将现有按句播报升级为带会话标识、顺序、取消和音频同步的正式管线。  
**Demo/Validation**:

- RAG 回答生成过程中，完整句子依次播报。
- 嘴部由实际播放音频实时驱动。
- 停止、新问题、异常和卸载均不会串音。

### Task 3.1: 抽取并测试可朗读文本切分器

- **Location**: `src/digital-human/narration/splitSpeakableChunks.ts`, `src/digital-human/narration/__tests__/splitSpeakableChunks.test.ts`
- **Description**: 从 `src/store/agent.ts` 抽取句子切分，处理中文标点、列表、URL、Markdown 链接、连续空白和尾句。
- **Dependencies**: Task 1.1。
- **Acceptance Criteria**:
  - 不朗读 Markdown 控制符和裸链接。
  - 单个片段超过 TTS 安全长度时在自然停顿处分段。
  - 流式 delta 任意切分时最终结果一致。
- **Validation**: 表驱动测试覆盖中文、英文、列表、链接和无标点长文本。

### Task 3.2: 引入显式播报会话

- **Location**: `src/store/agent.ts`, `src/digital-human/types.ts`
- **Description**: 用 sessionId/requestId/sequence/final 生成 `NarrationCommand`，替代仅靠 text + tick 判断顺序。
- **Dependencies**: Task 3.1。
- **Acceptance Criteria**:
  - 每次提问建立新的 narration session。
  - 旧 session 的迟到回调被忽略。
  - store 只产生命令，不持有 Audio/WebGL 对象。
- **Validation**: 模拟交错 delta、新问题覆盖和异常结束。

### Task 3.3: 建立 TTS 播放队列

- **Location**: `src/digital-human/narration/TtsNarrationQueue.ts`, `src/api/tts.ts`
- **Description**: 串行请求 TTS、缓存当前句、播放 AudioBuffer，并提供 stop/flush/destroy。
- **Dependencies**: Task 3.2。
- **Acceptance Criteria**:
  - 同一 session 严格按 sequence 播放。
  - stop 会 abort 尚未完成的 fetch，停止 AudioBufferSourceNode 并清空队列。
  - TTS 单句失败时记录错误并继续下一句或按策略整体降级。
  - 所有 ObjectURL、AbortController 和 AudioNode 可回收。
- **Validation**: 使用 fake fetch/AudioContext 测试乱序、429、超时、取消和销毁。

### Task 3.4: 统一服务端 TTS 输出契约

- **Location**: `server/tts.mjs`, `src/api/tts.ts`, `server/tests/tts-auth.test.mjs`
- **Description**: 明确返回 MIME、采样率、provider 和 requestId；正式 Live2D 音量口型优先使用可被 Web Audio 稳定解码的 WAV。
- **Dependencies**: Task 3.3。
- **Acceptance Criteria**:
  - 继续保留登录/Token 鉴权和 IP/用户限流。
  - 响应头不缓存私有播报内容。
  - 生产密钥只存在服务端。
  - Windows SAPI 开发兜底仍可使用。
- **Validation**: 后端测试覆盖成功、未登录、限流、格式和 provider 回退。

### Task 3.5: 实现音量包络口型驱动

- **Location**: `src/digital-human/audio/AudioLipSync.ts`, `src/digital-human/live2d/Live2DDriver.ts`
- **Description**: 从当前播放 AudioContext 获取时域或频域数据，平滑映射到 Live2D 口型参数。
- **Dependencies**: Tasks 2.4、3.3。
- **Acceptance Criteria**:
  - 使用 attack/release 平滑，避免嘴部高频抖动。
  - 无声阈值、最小开口和最大开口可配置。
  - 音频结束、停止或异常时参数回到 0。
  - 口型更新与渲染 RAF 共用时钟，不新增第二个无限循环。
- **Validation**: 固定音频波形测试映射结果，真机录屏人工验收。

### Task 3.6: 建立统一停止语义

- **Location**: `src/views/AgentChat.vue`, `src/components/DigitalHumanPlayer.vue`, `src/store/agent.ts`, `src/digital-human/narration/TtsNarrationQueue.ts`
- **Description**: 将用户停止、被新回答覆盖、组件卸载和错误停止统一映射到 driver.stop。
- **Dependencies**: Tasks 3.2–3.5。
- **Acceptance Criteria**:
  - 当前“停止播放”按钮继续只停止讲解，不取消 RAG 文本生成。
  - 新问题自动终止上一播报 session。
  - `narration-ended` 仅对当前 session 触发一次。
- **Validation**: 自动测试四种停止原因和重复点击。

### Task 3.7: 处理浏览器音频解锁

- **Location**: `src/components/DigitalHumanPlayer.vue`, `src/views/AgentChat.vue`
- **Description**: 在第一次用户发送、点击开启语音或其他明确手势时 resume AudioContext；欢迎动作默认静音。
- **Dependencies**: Task 3.3。
- **Acceptance Criteria**:
  - 不依赖有声自动播放。
  - 被浏览器阻止时显示可操作提示。
  - 用户选择静音后不反复弹提示。
- **Validation**: Chrome、Safari 清除站点权限后首次访问测试。

## 9. Sprint 4: 动作、表情、状态与响应式体验

**Goal**: 将数字人从“会张嘴的模型”升级为具有稳定状态语义的校园导办角色。  
**Demo/Validation**:

- 页面打开、等待回答、开始讲解、讲解结束和异常时状态转换自然。
- 桌面与手机布局可用，减少动态和静音设置有效。

### Task 4.1: 建立状态机

- **Location**: `src/digital-human/DigitalHumanStateMachine.ts`
- **Description**: 定义 loading → greeting → idle → thinking → speaking → idle/error 的合法迁移和防抖。
- **Dependencies**: Sprint 3。
- **Acceptance Criteria**:
  - speaking 期间不会被普通 idle tick 抢占。
  - error 可进入 video fallback，恢复后重新初始化而不重复播报。
  - 非法迁移在 debug 模式记录，生产不抛出导致页面崩溃。
- **Validation**: 状态转换单元测试覆盖正常和异常路径。

### Task 4.2: 映射模型动作与表情

- **Location**: `public/live2d/manifest.json`, `src/digital-human/live2d/Live2DDriver.ts`
- **Description**: 将状态映射到模型动作组与表情，设置淡入淡出和打断优先级。
- **Dependencies**: Task 4.1、Task 0.2。
- **Acceptance Criteria**:
  - greeting 只在首次会话或重置时触发一次。
  - thinking 动作短、可循环且不夸张。
  - speaking 动作不覆盖口型参数。
  - 不基于用户身份、性别、专业等敏感画像推断表情。
- **Validation**: 状态演示页逐项触发并录屏评审。

### Task 4.3: 增加数字人控制与真实状态提示

- **Location**: `src/components/DigitalHumanPlayer.vue`, `src/views/AgentChat.vue`
- **Description**: 增加静音/开启语音、停止讲解、重试加载；把固定 ONLINE 标签改为 loading/ready/speaking/fallback/offline。
- **Dependencies**: Tasks 4.1–4.2。
- **Acceptance Criteria**:
  - 状态文本真实反映驱动状态。
  - 控件有键盘焦点、ARIA label 和可见焦点样式。
  - 技术错误转换为用户可理解文案。
- **Validation**: 键盘操作、屏幕阅读器快速检查和错误注入。

### Task 4.4: 响应式和低性能策略

- **Location**: `src/views/AgentChat.vue`, `src/components/DigitalHumanPlayer.vue`, `src/digital-human/live2d/Live2DDriver.ts`
- **Description**: 根据视口、DPR、设备内存提示和实际帧时选择纹理、分辨率、FPS 与是否自动加载。
- **Dependencies**: Sprint 2、Task 4.3。
- **Acceptance Criteria**:
  - 手机聊天区优先，数字人不占据首屏关键输入空间。
  - 高 DPR 被限制，后台标签页暂停渲染。
  - 连续低帧时降到低纹理/低 FPS；仍不稳定则视频降级。
- **Validation**: 五档宽度、CPU 节流和低端 Android 真机验证。

### Task 4.5: 尊重用户偏好和无障碍设置

- **Location**: `src/config/app.ts`, `src/components/DigitalHumanPlayer.vue`, `src/styles/design-system.css`
- **Description**: 支持静音持久化、`prefers-reduced-motion`、关闭数字人和仅文字模式。
- **Dependencies**: Tasks 4.3–4.4。
- **Acceptance Criteria**:
  - reduced-motion 下减少身体动作和背景动画，但保留必要口型或提供关闭选项。
  - 关闭数字人不影响问答和来源。
  - 用户设置在刷新后保持。
- **Validation**: 系统减少动态设置、键盘导航和 localStorage 禁用场景。

## 10. Sprint 5: MotionSync 可选增强与生产加固

**Goal**: 在基础音量口型稳定后评估更精细的音素/口型同步，并完成资源、故障、安全和可观测性加固。  
**Demo/Validation**:

- 可通过功能开关在 volume 与 motionsync 间切换。
- 任一增强功能失败都能回到 volume 或 video。
- 模型和 SDK 资源具备版本、缓存和回滚能力。

### Task 5.1: 评估并接入 MotionSync

- **Location**: `src/digital-human/live2d/motion-sync/`, `vendor/live2d/manifest.json`, `public/live2d/manifest.json`
- **Description**: 使用官方 MotionSync Plugin/Core 和 `.motionsync3.json`，禁止仅从 GitHub 复制缺少 Core 的不完整实现。
- **Dependencies**: Sprint 3 稳定、许可确认、模型支持 MotionSync。
- **Acceptance Criteria**:
  - 通过 feature flag 启用。
  - MotionSync 初始化失败自动回到 volume。
  - 在目标移动设备上满足帧率和内存预算后才设为默认。
- **Validation**: 同一组音频进行 A/B 录屏、帧率和内存对比。

### Task 5.2: 建立静态资源版本和缓存策略

- **Location**: `public/live2d/manifest.json`, `docs/deploy-server-checklist.md`, Nginx 配置片段
- **Description**: 模型与纹理使用内容 hash 或版本目录，manifest 短缓存，二进制和纹理长缓存 immutable。
- **Dependencies**: Task 2.3。
- **Acceptance Criteria**:
  - 新模型发布不会与旧缓存混用。
  - 回滚只需切换 manifest 版本。
  - CDN/同源部署均保持正确 MIME 与 CORS。
- **Validation**: 首次加载、二次缓存命中和版本回滚测试。

### Task 5.3: 实现分层故障恢复

- **Location**: `src/digital-human/createDigitalHumanDriver.ts`, `src/components/DigitalHumanPlayer.vue`
- **Description**: 定义 Live2D → video → off 的降级矩阵和一次性恢复策略。
- **Dependencies**: Sprint 4。
- **Acceptance Criteria**:
  - 模型 404、初始化超时、context lost、TTS 失败分别记录明确原因。
  - 不出现无限重试和驱动来回抖动。
  - 降级过程中回答文本和来源不丢失。
- **Validation**: 网络拦截和错误注入覆盖每种故障。

### Task 5.4: 增加匿名化运行指标

- **Location**: `src/digital-human/telemetry.ts`, `server/index.mjs` 或现有日志入口
- **Description**: 记录 driver、init duration、model version、fallback reason、TTS duration、queue depth 和 stop reason，不上传回答正文或音频。
- **Dependencies**: Task 5.3。
- **Acceptance Criteria**:
  - requestId 可关联 RAG 与数字人错误。
  - 日志不包含用户问题、回答正文、密钥和模型二进制内容。
  - 采样和保留周期可配置。
- **Validation**: 日志字段审查和隐私检查。

### Task 5.5: 完成 CSP、供应链和资产安全检查

- **Location**: `docs/deploy-server-checklist.md`, `server/scripts/check-release-assets.mjs`, `package-lock.json`
- **Description**: 固定 SDK hash、检查模型清单、验证 CSP/Web Worker/WASM 需求，禁止永久云密钥进入前端产物。
- **Dependencies**: Tasks 2.1、5.2。
- **Acceptance Criteria**:
  - release check 能检测 SDK/模型缺失和 hash 不一致。
  - 扫描 dist 不包含腾讯云 SecretId/SecretKey。
  - CSP 只开放实际需要的资源源，不使用无边界通配符。
- **Validation**: `npm run release:check` 加入对应检查并在故意破坏配置时失败。

### Task 5.6: 完成性能预算与泄漏检查

- **Location**: `server/scripts/inspect-responsive-layout.mjs`, 新增 `server/scripts/inspect-digital-human-performance.mjs`
- **Description**: 记录 SDK chunk、模型下载、初始化、FPS、长任务、纹理内存和连续问答资源释放。
- **Dependencies**: Sprint 4、Task 5.1。
- **Acceptance Criteria**:
  - 超预算给出 WARN 或在严格发布门槛中失败。
  - 10 轮问答后无持续增长的 AudioBufferSource、RAF 和 ObjectURL。
  - 低性能策略可被自动触发并记录。
- **Validation**: 桌面与移动模拟各跑一轮性能脚本。

## 11. Sprint 6: 自动化测试、部署与灰度发布

**Goal**: 把 Live2D 纳入现有发布门禁，先内部灰度，再逐步成为 Web 默认驱动。  
**Demo/Validation**:

- 离线 CI 不依赖真实腾讯云服务即可覆盖主要状态。
- 目标环境完成真实 TTS、模型 CDN、移动端和回退验证。
- 切换一个环境变量即可回退当前视频方案。

### Task 6.1: 添加前端测试基础设施

- **Location**: `package.json`, `vite.config.ts` 或独立 `vitest.config.ts`, `src/**/__tests__/`
- **Description**: 引入 Vitest、Vue Test Utils 和浏览器环境模拟，建立 WebGL/AudioContext 可替换接口。
- **Dependencies**: Sprint 1。
- **Acceptance Criteria**:
  - 测试不依赖真实 GPU 和音频设备。
  - driver、queue、state machine、splitter 和组件降级均有覆盖。
- **Validation**: 新增 `npm run test:frontend` 并在 CI 稳定通过。

### Task 6.2: 扩展浏览器服务旅程

- **Location**: `server/scripts/service-journey-browser.mjs`
- **Description**: 在 Mock TTS/假驱动下验证 ready → speaking → idle、停止、下一问覆盖和 fallback，不改变现有游客/登录/审核闭环断言。
- **Dependencies**: Task 6.1、Sprint 4。
- **Acceptance Criteria**:
  - 数字人断言失败不会掩盖 RAG 主链路结果。
  - 测试可显式选择 fake、video 或 live2d sample 模式。
- **Validation**: `npm run service:journey` 重复运行无随机失败。

### Task 6.3: 扩展响应式视觉检查

- **Location**: `server/scripts/inspect-responsive-layout.mjs`
- **Description**: 在五档宽度记录模型舞台尺寸、canvas 实际像素、面部可见性和横向溢出。
- **Dependencies**: Task 4.4。
- **Acceptance Criteria**:
  - 五档宽度页面溢出保持 0。
  - 手机端聊天输入不被模型遮挡。
  - fallback 与 live2d 两种模式均检查。
- **Validation**: 生成截图和结构化检查结果。

### Task 6.4: 更新发布与部署文档

- **Location**: `README.md`, `docs/deploy-server-checklist.md`, `docs/release-checklist.md`, `public/live2d/README.md`
- **Description**: 记录 SDK 注入、模型部署、环境变量、缓存、CSP、TTS、降级、调试和回滚步骤。
- **Dependencies**: Sprint 5。
- **Acceptance Criteria**:
  - 新环境可按文档完成部署。
  - 文档明确区分开发示例模型与正式授权模型。
  - 文档包含不暴露腾讯云密钥的检查步骤。
- **Validation**: 由未参与实现的人按文档完成一次预发布部署。

### Task 6.5: 目标环境真实验证

- **Location**: `docs/live2d-live-validation.md`
- **Description**: 使用正式域名、真实腾讯 TTS、正式模型和目标设备验证完整链路。
- **Dependencies**: Tasks 6.1–6.4。
- **Acceptance Criteria**:
  - 覆盖首次访问、音频解锁、流式回答、停止、连续十轮、后台恢复和网络中断。
  - Chrome/Edge、Android Chrome、iOS Safari 形成验收记录。
  - 记录模型版本、SDK 版本、构建提交和测试时间。
- **Validation**: 评审签字后才能设置 `VITE_DIGITAL_HUMAN_DRIVER=live2d`。

### Task 6.6: 分阶段启用

- **Location**: 部署环境配置与发布记录
- **Description**: 按内部成员 → 小比例试运营 → 全量的顺序启用 Live2D。
- **Dependencies**: Task 6.5。
- **Acceptance Criteria**:
  - 每阶段观察初始化成功率、fallback 率、TTS 错误率和用户停止率。
  - 超过预设错误门槛立即切回 `video`。
  - 全量前保留至少一个稳定视频版本可回滚。
- **Validation**: 每阶段形成发布决策记录。

## 12. Testing Strategy

### 12.1 Unit Tests

- `splitSpeakableChunks`: 任意 delta 切分、中文标点、Markdown、URL、超长文本。
- `TtsNarrationQueue`: 顺序、取消、超时、429、旧 session 回调、destroy。
- `AudioLipSync`: RMS/包络、静音阈值、attack/release、结束归零。
- `DigitalHumanStateMachine`: 合法迁移、错误恢复、重复事件。
- `createDigitalHumanDriver`: live2d/video/off、初始化失败和回退。
- `validateModelManifest`: 完整、缺失、路径和版本错误。

### 12.2 Component Tests

- 初始化期间显示 loading。
- live2d 驱动成功后进入 ready。
- Live2D 初始化失败切换 video。
- narration props 生成正确命令。
- stop signal 只停止当前 session。
- unmount 释放驱动且不重复 emit。

### 12.3 Browser/E2E Tests

- 首次进入静音欢迎动作。
- 用户发送问题后解锁音频并开始讲解。
- RAG 来源显示不依赖数字人状态。
- 用户停止讲解后文本仍继续生成。
- 第二问打断第一问未播完队列。
- 模型 404、TTS 500、WebGL context lost 自动降级。
- 游客试问、登录续问、知识审核原旅程无回归。

### 12.4 Manual Real-device Matrix

| Platform | Browser | Required checks |
|---|---|---|
| Windows | Chrome / Edge | WebGL、音频解锁、缩放、后台恢复 |
| macOS | Safari / Chrome | Web Audio、DPR、context 恢复 |
| Android | Chrome | FPS、内存、横竖屏、低性能降级 |
| iOS | Safari | 用户手势解锁、AudioContext 恢复、页面后台切换 |

## 13. Deployment and Operations

### 13.1 推荐环境变量

```dotenv
VITE_DIGITAL_HUMAN_DRIVER=live2d
VITE_LIVE2D_MODEL_MANIFEST_URL=/live2d/manifest.json
VITE_LIVE2D_LIPSYNC_MODE=volume
VITE_VIDEO_DEBUG=false
```

服务端继续使用：

```dotenv
TTS_PROVIDER=tencentcloud
TENCENTCLOUD_TTS_SAMPLE_RATE=16000
TENCENTCLOUD_TTS_CODEC=wav
```

### 13.2 缓存建议

- `manifest.json`: 短缓存或 `no-cache`，允许快速切换版本。
- `.moc3`、纹理、动作和表情: 文件名带 hash，长缓存 immutable。
- SDK/Core: 固定版本与内容 hash，长缓存 immutable。
- TTS 响应: `no-store`，不进入共享缓存。

### 13.3 监控建议

- `live2d_init_success_rate`
- `live2d_init_duration_ms`
- `live2d_fallback_total{reason}`
- `tts_request_duration_ms`
- `tts_error_total{code}`
- `narration_queue_depth`
- `narration_stop_total{reason}`
- `digital_human_driver_distribution`

不得将问题正文、回答正文、音频内容或永久密钥写入指标标签和日志。

## 14. Potential Risks and Gotchas

1. **纯 Web 无法防止模型被下载**：只能通过授权、版本管理和轻度防盗链降低滥用，不能承诺技术防提取。
2. **发布许可可能成为时间阻塞**：Live2D 明确区分开发验证和正式发布，许可审查应在工程实现早期并行启动。
3. **官方 SDK 不是普通 npm 依赖**：Core/Framework 版本、制品存放和 CI 注入需要单独管理。
4. **音量口型不是音素口型**：第一版只保证自然开合；若需要 a/i/u/e/o 等嘴型，应在模型和性能验收后使用 MotionSync。
5. **MotionSync Core 不在公开 GitHub 仓库**：不能只复制开源组件后宣称接入完成，必须使用官方分发包。
6. **浏览器自动播放限制**：欢迎语不能依赖自动有声播放，首次声音必须由用户手势解锁。
7. **当前 TTS 是按句完整返回**：基础版本能边生成边按句播报，但首句延迟仍受 TTS 请求影响；后续可单独评估服务端实时 TTS WebSocket，不应与首版 Live2D 同时扩大范围。
8. **移动端 WebGL 性能差异大**：必须延迟加载、限制 DPR、暂停离屏渲染并保留 video/off 降级。
9. **当前工作区存在未提交修改**：实施时只能增量改动，不得通过 reset/checkout 清理用户现有变化。
10. **当前前端缺少专用单元测试框架**：驱动重构前应先建立最小 Vitest 基础，避免依靠肉眼验证音频队列和取消竞态。
11. **回答结束不等于播报结束**：状态机必须分别跟踪 LLM stream、TTS queue 和 audio playback，不能复用一个 loading 布尔值。
12. **ObjectURL/AudioNode/RAF 泄漏不容易在短测暴露**：必须加入连续十轮和重复挂载/卸载测试。

## 15. Rollback Plan

### 15.1 即时回滚

生产环境设置：

```dotenv
VITE_DIGITAL_HUMAN_DRIVER=video
```

重新构建并部署后恢复当前 MP4 + TTS。RAG、数据库、认证和知识库无需回滚。

### 15.2 运行时自动降级

```text
Live2D 初始化或运行失败
        ↓
VideoFallbackDriver
        ↓
视频也失败
        ↓
数字人关闭，仅保留文字与来源
```

### 15.3 模型回滚

- manifest 指向上一版本模型目录。
- 旧模型资源至少保留一个发布周期。
- 不覆盖同名模型文件，避免 CDN 和浏览器缓存混用。

### 15.4 代码回滚边界

- `DigitalHumanDriver` 接口和 VideoFallbackDriver 应作为长期架构保留。
- 若 Live2D 被撤回，仅删除 Live2D 具体实现和资源，不恢复到播放器内混合所有逻辑的旧结构。
- 不回滚 RAG、来源展示和现有 TTS 鉴权加固。

## 16. Recommended Execution Order

1. 同时启动许可审核、模型规范和隔离 POC。
2. POC 通过后先完成驱动适配层，默认仍用 video。
3. 接入正式候选模型，完成生命周期和响应式。
4. 重构播报 session 与 TTS 队列，完成 volume 口型。
5. 完成状态动作、控制、低性能策略和自动降级。
6. 评估 MotionSync，不把它设为首版阻塞项。
7. 补齐测试、部署、真实设备验证和灰度。
8. 所有发布门槛完成后，才把默认驱动切为 live2d。

## 17. Definition of Done

- 正式授权模型在目标 Web 浏览器稳定加载。
- RAG、来源、登录、社区和知识审核全部通过现有质量门禁。
- 数字人能按句播报、自然开合口型、停止、被新问题打断并回到待机。
- Live2D、WebGL、模型、TTS 任一故障均不阻塞文字服务。
- 五档响应式检查和目标真机矩阵通过。
- 前端不包含腾讯云永久密钥。
- SDK、模型、声音和品牌素材发布许可完成。
- release check、service journey、真实服务验证和回滚演练均有记录。

