<template>
  <!--
    page-bg：
    整个页面最外层背景容器。
    负责铺满视口，并提供绿色渐变的大背景。
  -->
  <div class="page-bg">
    <!--
      app-shell：
      页面主体区域，采用左右两栏布局。
      左边放学校品牌和数字人，右边放聊天相关区域。
    -->
    <main class="app-shell">
      <!-- 左侧区域：学校品牌 + 数字人舞台 -->
      <section class="left-stage">
        <!-- 顶部品牌栏：校徽、学校名称、装饰图标 -->
        <header class="brand-bar">
          <div class="brand-left">
            <div>
              <div class="brand-kicker">CAMPUS SERVICE DESK</div>
              <div class="brand-title">校园智能服务台</div>
              <p class="brand-subtitle">查规则、理材料、找入口，每个答案都有依据。</p>
            </div>
          </div>
        </header>

        <!-- 数字人舞台区域 -->
        <div class="stage-wrap">
          <!--
            DigitalHumanPlayer 是左侧舞台的核心组件。
            它根据 store 提供的 cue / narration / signal 来决定：
            1. 当前播放欢迎视频、待机视频还是讲解视频
            2. 是否触发语音播报
            3. 是否响应“停止播放”
          -->
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
      </section>

      <!-- 右侧区域：用户信息、聊天记录、输入区 -->
      <section class="right-chat">
        <div class="chat-card">
          <!-- 聊天头部 -->
          <header class="chat-header">
            <div class="header-main">
              <!-- 标题区 -->
              <div class="header-title-wrap">
                <div>
                  <span class="header-eyebrow">数智校答</span>
                  <h2>今天想办什么事？</h2>
                </div>
                <span class="mode-tag">AI 导办 · 回答附来源</span>
              </div>

              <!-- 右上角操作区：用户摘要 + 设置按钮 -->
              <div class="header-actions">
                <!--
                  profile-summary：
                  把当前选中的身份、年级、专业直接展示出来。
                  这样用户不用展开设置区，也能知道当前上下文是什么。
                -->
                <div class="profile-summary" :title="summaryTitle">
                  <span>{{ roleLabel }}</span>
                  <span>{{ selectedGrade || '未填年级' }}</span>
                  <span>{{ selectedMajor || '未填专业' }}</span>
                </div>

                <!-- 点击后打开用户设置弹窗 -->
                <el-button class="settings-btn" size="small" @click="settingsDialogVisible = true">
                  服务偏好
                </el-button>
              </div>
            </div>

            <div class="service-shortcuts" aria-label="常办事项快捷入口">
              <span class="service-shortcuts__label">常办事项</span>
              <button
                v-for="shortcut in serviceShortcuts"
                :key="shortcut.label"
                type="button"
                class="service-shortcuts__item"
                :disabled="store.loading"
                @click="handleShortcut(shortcut.query)"
              >
                {{ shortcut.label }}
              </button>
            </div>

            <div v-if="pendingDraftRestored && pendingDraft" class="resume-draft" role="status">
              <div class="resume-draft__copy">
                <strong>发现一个未完成的问题</strong>
                <span>{{ pendingDraft }}</span>
              </div>
              <div class="resume-draft__actions">
                <button type="button" class="resume-draft__secondary" @click="discardPendingDraft">放弃</button>
                <button type="button" class="resume-draft__primary" @click="resumePendingQuestion">
                  {{ authStore.loggedIn ? '继续提问' : '登录后继续' }}
                </button>
              </div>
            </div>
          </header>

          <!--
            聊天主体区：
            这里不自己渲染每一条消息，而是把消息数组传给 ChatWindow。
          -->
          <div class="chat-body">
            <ChatWindow
              :messages="visibleMessages"
              :loading="store.loading"
              @open-community-post="emit('openCommunityPost', $event)"
            />
          </div>

          <!--
            停止播放按钮：
            用来中断当前讲解视频和语音播报。
          -->
          <div class="chat-actions-bar">
            <el-button class="stop-btn" size="small" @click="onStopPlayback">停止讲解</el-button>
          </div>

          <div
            v-if="!authStore.loggedIn"
            class="guest-trial"
            :class="{ 'guest-trial--used': guestTrialUsed }"
            role="status"
            aria-live="polite"
          >
            <span class="guest-trial__mark" aria-hidden="true">{{ guestTrialUsed ? '✓' : '1' }}</span>
            <div class="guest-trial__copy">
              <strong>{{ guestTrialUsed ? '免登录试问已完成' : '可免登录试问 1 次' }}</strong>
              <span>{{ guestTrialUsed ? '登录后继续追问，并保留当前对话' : '先查看带来源的真实回答，再决定是否登录' }}</span>
            </div>
            <button type="button" class="guest-trial__login" @click="emit('require-login')">
              {{ guestTrialUsed ? '登录继续' : '直接登录' }}
            </button>
          </div>

          <!-- 输入区 -->
          <footer class="input-area">
            <!--
              InputBox 发出 send 事件后，直接调用 store.sendMessage。
              也就是说：
              页面本身不处理发消息细节，真正的发送逻辑统一放在 store 中。
            -->
            <InputBox :loading="store.loading" @send="handleSend" />
          </footer>
        </div>
      </section>
    </main>

    <!-- 用户设置改为弹窗形式，避免直接挤占右侧聊天区的高度 -->
    <el-dialog
      v-model="settingsDialogVisible"
      title="服务偏好"
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
import { computed, onMounted, ref, watch } from 'vue'

