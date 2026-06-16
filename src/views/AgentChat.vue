<template>
  <div class="chat-page">
    <!-- Left Rail: Prism Core + Quick Actions -->
    <aside class="chat-rail" aria-label="AI 助手">
      <div class="chat-rail__persona">
        <DigitalHumanPlayer
          :cue-key="store.videoCueKey"
          :play-signal="store.videoPlayTick"
          :narration-text="store.narrationText"
          :narration-signal="store.narrationTick"
          :stop-signal="stopPlaySignal"
          :source-count="latestSourceCount"
          @request-idle="onGreetingEnded"
          @narration-ended="onNarrationEnded"
        />
        <div class="persona-status">
          <span class="persona-dot" :class="{ 'is-active': store.loading }" />
          <span>{{ store.loading ? '正在响应' : 'Prism Core 待机' }}</span>
        </div>
      </div>

      <div class="chat-rail__prompts">
        <button @click="store.sendMessage('这个项目的 RAG 问答流程是怎么工作的？')">RAG 问答流程</button>
        <button @click="store.sendMessage('请用面试官能听懂的话介绍这个项目亮点')">项目亮点介绍</button>
        <button @click="store.sendMessage('如何展示来源依据和回答可信度？')">来源可信度</button>
        <button @click="store.sendMessage('Prism Core 模块后续还能怎么升级？')">Core 升级方案</button>
      </div>

      <div class="chat-rail__actions">
        <button class="rail-btn" @click="onStopPlayback">停止讲解</button>
        <button class="rail-btn rail-btn--primary" @click="settingsDialogVisible = true">用户设置</button>
      </div>

      <div class="chat-rail__context">
        <span>{{ roleLabel }}</span>
        <span>{{ selectedGrade || '未填年级' }}</span>
        <span>{{ selectedMajor || '未填专业' }}</span>
      </div>
    </aside>

    <!-- Center: Messages Area -->
    <main class="chat-main">
      <header class="chat-header">
        <h1>AI 知识助手</h1>
      </header>

      <div class="chat-messages">
        <ChatWindow
          :messages="visibleMessages"
          :loading="store.loading"
          @open-community-post="emit('openCommunityPost', $event)"
        />
      </div>

      <footer class="chat-footer">
        <InputBox :loading="store.loading" @send="store.sendMessage" />
      </footer>
    </main>

    <!-- User Settings Dialog -->
    <el-dialog
      v-model="settingsDialogVisible"
      title="用户设置"
      width="min(440px, calc(100vw - 32px))"
      class="settings-dialog"
      destroy-on-close
    >
      <div class="settings-form">
        <div class="setting-row">
          <label class="setting-row__label">身份</label>
          <el-select v-model="selectedRole" size="large" class="setting-select" @change="onRoleChange">
            <el-option v-for="opt in roleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </div>
        <div class="setting-row">
          <label class="setting-row__label">年级</label>
          <el-select v-model="selectedGrade" size="large" class="setting-select" clearable placeholder="选择年级" @change="onGradeChange">
            <el-option v-for="opt in gradeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </div>
        <div class="setting-row">
          <label class="setting-row__label">专业</label>
          <el-input v-model="draftMajor" size="large" class="setting-input" clearable placeholder="输入专业" @blur="commitMajorDraft" @keyup.enter="commitMajorDraft" @clear="clearMajor" />
        </div>
        <div class="setting-row setting-row--switch">
          <span>演示模式</span>
          <el-switch v-model="demoModeEnabled" inline-prompt active-text="开" inactive-text="关" @change="onDemoModeChange" />
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button text class="reset-btn" @click="resetChat">重置会话</el-button>
          <el-button @click="settingsDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ChatWindow from '@/components/ChatWindow.vue'
import InputBox from '@/components/InputBox.vue'
import DigitalHumanPlayer from '@/components/DigitalHumanPlayer.vue'
import { useAgentStore } from '@/store/agent'

const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
}>()

type UserRole = 'student' | 'teacher' | 'guest'
type GradeValue = '' | '大一' | '大二' | '大三' | '大四' | '大五' | '研一' | '研二' | '研三'

const store = useAgentStore()
const settingsDialogVisible = ref(false)
const stopPlaySignal = ref(0)
const demoModeEnabled = ref(true)
const visibleMessages = computed(() => store.messages.filter((msg) => msg.role !== 'system'))
const latestSourceCount = computed(() => {
  const latestAssistant = [...store.messages].reverse().find((msg) => msg.role === 'assistant')
  return Array.isArray(latestAssistant?.sources) ? latestAssistant.sources.length : 0
})
const selectedRole = ref<UserRole>('student')
const selectedGrade = ref<GradeValue>('大三')
const selectedMajor = ref('前端工程')
const draftMajor = ref(selectedMajor.value)

