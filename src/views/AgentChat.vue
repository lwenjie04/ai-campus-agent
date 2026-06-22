<template>
  <div class="legacy-page">
    <main class="legacy-shell">
      <section class="human-stage">
        <header class="stage-brand">
          <div class="stage-brand__mark">P</div>
          <div>
            <strong>Prism Digital Human</strong>
            <span>AI 知识助手</span>
          </div>
          <span class="stage-brand__state">在线</span>
        </header>

        <div class="stage-player">
          <DigitalHumanPlayer
            :cue-key="store.videoCueKey"
            :play-signal="store.videoPlayTick"
            :narration-text="store.narrationText"
            :narration-signal="store.narrationTick"
            :stop-signal="stopPlaySignal"
            :source-count="latestSourceCount"
            @request-idle="store.onGreetingEnded()"
            @narration-ended="store.onNarrationEnded()"
          />
        </div>
      </section>

      <section class="chat-panel">
        <header class="chat-panel__header">
          <div class="chat-panel__heading">
            <div>
              <p>PRISM KNOWLEDGE ASSISTANT</p>
              <h1>校园智能问答</h1>
            </div>
            <span class="mode-label">数字人对话</span>
          </div>

          <div class="chat-panel__tools">
            <div class="profile-summary" :title="summaryTitle">
              <span>{{ roleLabel }}</span>
              <span>{{ selectedGrade || '未填年级' }}</span>
              <span>{{ selectedMajor || '未填专业' }}</span>
            </div>
            <button class="tool-button" type="button" @click="settingsExpanded = !settingsExpanded">
              {{ settingsExpanded ? '收起设置' : '用户设置' }}
            </button>
          </div>

          <el-collapse-transition>
            <div v-show="settingsExpanded" class="settings-panel">
              <el-select v-model="selectedRole" size="small" @change="onRoleChange">
                <el-option v-for="option in roleOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-select v-model="selectedGrade" size="small" clearable placeholder="选择年级" @change="onGradeChange">
                <el-option v-for="option in gradeOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <el-input
                v-model="draftMajor"
                size="small"
                clearable
                placeholder="输入专业"
                @blur="commitMajor"
                @keyup.enter="commitMajor"
                @clear="clearMajor"
              />
              <label class="demo-switch">
                <span>演示模式</span>
                <el-switch v-model="demoMode" inline-prompt active-text="开" inactive-text="关" @change="store.setDemoMode($event as boolean)" />
              </label>
              <button class="text-button" type="button" @click="store.resetSession()">重置会话</button>
            </div>
          </el-collapse-transition>
        </header>

        <div class="chat-panel__messages">
          <ChatWindow
            :messages="visibleMessages"
            :loading="store.loading"
            @open-community-post="emit('openCommunityPost', $event)"
          />
        </div>

        <div class="chat-panel__actions">
          <button class="stop-button" type="button" @click="stopPlayback">停止播放</button>
        </div>

        <footer class="chat-panel__input">
          <InputBox :loading="store.loading" @send="store.sendMessage" />
        </footer>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ChatWindow from '@/components/ChatWindow.vue'
import DigitalHumanPlayer from '@/components/DigitalHumanPlayer.vue'
import InputBox from '@/components/InputBox.vue'
import { useAgentStore } from '@/store/agent'

type UserRole = 'student' | 'teacher' | 'guest'
type GradeValue = '' | '大一' | '大二' | '大三' | '大四' | '大五' | '研一' | '研二' | '研三'

const emit = defineEmits<{
  (event: 'openCommunityPost', postId: string): void
}>()

const store = useAgentStore()
const settingsExpanded = ref(false)
const stopPlaySignal = ref(0)
const demoMode = ref(true)
const selectedRole = ref<UserRole>('student')
const selectedGrade = ref<GradeValue>('')
const selectedMajor = ref('')
const draftMajor = ref('')

