<template>
  <div class="page-bg">
    <main class="command-shell">
      <section class="human-rail" aria-label="校园事务快捷入口">
        <header class="brand-bar">
          <div class="school-badge">
            <img
              v-if="!logoLoadFailed"
              :src="schoolLogoSrc"
              alt="广东第二师范学院校徽"
              class="school-logo"
              @error="logoLoadFailed = true"
            />
            <span v-else class="school-badge-fallback">广二师</span>
          </div>
          <div class="brand-copy">
            <span class="brand-kicker">GDEI AI CAMPUS</span>
            <h1>校园智能服务</h1>
          </div>
        </header>

        <div class="quick-command">
          <span class="quick-command__label">常用事务</span>
          <button type="button" @click="store.sendMessage('转专业需要什么条件')">转专业条件</button>
          <button type="button" @click="store.sendMessage('考试违规会怎么处理')">考试违规处理</button>
          <button type="button" @click="store.sendMessage('奖学金评定一般看哪些条件')">奖学金评定</button>
          <button type="button" @click="store.sendMessage('宿舍调换需要走什么流程')">宿舍调换流程</button>
        </div>

        <div class="human-status-card">
          <div class="status-line">
            <span class="status-dot" :class="{ 'status-dot--active': store.loading }" />
            <span>{{ store.loading ? '讲解同步中' : '数字人待机' }}</span>
          </div>
          <div class="stage-wrap">
            <DigitalHumanPlayer
              :cue-key="store.videoCueKey"
              :play-signal="store.videoPlayTick"
              :narration-text="store.narrationText"
              :narration-signal="store.narrationTick"
              :stop-signal="stopPlaySignal"
              @request-idle="onGreetingEnded"
              @narration-ended="onNarrationEnded"
            />
          </div>
        </div>

        <div class="rail-actions">
          <button type="button" class="rail-action" @click="onStopPlayback">停止讲解</button>
          <button type="button" class="rail-action rail-action--primary" @click="settingsDialogVisible = true">
            用户设置
          </button>
        </div>

        <div class="rail-context" :title="summaryTitle">
          <span>{{ roleLabel }}</span>
          <span>{{ selectedGrade || '未填年级' }}</span>
          <span>{{ selectedMajor || '未填专业' }}</span>
        </div>
      </section>

      <section class="chat-workspace" aria-label="校园智能问答">
        <header class="workspace-header">
          <div>
            <span class="workspace-kicker">AI CAMPUS COMMAND</span>
            <h2>直接问，先给结论，再展开依据</h2>
            <p>面向学生日常查询：学籍、选课、考试、奖助、宿舍与校园流程。</p>
          </div>
        </header>

        <div class="chat-body">
          <ChatWindow
            :messages="visibleMessages"
            :loading="store.loading"
            @open-community-post="emit('openCommunityPost', $event)"
          />
        </div>

        <footer class="input-area">
          <InputBox :loading="store.loading" @send="store.sendMessage" />
        </footer>
      </section>

      <aside class="source-desk" aria-label="知识来源与上下文">
        <section class="source-panel source-panel--active">
          <span>LightRAG</span>
          <strong>Ready</strong>
          <p>学生手册与社区知识将作为主要检索来源。</p>
        </section>

        <section class="source-panel">
          <span>当前身份</span>
          <strong>{{ roleLabel }}</strong>
          <p>{{ selectedGrade || '未填年级' }} · {{ selectedMajor || '未填专业' }}</p>
        </section>

        <section class="source-panel source-panel--list">
          <span>回答策略</span>
          <ul>
            <li>先输出可执行结论</li>
            <li>只显示来源数量</li>
            <li>需要时展开详细依据</li>
          </ul>
        </section>
      </aside>
    </main>

    <!-- 用户设置改为弹窗形式，避免直接挤占右侧聊天区的高度 -->
    <el-dialog
      v-model="settingsDialogVisible"
      title="用户设置"
      width="min(520px, calc(100vw - 32px))"
      class="settings-dialog"
      destroy-on-close
    >
      <div class="settings-panel settings-panel--dialog">
        <div class="profile-controls profile-controls--dialog">
          <div class="setting-field">
            <div class="setting-label">身份</div>
            <el-select v-model="selectedRole" size="small" class="ctrl-select ctrl-select--dialog" @change="onRoleChange">
              <el-option
                v-for="option in roleOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>

          <div class="setting-field">
            <div class="setting-label">年级</div>
            <el-select
              v-model="selectedGrade"
              size="small"
              class="ctrl-select ctrl-select--dialog"
              clearable
              placeholder="年级"
              @change="onGradeChange"
            >
              <el-option
                v-for="option in gradeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
          </div>

          <div class="setting-field setting-field--full">
            <div class="setting-label">专业</div>
            <el-input
              v-model="draftMajor"
              size="small"
              class="major-input"
              clearable
              placeholder="输入专业"
              @blur="commitMajorDraft"
              @keyup.enter="commitMajorDraft"
              @clear="clearMajor"
            />
          </div>

          <div class="setting-field setting-field--full">
            <div class="demo-switch demo-switch--dialog">
              <span class="demo-switch-label">演示模式</span>
              <el-switch
                v-model="demoModeEnabled"
                inline-prompt
                active-text="开"
                inactive-text="关"
                @change="onDemoModeChange"
              />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="settingsDialogVisible = false">关闭</el-button>
          <el-button text class="reset-btn" @click="resetChat">重置会话</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