const roleOptions = [
  { label: '学生', value: 'student' },
  { label: '教师', value: 'teacher' },
  { label: '访客', value: 'guest' },
]
const gradeOptions = [
  { label: '大一', value: '大一' }, { label: '大二', value: '大二' },
  { label: '大三', value: '大三' }, { label: '大四', value: '大四' },
  { label: '大五', value: '大五' }, { label: '研一', value: '研一' },
  { label: '研二', value: '研二' }, { label: '研三', value: '研三' },
]
const roleLabelMap: Record<UserRole, string> = { student: '学生', teacher: '教师', guest: '访客' }
const roleLabel = computed(() => roleLabelMap[selectedRole.value] || '用户')
const summaryTitle = computed(
  () => `身份：${roleLabel.value} / 年级：${selectedGrade.value || '未填写'} / 专业：${selectedMajor.value || '未填写'}`,
)

const syncFormFromStore = () => {
  selectedRole.value = (store.userProfile.role as UserRole) || 'student'
  selectedGrade.value = (store.userProfile.grade as GradeValue) || ''
  selectedMajor.value = store.userProfile.major || ''
  draftMajor.value = selectedMajor.value
  demoModeEnabled.value = store.demoMode
}
const onRoleChange = (role: UserRole) => { store.setUserProfile({ role }); store.refreshSystemPrompt() }
const onGradeChange = (grade: GradeValue | undefined) => {
  selectedGrade.value = grade || ''
  store.setUserProfile({ grade: selectedGrade.value }); store.refreshSystemPrompt()
}
const commitMajorDraft = () => {
  const next = draftMajor.value.trim()
  if (next === selectedMajor.value) return
  selectedMajor.value = next
  store.setUserProfile({ major: selectedMajor.value }); store.refreshSystemPrompt()
}
const clearMajor = () => { draftMajor.value = ''; commitMajorDraft() }
const onDemoModeChange = (value: boolean) => { store.setDemoMode(value) }
const resetChat = () => { store.resetSession() }
const onStopPlayback = () => { store.stopNarrationPlayback(); stopPlaySignal.value += 1 }
const onGreetingEnded = () => { store.onGreetingEnded() }
const onNarrationEnded = () => { store.onNarrationEnded() }

onMounted(() => {
  store.hydrateSession()
  syncFormFromStore()
  if (!store.userProfile.role) store.setUserProfile({ role: selectedRole.value })
  if (!store.userProfile.grade && selectedGrade.value) store.setUserProfile({ grade: selectedGrade.value })
  if (!store.userProfile.major && selectedMajor.value) store.setUserProfile({ major: selectedMajor.value })
  syncFormFromStore()
  store.initAgent()
})
</script>

<style scoped>
/* ==========================================================================
   AgentChat — Apple Messages Style
   Pure black, large bubbles, pill input, minimal chrome
   ========================================================================== */

.chat-page {
  --rail-w: 17rem;
  display: grid;
  grid-template-columns: var(--rail-w) 1fr;
  height: calc(100vh - 4.5rem);
  background: var(--dark-bg);
  color: var(--dark-ink);
  overflow: hidden;
}

/* ---- Left Rail ---- */
.chat-rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6) var(--space-4);
  border-right: 0.5px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.chat-rail__persona {
  display: grid;
  gap: var(--space-3);
  min-height: 22rem;
  flex-shrink: 0;
}

.persona-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--dark-muted);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  padding: 0 0.25rem;
}

.persona-dot {
  width: 0.4375rem;
  height: 0.4375rem;
  border-radius: 50%;
  background: var(--apple-green);
  box-shadow: 0 0 0.5rem rgba(52, 199, 89, 0.6);
}
.persona-dot.is-active {
  background: var(--apple-cyan);
  animation: dot-pulse 1.4s ease-out infinite;
}

.chat-rail__prompts {
  display: grid;
  gap: 0.375rem;
}

.chat-rail__prompts button {
  all: unset;
  display: block;
  padding: 0.625rem 0.75rem;
  border-radius: var(--radius-md);
  color: rgba(245,245,247,0.72);
  font-size: var(--font-size-subhead);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-normal);
  cursor: pointer;
  transition: all var(--transition-micro);
}
.chat-rail__prompts button:hover {
  background: rgba(255,255,255,0.06);
  color: #fff;
}

.chat-rail__actions {
  display: grid;
  gap: 0.5rem;
  margin-top: auto;
}

.rail-btn {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.5rem;
  border-radius: var(--radius-pill);
  background: rgba(255,255,255,0.06);
  color: var(--dark-ink);
  font-size: var(--font-size-subhead);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-micro);
}
.rail-btn:hover { background: rgba(255,255,255,0.12); }
.rail-btn--primary {
  background: var(--apple-blue);
  color: #fff;
}
.rail-btn--primary:hover { background: var(--apple-blue-hover); }