const roleOptions: Array<{ label: string; value: UserRole }> = [
  { label: '学生', value: 'student' },
  { label: '教师', value: 'teacher' },
  { label: '访客', value: 'guest' },
]

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

const roleLabels: Record<UserRole, string> = {
  student: '学生',
  teacher: '教师',
  guest: '访客',
}

const visibleMessages = computed(() => store.messages.filter((message) => message.role !== 'system'))
const roleLabel = computed(() => roleLabels[selectedRole.value])
const summaryTitle = computed(
  () => `身份：${roleLabel.value} / 年级：${selectedGrade.value || '未填写'} / 专业：${selectedMajor.value || '未填写'}`,
)
const latestSourceCount = computed(() => {
  const latest = [...store.messages].reverse().find((message) => message.role === 'assistant')
  return Array.isArray(latest?.sources) ? latest.sources.length : 0
})

const syncProfile = () => {
  selectedRole.value = (store.userProfile.role as UserRole) || 'student'
  selectedGrade.value = (store.userProfile.grade as GradeValue) || ''
  selectedMajor.value = store.userProfile.major || ''
  draftMajor.value = selectedMajor.value
  demoMode.value = store.demoMode
}

const onRoleChange = (role: UserRole) => {
  store.setUserProfile({ role })
  store.refreshSystemPrompt()
}

const onGradeChange = (grade: GradeValue | undefined) => {
  selectedGrade.value = grade || ''
  store.setUserProfile({ grade: selectedGrade.value })
  store.refreshSystemPrompt()
}

const commitMajor = () => {
  const nextMajor = draftMajor.value.trim()
  if (nextMajor === selectedMajor.value) return
  selectedMajor.value = nextMajor
  store.setUserProfile({ major: nextMajor })
  store.refreshSystemPrompt()
}

const clearMajor = () => {
  draftMajor.value = ''
  commitMajor()
}

const stopPlayback = () => {
  store.stopNarrationPlayback()
  stopPlaySignal.value += 1
}

onMounted(() => {
  store.hydrateSession()
  syncProfile()
  store.initAgent()
})
</script>