// 引入 Vue 组合式 API：
// ref 用于定义基础响应式变量
// computed 用于定义依赖其他状态自动更新的计算属性
// onMounted 用于在页面挂载后执行初始化逻辑
import { computed, onMounted, ref } from 'vue'

// 引入右侧聊天列表组件
import ChatWindow from '@/components/ChatWindow.vue'

// 引入输入框组件
import InputBox from '@/components/InputBox.vue'

// 引入左侧数字人播放器组件
import DigitalHumanPlayer from '@/components/DigitalHumanPlayer.vue'

// 引入全局智能体 store
import { useAgentStore } from '@/store/agent'

const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
}>()

// 用户身份的允许值。
// 通过联合类型约束，避免传入不受支持的角色字符串。
type UserRole = 'student' | 'teacher' | 'guest'

// 年级的允许值。
// 空字符串表示用户暂时没有填写年级。
type GradeValue = '' | '大一' | '大二' | '大三' | '大四' | '大五' | '研一' | '研二' | '研三'

// 获取 Pinia store 实例。
// 页面中的业务状态大多都由 store 维护。
const store = useAgentStore()

// 校徽是否加载失败。
// 如果失败，模板里会从图片切换为“广二师”文字兜底。
const logoLoadFailed = ref(false)

// 校徽路径。
// 后续如果替换校徽资源，只需要改这一处。
const schoolLogoSrc = '/branding/gdei-logo.png'

// 用户设置弹窗是否打开。
// 这是纯页面 UI 状态，不需要持久化。
const settingsDialogVisible = ref(false)

// 停止播放信号。
// 为什么不用 boolean？
// 因为 boolean 连续点击可能值不变，子组件 watch 不到；
// 数字递增则每次点击都会触发一次变化。
const stopPlaySignal = ref(0)

// 演示模式开关。
// 这个值会和 store 同步，但先在页面层保留一个本地响应式状态，方便和表单绑定。
const demoModeEnabled = ref(true)

// 可见消息列表。
// store.messages 中包含一条隐藏的 system 消息，它是发给大模型的提示词，不应显示给用户。
// 所以这里过滤掉 role === 'system' 的消息，只展示 user 和 assistant。
const visibleMessages = computed(() => store.messages.filter((msg) => msg.role !== 'system'))

// 当前页面上选中的角色。
const selectedRole = ref<UserRole>('student')

// 当前页面上选中的年级。
const selectedGrade = ref<GradeValue>('大三')

// 当前页面上已经正式提交的专业。
const selectedMajor = ref('软件工程')

// 专业输入框中的草稿值。
// 用户输入时只改这个值，失焦/回车时再提交给 selectedMajor 和 store。
const draftMajor = ref(selectedMajor.value)

// 身份下拉选项。
const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '学生', value: 'student' },
  { label: '教师', value: 'teacher' },
  { label: '访客', value: 'guest' },
]

// 年级下拉选项。
const gradeOptions: Array<{ label: string; value: GradeValue }> = [
  { label: '大一', value: '大一' },
  { label: '大二', value: '大二' },
  { label: '大三', value: '大三' },
  { label: '大四', value: '大四' },
  { label: '大五', value: '大五' },
  { label: '研一', value: '研一' },
  { label: '研二', value: '研二' },
  { label: '研三', value: '研三' },
]

// 角色值到中文标签的映射。
// 页面显示中文，store 中保存稳定的英文值，两者分离更利于维护。
const roleLabelMap: Record<UserRole, string> = {
  student: '学生',
  teacher: '教师',
  guest: '访客',
}