// 引入右侧聊天列表组件
import ChatWindow from '@/components/ChatWindow.vue'

// 引入输入框组件
import InputBox from '@/components/InputBox.vue'

// 引入左侧数字人播放器组件
import DigitalHumanPlayer from '@/components/DigitalHumanPlayer.vue'

// 引入全局智能体 store
import { useAgentStore } from '@/store/agent'
import { useAuthStore } from '@/store/auth'

const emit = defineEmits<{
  (e: 'openCommunityPost', postId: string): void
  (e: 'require-login'): void
}>()

const authStore = useAuthStore()
// 未登录时拦截的待发送消息：同页登录后自动补发，浏览器重启后由用户确认恢复。
const pendingDraft = ref('')
const pendingDraftRestored = ref(false)
const resumeAfterLoginRequested = ref(false)
const GUEST_TRIAL_STORAGE_KEY = 'ai-campus-agent.guest-trial.used.v1'
const PENDING_DRAFT_STORAGE_KEY = 'ai-campus-agent.pending-question.v1'
const PENDING_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const guestTrialUsed = ref(false)

const getLocalStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

type StoredPendingDraft = {
  text: string
  savedAt: number
}

const persistGuestTrialUsed = () => {
  guestTrialUsed.value = true
  try {
    getLocalStorage()?.setItem(GUEST_TRIAL_STORAGE_KEY, 'true')
  } catch {
    // 无痕或浏览器禁用存储时，仅保留当前页面状态。
  }
}

const clearPendingDraft = () => {
  pendingDraft.value = ''
  pendingDraftRestored.value = false
  resumeAfterLoginRequested.value = false
  try {
    getLocalStorage()?.removeItem(PENDING_DRAFT_STORAGE_KEY)
  } catch {
    // 存储不可用时无需额外处理。
  }
}

