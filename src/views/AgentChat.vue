<template>
  <div class="page-bg">
    <main class="app-shell">
      <section class="left-stage">
        <header class="brand-bar">
          <div class="brand-left">
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
            <div class="brand-title">广东第二师范学院</div>
          </div>
          <div class="brand-icon" aria-hidden="true">🤖</div>
        </header>

        <div class="stage-wrap">
          <DigitalHumanPlayer :cue-key="store.videoCueKey" :play-signal="store.videoPlayTick" />
        </div>
      </section>

      <section class="right-chat">
        <div class="chat-card">
          <header class="chat-header">
            <div class="header-main">
              <div class="header-title-wrap">
                <h2>校园智能问答</h2>
                <span class="mode-tag">数字人对话</span>
              </div>

              <div class="header-actions">
                <div class="profile-summary" :title="summaryTitle">
                  <span>{{ roleLabel }}</span>
                  <span>{{ selectedGrade || '未填年级' }}</span>
                  <span>{{ selectedMajor || '未填专业' }}</span>
                </div>
                <el-button class="settings-btn" size="small" @click="settingsExpanded = !settingsExpanded">
                  {{ settingsExpanded ? '收起设置' : '用户设置' }}
                </el-button>
              </div>
            </div>

            <el-collapse-transition>
              <div v-show="settingsExpanded" class="settings-panel">
                <div class="profile-controls">
                  <el-select v-model="selectedRole" size="small" class="ctrl-select" @change="onRoleChange">
                    <el-option
                      v-for="option in roleOptions"
                      :key="option.value"
                      :label="option.label"
                      :value="option.value"
                    />
                  </el-select>

                  <el-select
                    v-model="selectedGrade"
                    size="small"
                    class="ctrl-select"
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

                  <el-button text class="reset-btn" @click="resetChat">重置会话</el-button>
                </div>
              </div>
            </el-collapse-transition>
          </header>

          <div class="chat-body">
            <ChatWindow :messages="visibleMessages" :loading="store.loading" />
          </div>

          <footer class="input-area">
            <InputBox :loading="store.loading" @send="store.sendMessage" />
          </footer>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ChatWindow from '@/components/ChatWindow.vue'
import InputBox from '@/components/InputBox.vue'
import DigitalHumanPlayer from '@/components/DigitalHumanPlayer.vue'
import { useAgentStore } from '@/store/agent'

type UserRole = 'student' | 'teacher' | 'guest'
type GradeValue = '' | '大一' | '大二' | '大三' | '大四' | '大五' | '研一' | '研二' | '研三'

const store = useAgentStore()
const logoLoadFailed = ref(false)
const schoolLogoSrc = '/branding/gdei-logo.png'
const settingsExpanded = ref(false)

const visibleMessages = computed(() => store.messages.filter((msg) => msg.role !== 'system'))

const selectedRole = ref<UserRole>('student')
const selectedGrade = ref<GradeValue>('大三')
const selectedMajor = ref('计算机科学与技术')
const draftMajor = ref(selectedMajor.value)

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

const roleLabelMap: Record<UserRole, string> = {
  student: '学生',
  teacher: '教师',
  guest: '访客',
}

const roleLabel = computed(() => roleLabelMap[selectedRole.value] || '用户')
const summaryTitle = computed(
  () => `身份：${roleLabel.value} / 年级：${selectedGrade.value || '未填写'} / 专业：${selectedMajor.value || '未填写'}`,
)