<style scoped>
.legacy-page {
  height: calc(100dvh - 5.75rem);
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
  padding: 1rem;
  color: #17351d;
  background:
    radial-gradient(circle at 14% 8%, rgba(255, 255, 255, 0.8), transparent 27%),
    radial-gradient(circle at 84% 10%, rgba(255, 255, 255, 0.55), transparent 24%),
    linear-gradient(180deg, #eef7eb 0%, #d6f0ce 38%, #99e585 72%, #58d947 100%);
}

.legacy-shell {
  display: grid;
  width: min(100%, 75rem);
  height: 100%;
  margin: 0 auto;
  gap: 0.875rem;
  align-items: start;
}

.human-stage,
.chat-panel {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 1.25rem;
  box-shadow: 0 1.25rem 3.5rem rgba(31, 106, 57, 0.12);
  backdrop-filter: blur(0.75rem);
}

.human-stage {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0.625rem;
  padding: 0.75rem;
  background:
    radial-gradient(circle at 50% 6%, rgba(246, 255, 245, 0.7), transparent 42%),
    linear-gradient(180deg, rgba(218, 239, 217, 0.95), rgba(169, 220, 171, 0.94));
}

.stage-brand {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
  padding: 0.15rem 0.25rem;
}

.stage-brand__mark {
  display: grid;
  width: 2.75rem;
  aspect-ratio: 1;
  place-items: center;
  color: #f7fff7;
  font-weight: 800;
  border: 2px solid rgba(255, 255, 255, 0.75);
  border-radius: 50%;
  background: #25984f;
  box-shadow: 0 0.35rem 1rem rgba(37, 113, 53, 0.18);
}

.stage-brand strong,
.stage-brand span {
  display: block;
  letter-spacing: 0;
}

.stage-brand strong { color: #102e18; font-size: 1rem; }
.stage-brand div span { margin-top: 0.1rem; color: #46744f; font-size: 0.78rem; }
.stage-brand__state { color: #178c45; font-size: 0.78rem; font-weight: 700; }
.stage-player {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.chat-panel {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(16rem, 1fr) auto auto;
  gap: 0.65rem;
  padding: 0.85rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(255, 255, 255, 0.3));
}

.chat-panel__header { display: grid; gap: 0.65rem; }
.chat-panel__heading,
.chat-panel__tools,
.chat-panel__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.chat-panel__heading p {
  margin: 0 0 0.15rem;
  color: #428356;
  font-size: 0.68rem;
  font-weight: 800;
}

.chat-panel__heading h1 {
  margin: 0;
  color: #16351b;
  font-size: 1.2rem;
  letter-spacing: 0;
}

.mode-label,
.profile-summary,
.tool-button,
.stop-button,
.demo-switch {
  border: 1px solid rgba(46, 113, 53, 0.15);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
}

.mode-label { padding: 0.3rem 0.65rem; color: #255c31; font-size: 0.75rem; white-space: nowrap; }
.profile-summary { display: flex; min-width: 0; gap: 0.45rem; padding: 0.4rem 0.7rem; color: #255c31; font-size: 0.75rem; overflow: hidden; }
.profile-summary span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tool-button,
.stop-button,
.text-button {
  min-height: 2.75rem;
  padding: 0 0.9rem;
  color: #1f6a39;
  font: inherit;
  font-weight: 650;
  cursor: pointer;
}

.text-button { border: 0; background: transparent; }
.tool-button:hover,
.stop-button:hover { background: #ffffff; }

.settings-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.3);
}

.demo-switch { display: flex; min-height: 2rem; align-items: center; justify-content: space-between; gap: 0.5rem; padding: 0 0.6rem; color: #255c31; font-size: 0.75rem; }
.chat-panel__messages { min-height: 0; overflow: hidden; border-radius: 1rem; background: rgba(255, 255, 255, 0.16); }
.chat-panel__actions { justify-content: flex-start; }
.stop-button { min-height: 2.25rem; font-size: 0.8rem; }

:deep(.chat-window) { height: 100%; padding: 0.65rem; color: #17351d; }
:deep(.message-row.is-user .bubble) { color: #fff; background: #24964e; }
:deep(.message-row.is-assistant .bubble) { color: #17351d; background: rgba(255, 255, 255, 0.84); }
:deep(.bubble) { border: 1px solid rgba(46, 113, 53, 0.08); border-radius: 0.9rem; }
:deep(.avatar) { background: #d7f1d7; color: #1f6a39; }
:deep(.input-box) { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem; align-items: center; }
:deep(.input-box .el-input__wrapper) { min-height: 2.75rem; border-radius: 999px; background: rgba(255, 255, 255, 0.86); box-shadow: inset 0 0 0 1px rgba(46, 113, 53, 0.14) !important; }
:deep(.send-btn) { min-width: 2.75rem; min-height: 2.75rem; border: 0; border-radius: 50%; color: #fff; background: #24964e; }

@media (min-width: 768px) {
  .settings-panel { grid-template-columns: repeat(5, minmax(0, 1fr)); }
}

@media (min-width: 1024px) {
  .legacy-shell { grid-template-columns: minmax(0, 44fr) minmax(0, 56fr); }
  .human-stage,
  .chat-panel { height: 100%; }
}

@media (max-width: 767px) {
  .legacy-page {
    height: auto;
    min-height: calc(100dvh - 5.75rem);
    padding: 0.65rem;
    overflow: visible;
  }
  .legacy-shell { height: auto; }
  .stage-player { height: min(68svh, 40rem); }
  .chat-panel__heading,
  .chat-panel__tools { align-items: flex-start; flex-direction: column; }
  .profile-summary { width: 100%; box-sizing: border-box; }
  .tool-button { width: 100%; }
}
</style>
