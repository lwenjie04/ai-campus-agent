<template>
  <div class="panel">
    <div class="panel__stage">
      <DigitalHumanPlayer
        :cue-key="agentStore.videoCueKey"
        :play-signal="agentStore.videoPlayTick"
        :narration-text="agentStore.narrationText"
        :narration-signal="agentStore.narrationTick"
        :stop-signal="stopPlaySignal"
        :source-count="latestSourceCount"
        @request-idle="agentStore.onGreetingEnded()"
        @narration-ended="agentStore.onNarrationEnded()"
      />
    </div>

    <div class="panel__prompts">
      <button @click="agentStore.sendMessage('转专业需要什么条件')">转专业条件</button>
      <button @click="agentStore.sendMessage('奖学金评定一般看哪些条件')">奖学金评定</button>
      <button @click="agentStore.sendMessage('考试违规会怎么处理')">考试违规处理</button>
      <button @click="agentStore.sendMessage('宿舍调换需要走什么流程')">宿舍调换流程</button>
    </div>

    <div class="panel__actions">
      <button class="panel-btn" @click="stopPlaySignal++">停止讲解</button>
      <button class="panel-btn panel-btn--primary" @click="settingsVisible = true">用户设置</button>
    </div>

    <div class="panel__context">
      <span>{{ roleLabel }}</span>
      <span>{{ selectedGrade || '未填年级' }}</span>
      <span>{{ selectedMajor || '未填专业' }}</span>
    </div>

    <!-- Settings Dialog -->
    <Teleport to="body">
      <Transition name="dialog">
        <div v-if="settingsVisible" class="dialog-overlay" @click.self="settingsVisible = false">
          <div class="dialog-card">
            <h3>用户设置</h3>
            <div class="dialog-form">
              <div class="field">
                <label>身份</label>
                <el-select v-model="selectedRole" size="large" @change="onRoleChange">
                  <el-option v-for="opt in roleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </div>
              <div class="field">
                <label>年级</label>
                <el-select v-model="selectedGrade" size="large" clearable placeholder="选择年级" @change="onGradeChange">
                  <el-option v-for="opt in gradeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </div>
              <div class="field">
                <label>专业</label>
                <el-input v-model="draftMajor" size="large" clearable placeholder="输入专业" @blur="commitMajor" @keyup.enter="commitMajor" @clear="clearMajor" />
              </div>
              <div class="field field--switch">
                <span>演示模式</span>
                <el-switch v-model="demoMode" inline-prompt active-text="开" inactive-text="关" @change="agentStore.setDemoMode($event as boolean)" />
              </div>
            </div>
            <div class="dialog-ft">
              <el-button text type="danger" @click="agentStore.resetSession()">重置会话</el-button>
              <el-button @click="settingsVisible = false">关闭</el-button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DigitalHumanPlayer from '@/components/DigitalHumanPlayer.vue'
import { useAgentStore } from '@/store/agent'

type UserRole = 'student' | 'teacher' | 'guest'
type GradeValue = '' | '大一' | '大二' | '大三' | '大四' | '大五' | '研一' | '研二' | '研三'

const agentStore = useAgentStore()
const settingsVisible = ref(false)
const stopPlaySignal = ref(0)
const demoMode = ref(true)

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

const latestSourceCount = computed(() => {
  const latest = [...agentStore.messages].reverse().find((m) => m.role === 'assistant')
  return Array.isArray(latest?.sources) ? latest.sources.length : 0
})

const onRoleChange = (role: UserRole) => { agentStore.setUserProfile({ role }); agentStore.refreshSystemPrompt() }
const onGradeChange = (grade: GradeValue | undefined) => {
  selectedGrade.value = grade || ''
  agentStore.setUserProfile({ grade: selectedGrade.value }); agentStore.refreshSystemPrompt()
}
const commitMajor = () => {
  const v = draftMajor.value.trim()
  if (v === selectedMajor.value) return
  selectedMajor.value = v
  agentStore.setUserProfile({ major: v }); agentStore.refreshSystemPrompt()
}
const clearMajor = () => { draftMajor.value = ''; commitMajor() }