// 头部摘要显示的角色名。
const roleLabel = computed(() => roleLabelMap[selectedRole.value] || '用户')

// 鼠标移到右上角摘要区域时显示的完整提示。
// 之所以做成 computed，是因为它依赖角色、年级、专业三个响应式状态。
const summaryTitle = computed(
  () => `身份：${roleLabel.value} / 年级：${selectedGrade.value || '未填写'} / 专业：${selectedMajor.value || '未填写'}`,
)

// 把 store 中的持久化用户信息同步回页面表单。
// 使用场景：
// 1. 页面刚刷新，localStorage 恢复后，需要把值重新显示到表单
// 2. 调用 resetSession / hydrateSession 后，需要重新对齐页面状态
const syncFormFromStore = () => {
  selectedRole.value = (store.userProfile.role as UserRole) || 'student'
  selectedGrade.value = (store.userProfile.grade as GradeValue) || ''
  selectedMajor.value = store.userProfile.major || ''
  draftMajor.value = selectedMajor.value
  demoModeEnabled.value = store.demoMode
}

// 身份变化时：
// 1. 更新 store 中的 userProfile
// 2. 重新刷新 system prompt
// 这样后续大模型回答会使用新的身份背景。
const onRoleChange = (role: UserRole) => {
  store.setUserProfile({ role })
  store.refreshSystemPrompt()
}

// 年级变化时的处理逻辑。
const onGradeChange = (grade: GradeValue | undefined) => {
  selectedGrade.value = grade || ''
  store.setUserProfile({ grade: selectedGrade.value })
  store.refreshSystemPrompt()
}

// 提交专业草稿。
// 这个函数只在失焦或按下回车时调用，而不是在每个输入事件中调用。
// 这样可以避免用户打字时频繁刷新 system prompt。
const commitMajorDraft = () => {
  const next = draftMajor.value.trim()

  // 如果前后值没有变化，就直接返回，避免重复写入。
  if (next === selectedMajor.value) return

  // 先更新页面中的正式专业值。
  selectedMajor.value = next

  // 再写入 store，并刷新 system prompt。
  store.setUserProfile({ major: selectedMajor.value })
  store.refreshSystemPrompt()
}

// 清空专业输入框。
// clear 事件触发后先把 draft 置空，再复用统一提交逻辑。
const clearMajor = () => {
  draftMajor.value = ''
  commitMajorDraft()
}

// 演示模式切换事件。
// 页面本身不做额外处理，直接委托给 store。
const onDemoModeChange = (value: boolean) => {
  store.setDemoMode(value)
}

// 重置会话按钮。
// 由 store 统一清理消息、system prompt、视频状态和持久化缓存。
const resetChat = () => {
  store.resetSession()
}

// 停止播放按钮：
// 1. 让 store 停止当前讲解逻辑
// 2. 通过 stopPlaySignal 通知数字人组件立即停止媒体播放
const onStopPlayback = () => {
  store.stopNarrationPlayback()
  stopPlaySignal.value += 1
}

// 欢迎视频播完后的回调。
// DigitalHumanPlayer 会 emit('request-idle')，页面再把这个事件转发给 store。
const onGreetingEnded = () => {
  store.onGreetingEnded()
}

// 讲解语音播报结束后的回调。
const onNarrationEnded = () => {
  store.onNarrationEnded()
}

// 组件挂载后执行初始化流程。
onMounted(() => {
  // 第一步：恢复本地缓存的会话。
  store.hydrateSession()

  // 第二步：把恢复出来的数据同步到页面表单。
  syncFormFromStore()

  // 第三步：如果 store 里某些用户信息还不存在，就补上页面默认值。
  // 这样首次打开页面时，大模型也能拿到一个基础用户画像。
  if (!store.userProfile.role) {
    store.setUserProfile({ role: selectedRole.value })
  }
  if (!store.userProfile.grade && selectedGrade.value) {
    store.setUserProfile({ grade: selectedGrade.value })
  }
  if (!store.userProfile.major && selectedMajor.value) {
    store.setUserProfile({ major: selectedMajor.value })
  }

  // 第四步：再次同步一次，确保表单和 store 完全一致。
  syncFormFromStore()

  // 第五步：初始化智能体。
  // 这里通常会刷新 system prompt，并触发欢迎视频。
  store.initAgent()
})
</script>