const queuePendingDraft = (text: string) => {
  const normalized = text.trim()
  if (!normalized) return
  pendingDraft.value = normalized
  pendingDraftRestored.value = false
  try {
    const storage = getLocalStorage()
    if (!storage) return
    const payload: StoredPendingDraft = { text: normalized, savedAt: Date.now() }
    storage.setItem(PENDING_DRAFT_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // 无痕或禁用存储时仍保留当前标签页内的待问。
  }
}

const restorePendingDraft = () => {
  try {
    const raw = getLocalStorage()?.getItem(PENDING_DRAFT_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<StoredPendingDraft>
    const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
    const savedAt = Number(parsed.savedAt)
    if (!text || !Number.isFinite(savedAt) || Date.now() - savedAt > PENDING_DRAFT_TTL_MS) {
      clearPendingDraft()
      return
    }
    pendingDraft.value = text
    pendingDraftRestored.value = true
  } catch {
    clearPendingDraft()
  }
}

// 用户身份的允许值。
// 通过联合类型约束，避免传入不受支持的角色字符串。
type UserRole = 'student' | 'teacher' | 'guest'

// 年级的允许值。
// 空字符串表示用户暂时没有填写年级。
type GradeValue = '' | '大一' | '大二' | '大三' | '大四' | '大五' | '研一' | '研二' | '研三'

// 获取 Pinia store 实例。
// 页面中的业务状态大多都由 store 维护。
const store = useAgentStore()

const serviceShortcuts = [
  { label: '奖助学金', query: '国家助学金怎么申请？' },
  { label: '教务办理', query: '申请转专业需要什么条件？' },
  { label: '考试安排', query: '英语四六级什么时候报名？' },
  { label: '生活服务', query: '宿舍报修怎么申请？' },
] as const

// 游客可以先完成一次真实问答；第二次保留草稿并登录，成功后自动补发。
const handleSend = async (text: string) => {
  if (!authStore.loggedIn && guestTrialUsed.value) {
    queuePendingDraft(text)
    emit('require-login')
    return
  }

  const result = await store.sendMessage(text)
  if (!authStore.loggedIn && result.ok) {
    persistGuestTrialUsed()
    return
  }

  if (
    !authStore.loggedIn &&
    !result.ok &&
    (result.errorCode === 'GUEST_LOGIN_REQUIRED' || result.errorCode === 'GUEST_RATE_LIMITED')
  ) {
    persistGuestTrialUsed()
    queuePendingDraft(text)
    emit('require-login')
  }
}

const sendPendingDraft = async () => {
  const draft = pendingDraft.value.trim()
  if (!draft || !authStore.loggedIn || store.loading) return

  const result = await store.sendMessage(draft)
  if (result.ok) {
    clearPendingDraft()
    return
  }

  pendingDraftRestored.value = true
}

const resumePendingQuestion = () => {
  if (!authStore.loggedIn) {
    resumeAfterLoginRequested.value = true
    emit('require-login')
    return
  }
  void sendPendingDraft()
}

const discardPendingDraft = () => {
  clearPendingDraft()
}

const handleShortcut = (query: string) => {
  if (store.loading) return
  void handleSend(query)
}

watch(
  () => authStore.loggedIn,
  (loggedIn) => {
    if (
      loggedIn &&
      pendingDraft.value &&
      (!pendingDraftRestored.value || resumeAfterLoginRequested.value)
    ) {
      resumeAfterLoginRequested.value = false
      void sendPendingDraft()
    }
  },
)

// 校徽是否加载失败。
// 如果失败，模板里会从图片切换为“广二师”文字兜底。

// 校徽路径。
// 后续如果替换校徽资源，只需要改这一处。

// 用户设置弹窗是否打开。
// 这是纯页面 UI 状态，不需要持久化。
const settingsDialogVisible = ref(false)

// 停止播放信号。
// 为什么不用 boolean？
// 因为 boolean 连续点击可能值不变，子组件 watch 不到；
// 数字递增则每次点击都会触发一次变化。
const stopPlaySignal = ref(0)

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

// 重置会话按钮。
// 由 store 统一清理消息、system prompt、视频状态和持久化缓存。
const resetChat = () => {
  clearPendingDraft()
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
  try {
    guestTrialUsed.value = getLocalStorage()?.getItem(GUEST_TRIAL_STORAGE_KEY) === 'true'
  } catch {
    guestTrialUsed.value = false
  }
  restorePendingDraft()

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
/* 页面大背景：负责铺满整个视口，并给出整体绿色渐变氛围 */
.page-bg {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 14px;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 15% 10%, rgba(255, 255, 255, 0.78), transparent 28%),
    radial-gradient(circle at 82% 12%, rgba(255, 255, 255, 0.5), transparent 24%),
    linear-gradient(180deg, #eef6ec 0%, #d6f0ce 38%, #95e27d 70%, #55d944 100%);
}

/* 主体两栏布局：左边数字人，右边聊天 */
.app-shell {
  width: min(1200px, 100%);
  max-width: 100%;
  height: calc(100vh - 28px);
  display: grid;
  grid-template-columns: minmax(360px, 44fr) minmax(0, 56fr);
  gap: 14px;
  box-sizing: border-box;
}

/* 防止左右两栏在 flex/grid 中因为内容过长被撑破 */
.left-stage,
.right-chat {
  min-width: 0;
}

/* 左侧舞台卡片 */
.left-stage {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% 6%, rgba(240, 251, 240, 0.5), transparent 40%),
    linear-gradient(180deg, #d9edd9 0%, #c1e4c2 58%, #a9dbab 100%);
  border: 1px solid rgba(181, 219, 182, 0.88);
  backdrop-filter: blur(8px);
}

/* 品牌栏 */
.brand-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 4px;
}

/* 左侧品牌部分：校徽 + 标题 */
.brand-left {
  display: flex;
  align-items: center;
  min-width: 0;
}

.brand-kicker,
.header-eyebrow {
  display: block;
  color: #347648;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

/* 学校标题 */
.brand-title {
  font-size: clamp(18px, 1.8vw, 24px);
  font-weight: 900;
  color: #0f0f0f;
  letter-spacing: 0.5px;
  white-space: nowrap;
  text-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
}

.brand-subtitle {
  max-width: 24rem;
  margin: 4px 0 0;
  color: rgba(15, 64, 34, 0.7);
  font-size: 12px;
  line-height: 1.5;
}

/* 数字人舞台区域撑满剩余空间 */
.stage-wrap {
  height: 100%;
  min-height: 0;
}

/* 右侧聊天栏本身用 flex，方便子卡片填满宽度 */
.right-chat {
  display: flex;
}

/* 聊天卡片外壳 */
.chat-card {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto auto auto;
  gap: 10px;
  padding: 12px;
  box-sizing: border-box;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(251, 255, 248, 0.76) 0%, rgba(238, 250, 234, 0.58) 100%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow:
    0 18px 42px rgba(38, 99, 48, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(12px);
  align-content: stretch;
}

/* 聊天头部 */
.chat-header {
  min-width: 0;
  display: grid;
  gap: 10px;
  padding: 2px 2px 0;
}

/* 头部主内容：标题和右侧操作区并排 */
.header-main {
  min-width: 0;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}

/* 标题和模式标签 */
.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.header-title-wrap > div {
  min-width: 0;
}

/* 主标题 */
.chat-header h2 {
  margin: 0;
  font-size: 18px;
  color: #16351b;
  font-weight: 800;
}

.header-eyebrow {
  margin-bottom: 2px;
  color: rgba(35, 101, 56, 0.68);
  letter-spacing: 0.08em;
}

/* 右上角摘要和设置按钮区域 */
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* 用户摘要胶囊 */
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

/* 单个摘要字段超出时显示省略号 */
.profile-summary span {
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 摘要字段之间插入 / 分隔符 */
.profile-summary span + span::before {
  content: '/';
  margin-right: 6px;
  color: rgba(37, 92, 49, 0.55);
}

/* 设置按钮和停止播放按钮共用胶囊样式 */
.settings-btn,
.stop-btn {
  min-height: 44px;
  border-radius: 999px;
  border-color: rgba(46, 113, 53, 0.18);
  color: #1f6a39;
  background: rgba(255, 255, 255, 0.7);
}

.service-shortcuts {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  overflow-x: auto;
  padding: 2px 0 3px;
  scrollbar-width: none;
}

.service-shortcuts::-webkit-scrollbar {
  display: none;
}

.service-shortcuts__label {
  flex: 0 0 auto;
  color: rgba(34, 85, 48, 0.66);
  font-size: 11px;
  font-weight: 800;
}

.service-shortcuts__item {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid rgba(58, 128, 75, 0.14);
  border-radius: 999px;
  color: #245f38;
  background: rgba(255, 255, 255, 0.7);
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

.service-shortcuts__item:hover:not(:disabled) {
  border-color: rgba(44, 135, 72, 0.3);
  background: rgba(250, 255, 247, 0.98);
  transform: translateY(-1px);
}

.service-shortcuts__item:disabled {
  cursor: wait;
  opacity: 0.55;
}

.resume-draft {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(190, 126, 35, 0.22);
  border-radius: 14px;
  color: #684515;
  background: linear-gradient(135deg, rgba(255, 248, 230, 0.97), rgba(255, 253, 245, 0.92));
}

.resume-draft__copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.resume-draft__copy strong {
  font-size: 12px;
}

.resume-draft__copy span {
  overflow: hidden;
  color: rgba(104, 69, 21, 0.78);
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resume-draft__actions {
  flex: 0 0 auto;
  display: flex;
  gap: 7px;
}

.resume-draft__actions button {
  min-height: 40px;
  padding: 8px 11px;
  border-radius: 10px;
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.resume-draft__secondary {
  border: 1px solid rgba(128, 86, 27, 0.2);
  color: #76511d;
  background: rgba(255, 255, 255, 0.6);
}

.resume-draft__primary {
  border: 1px solid #ad6c19;
  color: #fff;
  background: #b97820;
}

/* 停止播放按钮所在区域 */
.chat-actions-bar {
  display: flex;
  justify-content: flex-end;
  padding: 0 4px;
}

:deep(.stop-btn.el-button) {
  color: #3c7049;
  border-color: rgba(55, 120, 69, 0.13);
  background: rgba(247, 252, 244, 0.7);
  box-shadow: none;
}

/* 设置面板 */
.settings-panel {
  border-radius: 14px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.35);
}

.settings-panel--dialog {
  padding: 0;
  background: transparent;
  border: none;
}

/* 设置项容器 */
.profile-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
  font-weight: 700;
  color: #1f6a39;
}

/* select 统一宽度 */
.ctrl-select {
  width: 110px;
}

.ctrl-select--dialog {
  width: 100%;
}

/* 覆盖 Element Plus 下拉框外观 */
:deep(.ctrl-select .el-select__wrapper) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 0 0 1px rgba(46, 113, 53, 0.14) !important;
}

/* 专业输入框 */
.major-input {
  min-width: 220px;
  flex: 1 1 240px;
}

/* 覆盖 Element Plus 输入框外观 */
:deep(.major-input .el-input__wrapper) {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: inset 0 0 0 1px rgba(46, 113, 53, 0.14) !important;
}

/* 重置按钮 */
.reset-btn {
  color: #1f6a39;
  font-weight: 600;
}

/* “数字人对话”模式标签 */
.mode-tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #25633b;
  background: rgba(230, 246, 226, 0.82);
  border: 1px solid rgba(69, 137, 79, 0.12);
  white-space: nowrap;
}

/* 聊天消息区域：移动端固定窗口高度，桌面端由弹性网格分配高度 */
.chat-body {
  height: 740px;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border-radius: 18px;
  padding: 0;
  border: 1px solid rgba(75, 142, 84, 0.14);
  background:
    radial-gradient(circle at 12% 0%, rgba(215, 241, 214, 0.7), transparent 34%),
    linear-gradient(180deg, rgba(252, 255, 249, 0.84) 0%, rgba(238, 249, 234, 0.62) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    inset 0 -18px 34px rgba(104, 191, 99, 0.04);
  overflow: hidden;
}

/* 输入区顶部留一点呼吸感 */
.input-area {
  min-width: 0;
  padding: 0 2px 2px;
}

.guest-trial {
  display: grid;
  grid-template-columns: 2.25rem minmax(0, 1fr);
  gap: 0.625rem;
  align-items: center;
  margin: 0 0.125rem;
  padding: 0.625rem 0.75rem;
  border: 1px solid rgba(42, 127, 72, 0.16);
  border-radius: 0.875rem;
  color: #174a2b;
  background: linear-gradient(135deg, rgba(239, 249, 237, 0.96), rgba(255, 255, 250, 0.9));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.guest-trial--used {
  border-color: rgba(196, 133, 45, 0.24);
  color: #684515;
  background: linear-gradient(135deg, rgba(255, 247, 227, 0.96), rgba(255, 253, 244, 0.92));
}

.guest-trial__mark {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 800;
  background: #2b8a50;
  box-shadow: 0 0.375rem 0.875rem rgba(38, 127, 72, 0.2);
}

.guest-trial--used .guest-trial__mark {
  background: #c17b22;
  box-shadow: 0 0.375rem 0.875rem rgba(166, 103, 25, 0.18);
}

.guest-trial__copy {
  min-width: 0;
  display: grid;
  gap: 0.125rem;
}

.guest-trial__copy strong {
  font-size: 0.875rem;
  line-height: 1.3;
}

.guest-trial__copy span {
  font-size: 0.75rem;
  line-height: 1.45;
  opacity: 0.76;
}

.guest-trial__login {
  grid-column: 1 / -1;
  min-height: 2.75rem;
  padding: 0.625rem 1rem;
  border: 1px solid currentColor;
  border-radius: 0.75rem;
  color: inherit;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease;
}

.guest-trial__login:hover {
  background: rgba(255, 255, 255, 0.96);
  transform: translateY(-1px);
}

@media (min-width: 681px) {
  .guest-trial {
    grid-template-columns: 2.25rem minmax(0, 1fr) auto;
  }

  .guest-trial__login {
    grid-column: auto;
    min-width: 6.5rem;
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

:deep(.settings-dialog .el-dialog) {
  border-radius: 20px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(248, 252, 246, 0.98) 0%, rgba(233, 247, 228, 0.96) 100%);
}

:deep(.settings-dialog .el-dialog__header) {
  margin-right: 0;
  padding: 18px 20px 10px;
}

:deep(.settings-dialog .el-dialog__title) {
  color: #184425;
  font-size: 18px;
  font-weight: 800;
}

:deep(.settings-dialog .el-dialog__body) {
  padding: 8px 20px 12px;
}

:deep(.settings-dialog .el-dialog__footer) {
  padding: 0 20px 18px;
}

/*
 * 桌面端使用顶部导航下方的剩余高度，不再在组件内部重复计算 100vh。
 * 消息区作为唯一弹性轨道吸收剩余空间，操作栏和输入区稳定贴近底部。
 */
@media (min-width: 981px) {
  .page-bg {
    height: 100%;
    min-height: 0;
    padding-inline: 10vw;
  }

  .app-shell {
    width: 100%;
    height: 100%;
    min-height: 0;
    grid-template-columns: clamp(360px, calc(44vw - 18.48px), 522px) minmax(0, 1fr);
  }

  .left-stage,
  .right-chat,
  .stage-wrap,
  .chat-card {
    min-height: 0;
  }

  .chat-card {
    height: 100%;
    grid-template-rows: auto minmax(0, 1fr) auto auto auto;
    align-content: stretch;
  }

  .chat-body {
    height: auto;
  }
}

/* 窄桌面下让聊天头部纵向排列，避免 10vw 外边距压缩内容后产生横向溢出 */
@media (min-width: 981px) and (max-width: 1279px) {
  .header-main {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .profile-summary {
    flex: 1;
  }
}

/* 中屏以下：两栏改为上下布局 */
@media (max-width: 980px) {
  .page-bg {
    height: auto;
  }

  .app-shell {
    width: 100%;
    max-width: calc(100vw - 28px);
    grid-template-columns: 1fr;
    height: auto;
  }

  .right-chat {
    grid-row: 1;
  }

  .left-stage {
    grid-row: 2;
    min-height: 280px;
  }

  .stage-wrap {
    min-height: 220px;
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

/* 小屏设备进一步压缩布局 */
@media (max-width: 640px) {
  .header-title-wrap {
    flex-wrap: wrap;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .service-shortcuts__item {
    flex: 1 1 calc(50% - 4px);
    min-height: 44px;
  }

  .service-shortcuts {
    flex-wrap: wrap;
    overflow-x: visible;
  }

  .service-shortcuts__label {
    flex-basis: 100%;
  }

  .resume-draft {
    flex-direction: column;
    align-items: stretch;
  }

  .resume-draft__copy span {
    white-space: normal;
  }

  .resume-draft__actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .resume-draft__actions button {
    min-height: 44px;
  }

  .profile-summary {
    max-width: 100%;
  }

  .profile-controls {
    width: 100%;
    gap: 6px;
  }

  .profile-controls--dialog {
    grid-template-columns: 1fr;
  }

  .ctrl-select {
    width: calc(50% - 3px);
  }

  .major-input {
    min-width: 100%;
    flex-basis: 100%;
  }

  .chat-body {
    height: clamp(180px, 24dvh, 220px);
  }
}
</style>