const syncForm = () => {
  selectedRole.value = (agentStore.userProfile.role as UserRole) || 'student'
  selectedGrade.value = (agentStore.userProfile.grade as GradeValue) || ''
  selectedMajor.value = agentStore.userProfile.major || ''
  draftMajor.value = selectedMajor.value
  demoMode.value = agentStore.demoMode
}

onMounted(() => {
  agentStore.hydrateSession()
  syncForm()
  if (!agentStore.userProfile.role) agentStore.setUserProfile({ role: selectedRole.value })
  if (!agentStore.userProfile.grade) agentStore.setUserProfile({ grade: selectedGrade.value })
  if (!agentStore.userProfile.major) agentStore.setUserProfile({ major: selectedMajor.value })
  syncForm()
  agentStore.initAgent()
})
</script>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  color: #f5f5f7;
}

.panel__stage {
  flex: 1;
  min-height: 0;
}

/* ---- Quick Prompts ---- */
.panel__prompts {
  display: grid;
  gap: 0.25rem;
  flex-shrink: 0;
}
.panel__prompts button {
  all: unset;
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  color: rgba(245,245,247,0.65);
  font-size: var(--font-size-subhead);
  cursor: pointer;
  transition: all var(--transition-micro);
}
.panel__prompts button:hover {
  background: rgba(255,255,255,0.06);
  color: #fff;
}

/* ---- Actions ---- */
.panel__actions {
  display: grid;
  gap: 0.5rem;
  flex-shrink: 0;
}
.panel-btn {
  all: unset;
  display: flex; align-items: center; justify-content: center;
  height: 2.25rem;
  border-radius: var(--radius-pill);
  background: rgba(255,255,255,0.06);
  color: #f5f5f7;
  font-size: var(--font-size-subhead);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-micro);
}
.panel-btn:hover { background: rgba(255,255,255,0.12); }
.panel-btn--primary { background: var(--apple-blue); color: #fff; }
.panel-btn--primary:hover { background: var(--apple-blue-hover); }

/* ---- Context Chips ---- */
.panel__context {
  display: flex; flex-wrap: wrap; gap: 0.375rem;
  flex-shrink: 0;
}
.panel__context span {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-pill);
  background: rgba(255,255,255,0.06);
  color: rgba(245,245,247,0.45);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
}

/* ---- Dialog ---- */
.dialog-overlay {
  position: fixed; inset: 0; z-index: 100;
  display: grid; place-items: center;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(0.5rem);
}
.dialog-card {
  width: min(26rem, calc(100vw - 2rem));
  padding: var(--space-6);
  border-radius: var(--radius-2xl);
  background: #1c1c1e;
  border: 0.5px solid rgba(255,255,255,0.08);
  box-shadow: var(--shadow-modal);
  color: #f5f5f7;
}
.dialog-card h3 {
  margin: 0 0 var(--space-4);
  font-size: var(--font-size-title2);
  font-weight: var(--font-weight-semibold);
}
.dialog-form { display: grid; gap: var(--space-4); }
.field { display: grid; gap: 0.375rem; }
.field label {
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
  color: rgba(245,245,247,0.55);
}
.field--switch {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: var(--space-3);
  border-top: 0.5px solid rgba(255,255,255,0.08);
}
.dialog-ft { display: flex; justify-content: space-between; margin-top: var(--space-5); }

:deep(.field .el-input__wrapper),
:deep(.field .el-select .el-input__wrapper) {
  background: rgba(255,255,255,0.06) !important;
  border: 0.5px solid rgba(255,255,255,0.08) !important;
  border-radius: var(--radius-md) !important;
  box-shadow: none !important;
}
:deep(.field .el-input__inner),
:deep(.field .el-select .el-input__inner) { color: #f5f5f7 !important; }

/* ---- Dialog transition ---- */
.dialog-enter-active { transition: opacity 0.2s ease-out; }
.dialog-leave-active { transition: opacity 0.15s ease-in; }
.dialog-enter-from,
.dialog-leave-to { opacity: 0; }
.dialog-enter-active .dialog-card { animation: dialog-in 0.3s cubic-bezier(0,0,0.2,1); }
.dialog-leave-active .dialog-card { animation: dialog-out 0.2s ease-in forwards; }

@keyframes dialog-in {
  from { opacity: 0; transform: scale(0.92) translateY(1rem); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes dialog-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.92) translateY(0.5rem); }
}
</style>