<style scoped>
.page-bg {
  --ink: #f7fbff;
  --muted: rgba(217, 227, 255, 0.72);
  --panel: rgba(18, 24, 55, 0.72);
  --panel-soft: rgba(255, 255, 255, 0.08);
  --line: rgba(188, 205, 255, 0.18);
  --primary: #8f9cff;
  --cyan: #67e8f9;
  --green: #54d68a;
  min-height: 100vh;
  padding: 18px;
  box-sizing: border-box;
  color: var(--ink);
  background:
    radial-gradient(circle at 18% 16%, rgba(103, 232, 249, 0.2), transparent 28%),
    radial-gradient(circle at 74% 10%, rgba(143, 156, 255, 0.26), transparent 30%),
    radial-gradient(circle at 52% 88%, rgba(84, 214, 138, 0.12), transparent 32%),
    linear-gradient(135deg, #070b18 0%, #101633 45%, #192052 100%);
  overflow: hidden;
}

.page-bg::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(circle at 52% 42%, black, transparent 72%);
}

.command-shell {
  position: relative;
  z-index: 1;
  width: min(1500px, 100%);
  height: calc(100vh - 36px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
  gap: 18px;
}

.human-rail,
.chat-workspace {
  min-width: 0;
  border: 1px solid var(--line);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04)),
    var(--panel);
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.34),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(22px);
}

.human-rail {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: 14px;
  padding: 18px;
  border-radius: 30px;
  overflow: hidden;
}

.brand-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.school-badge {
  width: 50px;
  height: 50px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(203, 216, 255, 0.72));
  border: 1px solid rgba(255, 255, 255, 0.58);
  box-shadow: 0 14px 34px rgba(105, 123, 255, 0.22);
}

.school-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.school-badge-fallback {
  color: #172047;
  font-size: 11px;
  font-weight: 900;
}

.brand-copy {
  min-width: 0;
}

.brand-kicker,
.workspace-kicker {
  display: block;
  color: var(--cyan);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0;
}

.brand-copy h1,
.workspace-header h2 {
  margin: 3px 0 0;
  color: var(--ink);
  font-weight: 900;
  letter-spacing: 0;
  text-wrap: balance;
}

.brand-copy h1 {
  font-size: 20px;
}

.human-status-card {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 50% 8%, rgba(103, 232, 249, 0.18), transparent 38%),
    rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(188, 205, 255, 0.16);
}

.status-line {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: var(--green);
  box-shadow: 0 0 18px rgba(84, 214, 138, 0.85);
}

.status-dot--active {
  background: var(--cyan);
  animation: status-pulse 1.4s ease-out infinite;
}

.stage-wrap {
  min-height: 0;
  height: 100%;
}

.rail-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 9px;
}

.rail-action,
.prompt-strip button {
  border: 1px solid rgba(188, 205, 255, 0.18);
  color: var(--ink);
  background: rgba(255, 255, 255, 0.075);
  cursor: pointer;
  transition:
    transform 180ms ease,
    border-color 180ms ease,
    background 180ms ease;
}

.rail-action {
  min-height: 42px;
  border-radius: 16px;
  font-weight: 800;
}

.rail-action:hover,
.prompt-strip button:hover {
  transform: translateY(-1px);
  border-color: rgba(103, 232, 249, 0.42);
  background: rgba(103, 232, 249, 0.12);
}

.rail-action--primary {
  border-color: rgba(143, 156, 255, 0.48);
  background: linear-gradient(135deg, rgba(143, 156, 255, 0.38), rgba(103, 232, 249, 0.16));
}