const syncFormFromStore = () => {
  selectedRole.value = (store.userProfile.role as UserRole) || 'student'
  selectedGrade.value = (store.userProfile.grade as GradeValue) || ''
  selectedMajor.value = store.userProfile.major || ''
  draftMajor.value = selectedMajor.value
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

const commitMajorDraft = () => {
  const next = draftMajor.value.trim()
  if (next === selectedMajor.value) return

  selectedMajor.value = next
  store.setUserProfile({ major: selectedMajor.value })
  store.refreshSystemPrompt()
}

const clearMajor = () => {
  draftMajor.value = ''
  commitMajorDraft()
}

const resetChat = () => {
  store.resetSession()
}

onMounted(() => {
  store.hydrateSession()
  syncFormFromStore()

  if (!store.userProfile.role) {
    store.setUserProfile({ role: selectedRole.value })
  }

  if (!store.userProfile.grade && selectedGrade.value) {
    store.setUserProfile({ grade: selectedGrade.value })
  }

  if (!store.userProfile.major && selectedMajor.value) {
    store.setUserProfile({ major: selectedMajor.value })
  }

  syncFormFromStore()
  store.initAgent()
})
</script>

<style scoped>
.page-bg {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 14px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 15% 10%, rgba(255, 255, 255, 0.78), transparent 28%),
    radial-gradient(circle at 82% 12%, rgba(255, 255, 255, 0.5), transparent 24%),
    linear-gradient(180deg, #eef6ec 0%, #d6f0ce 38%, #95e27d 70%, #55d944 100%);
}

.app-shell {
  width: min(1200px, 100%);
  height: calc(100vh - 28px);
  display: grid;
  grid-template-columns: minmax(360px, 44%) minmax(0, 56%);
  gap: 14px;
}

.left-stage,
.right-chat {
  min-width: 0;
}

.left-stage {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 10px;
  padding: 10px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(8px);
}

.brand-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 4px;
}

.brand-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.school-badge {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: radial-gradient(circle at 30% 30%, #fff 0%, #effff0 44%, #d5f8d6 100%);
  border: 2px solid #69cb73;
  box-shadow: 0 4px 14px rgba(37, 113, 53, 0.16);
  overflow: hidden;
}

.school-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.school-badge-fallback {
  color: #15934b;
  font-size: 10px;
  font-weight: 800;
}

.brand-title {
  font-size: clamp(18px, 1.8vw, 24px);
  font-weight: 900;
  color: #0f0f0f;
  letter-spacing: 0.5px;
  white-space: nowrap;
  text-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
}

.brand-icon {
  font-size: 30px;
  line-height: 1;
  filter: drop-shadow(0 3px 8px rgba(0, 0, 0, 0.1));
}

.stage-wrap {
  height: 100%;
  min-height: 0;
}

.right-chat {
  display: flex;
}

.chat-card {
  width: 100%;
  display: grid;
  grid-template-rows: auto auto;
  gap: 10px;
  padding: 12px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.28) 100%);
  border: 1px solid rgba(255, 255, 255, 0.35);
  backdrop-filter: blur(8px);
  align-content: start;
}

.chat-header {
  display: grid;
  gap: 10px;
  padding: 2px 2px 0;
}

.header-main {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}

.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.chat-header h2 {
  margin: 0;
  font-size: 18px;
  color: #16351b;
  font-weight: 800;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.profile-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 360px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.55);
  color: #255c31;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
}

.profile-summary span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-summary span + span::before {
  content: '/';
  margin-right: 6px;
  color: rgba(37, 92, 49, 0.55);
}

.settings-btn {
  border-radius: 999px;
  border-color: rgba(46, 113, 53, 0.18);
  color: #1f6a39;
  background: rgba(255, 255, 255, 0.7);
}

.settings-panel {
  border-radius: 14px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.profile-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ctrl-select {
  width: 110px;
}

:deep(.ctrl-select .el-select__wrapper) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 0 0 1px rgba(46, 113, 53, 0.14) !important;
}

.major-input {
  min-width: 220px;
  flex: 1 1 240px;
}

:deep(.major-input .el-input__wrapper) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 0 0 1px rgba(46, 113, 53, 0.14) !important;
}

.reset-btn {
  color: #1f6a39;
  font-weight: 600;
}

.mode-tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #255c31;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.55);
  white-space: nowrap;
}

.chat-body {
  height: 420px;
  border-radius: 18px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.input-area {
  padding-top: 2px;
}

@media (max-width: 980px) {
  .app-shell {
    grid-template-columns: 1fr;
    height: auto;
  }

  .left-stage {
    min-height: 360px;
  }

  .stage-wrap {
    min-height: 300px;
  }

  .chat-body {
    height: 320px;
  }

  .header-main {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .profile-summary {
    max-width: calc(100% - 110px);
  }
}

@media (max-width: 640px) {
  .header-title-wrap {
    flex-wrap: wrap;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .profile-summary {
    max-width: 100%;
  }

  .profile-controls {
    width: 100%;
    gap: 6px;
  }

  .ctrl-select {
    width: calc(50% - 3px);
  }

  .major-input {
    min-width: 100%;
    flex-basis: 100%;
  }

  .chat-body {
    height: 260px;
  }
}
</style>