.chat-rail__context {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.chat-rail__context span {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-pill);
  background: rgba(255,255,255,0.06);
  color: var(--dark-muted);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

/* ---- Center Chat ---- */
.chat-main {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-width: 0;
  overflow: hidden;
}

.chat-header {
  padding: var(--space-5) var(--space-8) var(--space-3);
}
.chat-header h1 {
  margin: 0;
  font-size: var(--font-size-large-title);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-tight);
  color: var(--dark-ink);
}

.chat-messages {
  min-height: 0;
  padding: 0 var(--space-6);
  overflow: hidden;
}

.chat-footer {
  padding: var(--space-4) var(--space-6) var(--space-6);
}

/* ---- Deep Overrides: Chat Bubbles (Apple iMessage style) ---- */
:deep(.chat-window) {
  color: var(--dark-ink);
  padding: var(--space-2) 0;
}
:deep(.empty-state) {
  color: var(--dark-muted);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-regular);
  background: transparent;
  border: none;
  text-align: center;
  padding-top: 6rem;
}
:deep(.message-row) {
  margin: 0.25rem 0;
}
:deep(.bubble) {
  border-radius: var(--radius-lg);
  padding: 0.625rem 1rem;
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-relaxed);
  max-width: min(100%, 42rem);
  border: none;
}
:deep(.message-row.is-user .bubble) {
  background: var(--apple-blue);
  color: #fff;
}
:deep(.message-row.is-assistant .bubble) {
  background: #1c1c1e;
  color: var(--dark-ink);
}
:deep(.avatar) {
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  font-size: 0.625rem;
  background: #2c2c2e;
  border: none;
  box-shadow: none;
}
:deep(.message-row.is-user .user-avatar) {
  background: var(--apple-blue);
}
:deep(.sources),
:deep(.source-panel) {
  background: #1c1c1e;
  border: 0.5px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-md);
}

/* ---- Deep Overrides: Input Box (Apple iMessage style) ---- */
:deep(.input-box) {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  align-items: center;
}

:deep(.input-box .el-input__wrapper) {
  border-radius: var(--radius-pill);
  min-height: 2.75rem;
  padding: 0 1.125rem;
  background: #1c1c1e;
  border: 0.5px solid rgba(255,255,255,0.08);
  box-shadow: none !important;
  transition: all var(--transition-micro);
}
:deep(.input-box .el-input__wrapper.is-focus) {
  background: #2c2c2e;
  border-color: rgba(255,255,255,0.14);
  box-shadow: 0 0 0 3px rgba(0,113,227,0.15) !important;
}
:deep(.input-box .el-input__inner) {
  color: #f5f5f7;
  font-size: var(--font-size-body);
}
:deep(.input-box .el-input__inner::placeholder) {
  color: rgba(245,245,247,0.4);
}
:deep(.send-btn) {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: var(--apple-blue);
  border: none;
  color: #fff;
  font-size: 0;
}
:deep(.send-btn:hover) {
  background: var(--apple-blue-hover);
  transform: scale(1.05);
}

/* ---- Dialog ---- */
.settings-form {
  display: grid;
  gap: var(--space-4);
}
.setting-row {
  display: grid;
  gap: 0.375rem;
}
.setting-row__label {
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  color: rgba(245,245,247,0.6);
}
.setting-select, .setting-input { width: 100%; }
.setting-row--switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-top: 0.5px solid rgba(255,255,255,0.08);
}
.dialog-footer { display: flex; justify-content: space-between; }
.reset-btn { color: var(--apple-red); }

:deep(.settings-dialog .el-dialog) {
  border-radius: var(--radius-xl);
  background: #1c1c1e;
  border: 0.5px solid rgba(255,255,255,0.08);
  box-shadow: var(--shadow-modal);
  backdrop-filter: var(--glass-blur-lg);
}
:deep(.settings-dialog .el-dialog__title) {
  color: var(--dark-ink);
  font-size: var(--font-size-title2);
  font-weight: var(--font-weight-semibold);
}
:deep(.settings-dialog .el-dialog__body) { padding: 1rem 1.5rem; }

:deep(.el-select .el-input__wrapper),
:deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.06);
  border-radius: var(--radius-md);
  border: 0.5px solid rgba(255,255,255,0.08);
  box-shadow: none !important;
}
:deep(.el-select .el-input__inner),
:deep(.el-input__inner) {
  color: var(--dark-ink);
}
:deep(.el-select__placeholder) {
  color: rgba(245,245,247,0.35);
}

/* ---- Animations ---- */
@keyframes dot-pulse {
  0% { box-shadow: 0 0 0 0 rgba(90,200,250,0.5); }
  100% { box-shadow: 0 0 0 0.75rem rgba(90,200,250,0); }
}

/* ---- Responsive ---- */
@media (max-width: 900px) {
  .chat-page { grid-template-columns: 1fr; }
  .chat-rail { display: none; }
}
</style>