.rail-context {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.rail-context span {
  max-width: 100%;
  padding: 6px 9px;
  border-radius: 999px;
  color: rgba(236, 242, 255, 0.86);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(188, 205, 255, 0.13);
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-workspace {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 14px;
  padding: 18px;
  border-radius: 34px;
  overflow: hidden;
}

.workspace-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.workspace-header h2 {
  font-size: clamp(24px, 3vw, 38px);
}

.workspace-badges,
.prompt-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workspace-badges {
  justify-content: flex-end;
}

.workspace-badges span {
  padding: 7px 10px;
  border-radius: 999px;
  color: rgba(236, 242, 255, 0.76);
  background: rgba(255, 255, 255, 0.075);
  border: 1px solid rgba(188, 205, 255, 0.14);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.prompt-strip button {
  min-height: 36px;
  border-radius: 999px;
  padding: 0 13px;
  color: rgba(247, 251, 255, 0.86);
  font-weight: 800;
}

.chat-body {
  min-height: 0;
  border-radius: 24px;
  padding: 10px;
  background:
    radial-gradient(circle at 50% 0%, rgba(143, 156, 255, 0.13), transparent 42%),
    rgba(5, 9, 24, 0.5);
  border: 1px solid rgba(188, 205, 255, 0.12);
  overflow: hidden;
}

.input-area {
  padding: 0 2px 2px;
}

.settings-panel--dialog {
  padding: 0;
  background: transparent;
  border: none;
}

.profile-controls--dialog {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 12px;
}

.setting-field {
  min-width: 0;
}

.setting-field--full {
  grid-column: 1 / -1;
}

.setting-label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 800;
  color: #24305f;
}

.ctrl-select--dialog {
  width: 100%;
}

.major-input {
  width: 100%;
}

.demo-switch--dialog {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(75, 92, 185, 0.08);
}

.demo-switch-label {
  font-size: 13px;
  color: #24305f;
  font-weight: 800;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.reset-btn {
  color: #5360c9;
  font-weight: 800;
}

:deep(.ctrl-select .el-select__wrapper),
:deep(.major-input .el-input__wrapper) {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: inset 0 0 0 1px rgba(83, 96, 201, 0.16) !important;
}

:deep(.settings-dialog .el-dialog) {
  border-radius: 24px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(249, 251, 255, 0.98), rgba(232, 237, 255, 0.96));
}

:deep(.settings-dialog .el-dialog__title) {
  color: #172047;
  font-size: 18px;
  font-weight: 900;
}

@keyframes status-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(103, 232, 249, 0.52);
  }
  100% {
    box-shadow: 0 0 0 14px rgba(103, 232, 249, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }
}

@media (max-width: 1040px) {
  .page-bg {
    overflow: auto;
  }

  .command-shell {
    height: auto;
    min-height: calc(100vh - 36px);
    grid-template-columns: 1fr;
  }

  .human-rail {
    grid-template-columns: minmax(0, 1fr) minmax(180px, 240px);
    grid-template-rows: auto auto;
  }

  .human-status-card {
    grid-row: 1 / 3;
    grid-column: 2;
    min-height: 260px;
  }

  .rail-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chat-workspace {
    min-height: 680px;
  }
}

@media (max-width: 720px) {
  .page-bg {
    padding: 10px;
  }

  .command-shell {
    min-height: calc(100vh - 20px);
    gap: 10px;
  }

  .human-rail,
  .chat-workspace {
    border-radius: 22px;
    padding: 12px;
  }

  .human-rail {
    display: grid;
    grid-template-columns: 1fr;
  }

  .human-status-card {
    grid-row: auto;
    grid-column: auto;
    min-height: 220px;
  }

  .workspace-header {
    flex-direction: column;
  }

  .workspace-badges {
    justify-content: flex-start;
  }

  .chat-workspace {
    min-height: 620px;
  }

  .profile-controls--dialog {
    grid-template-columns: 1fr;
  }
}

/* Raycast / Linear inspired command desk refresh. Placed last to intentionally supersede
   the previous dashboard styling while preserving the existing component logic. */
.page-bg {
  --desk-bg: #06070b;
  --desk-panel: rgba(13, 15, 22, 0.92);
  --desk-panel-soft: rgba(255, 255, 255, 0.055);
  --desk-card: rgba(255, 255, 255, 0.08);
  --desk-line: rgba(255, 255, 255, 0.12);
  --desk-text: #f4f7fb;
  --desk-muted: rgba(226, 232, 240, 0.62);
  --desk-accent: #7dd3fc;
  --desk-violet: #a5b4fc;
  min-height: 100vh;
  padding: 1rem;
  color: var(--desk-text);
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    radial-gradient(circle at 16% 0%, rgba(125, 211, 252, 0.16), transparent 22rem),
    radial-gradient(circle at 86% 8%, rgba(165, 180, 252, 0.2), transparent 26rem),
    var(--desk-bg);
  background-size: 2.75rem 2.75rem, 2.75rem 2.75rem, auto, auto, auto;
  overflow: auto;
}

.page-bg::before {
  display: none;
}

.command-shell {
  width: min(88rem, 100%);
  min-height: calc(100vh - 2rem);
  height: auto;
  display: grid;
  grid-template-columns: minmax(15rem, 18rem) minmax(0, 50rem) minmax(15rem, 19rem);
  align-items: stretch;
  gap: 0.75rem;
}

.human-rail,
.chat-workspace,
.source-desk {
  min-width: 0;
  border: 1px solid var(--desk-line);
  border-radius: 0.5rem;
  background: var(--desk-panel);
  box-shadow: 0 1.5rem 4.5rem rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(1.5rem);
}

.human-rail {
  position: sticky;
  top: 1rem;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: calc(100vh - 2rem);
  padding: 0.75rem;
  overflow: auto;
}

.brand-bar {
  padding: 0.5rem;
  border-radius: 0.5rem;
  background: var(--desk-panel-soft);
}

.school-badge {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
}

.brand-kicker,
.workspace-kicker {
  color: var(--desk-accent);
  font-size: 0.6875rem;
}

.brand-copy h1 {
  font-size: 1rem;
}

.quick-command {
  display: grid;
  gap: 0.375rem;
}

.quick-command__label {
  padding: 0.25rem 0.375rem;
  color: var(--desk-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.quick-command button {
  min-height: 2.75rem;
  padding: 0 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  background: transparent;
  color: rgba(244, 247, 251, 0.82);
  font-size: 0.9375rem;
  font-weight: 750;
  text-align: left;
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.quick-command button:hover {
  transform: translateX(0.125rem);
  border-color: rgba(125, 211, 252, 0.22);
  background: rgba(125, 211, 252, 0.1);
}

.human-status-card {
  min-height: auto;
  gap: 0.5rem;
  padding: 0.625rem;
  border-radius: 0.5rem;
  background: var(--desk-panel-soft);
  border-color: var(--desk-line);
}

.stage-wrap {
  height: 11rem;
  overflow: hidden;
  border-radius: 0.5rem;
  background: #070914;
}

.rail-action {
  min-height: 2.75rem;
  border-radius: 0.5rem;
}

.rail-context span {
  border-radius: 0.375rem;
}

.chat-workspace {
  display: grid;
  grid-template-rows: auto minmax(28rem, 1fr) auto;
  gap: 0.875rem;
  padding: 1rem;
}

.workspace-header {
  display: block;
  max-width: 48rem;
}

.workspace-header h2 {
  margin-top: 0.375rem;
  font-size: clamp(1.75rem, 3vw, 2.75rem);
  line-height: 1.05;
  letter-spacing: 0;
}

.workspace-header p {
  max-width: 44rem;
  margin: 0.625rem 0 0;
  color: var(--desk-muted);
  font-size: 1rem;
  line-height: 1.6;
}

.chat-body {
  border-radius: 0.5rem;
  padding: 0.625rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 13rem),
    rgba(5, 7, 13, 0.72);
  border-color: var(--desk-line);
}

.input-area {
  padding: 0;
}

.source-desk {
  position: sticky;
  top: 1rem;
  align-self: start;
  display: grid;
  gap: 0.75rem;
  max-height: calc(100vh - 2rem);
  padding: 0.75rem;
  overflow: auto;
}

.source-panel {
  padding: 0.875rem;
  border: 1px solid var(--desk-line);
  border-radius: 0.5rem;
  background: var(--desk-panel-soft);
}

.source-panel span {
  display: block;
  color: var(--desk-muted);
  font-size: 0.75rem;
  font-weight: 800;
}

.source-panel strong {
  display: block;
  margin-top: 0.375rem;
  color: var(--desk-text);
  font-size: 1.375rem;
  line-height: 1.1;
}

.source-panel p,
.source-panel li {
  color: var(--desk-muted);
  font-size: 0.875rem;
  line-height: 1.55;
}

.source-panel p {
  margin: 0.5rem 0 0;
}

.source-panel ul {
  margin: 0.625rem 0 0;
  padding-left: 1.125rem;
}

.source-panel--active {
  background:
    linear-gradient(135deg, rgba(125, 211, 252, 0.12), rgba(165, 180, 252, 0.08)),
    var(--desk-panel-soft);
}

.source-panel--active strong {
  color: var(--desk-accent);
}

@media (max-width: 1024px) {
  .command-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .human-rail,
  .source-desk {
    position: static;
    max-height: none;
  }

  .human-rail {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .stage-wrap {
    height: 12rem;
  }

  .source-desk {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .page-bg {
    padding: 0.625rem;
  }

  .command-shell {
    min-height: calc(100vh - 1.25rem);
  }

  .chat-workspace {
    min-height: 38rem;
    padding: 0.75rem;
  }

  .source-desk {
    grid-template-columns: 1fr;
  }
}
</style>
