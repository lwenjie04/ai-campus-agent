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
              <div class="brand-title">答案有据，<br />办事有路。</div>
              <p class="brand-subtitle">查规则、理材料、找入口，每个答案都有依据。</p>
            </div>
          </div>
          <span class="brand-edition">GDEI<br />2026</span>
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
          <div class="stage-status" aria-hidden="true">
            <span class="stage-status__dot" />
            <span>DIGITAL GUIDE / ONLINE</span>
          </div>
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
                  <h2>今天，想解决<br />哪件校园事？</h2>
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
                <el-button class="settings-btn" size="small" data-testid="open-history" @click="historyOpen = true">
                  历史
                </el-button>
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

          <p v-if="conversationNotice" class="conversation-notice" role="status">{{ conversationNotice }}</p>
          <p v-if="storageMessage" class="conversation-notice conversation-notice--warn" role="status">
            {{ storageMessage }}
          </p>

          <!--
            聊天主体区：
            这里不自己渲染每一条消息，而是把消息数组传给 ChatWindow。
          -->
          <div class="chat-body">
            <ChatWindow
              :messages="visibleMessages"
              :loading="store.loading"
              @open-community-post="emit('openCommunityPost', $event)"
              @retry="handleRetry"
            />
          </div>

          <!--
            停止播放按钮：
            用来中断当前讲解视频和语音播报。
          -->
          <div class="chat-actions-bar">
            <el-button
              v-if="store.loading"
              class="stop-btn"
              size="small"
              data-testid="stop-generation"
              @click="handleCancelGeneration"
            >
              停止生成
            </el-button>
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
            <InputBox v-model="draftText" :loading="store.loading" @send="handleSend" />
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

    <HistoryDrawer
      :open="historyOpen"
      :summaries="conversations.summaries"
      :active-id="activeConversationId"
      :storage-message="storageMessage"
      @close="historyOpen = false"
      @new="startNewConversation"
      @open="openConversation"
      @remove="removeConversation"
    />
  </div>
</template>

<script setup lang="ts">
// 引入 Vue 组合式 API：
// ref 用于定义基础响应式变量
// computed 用于定义依赖其他状态自动更新的计算属性
// onMounted 用于在页面挂载后执行初始化逻辑
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// 引入右侧聊天列表组件
import ChatWindow from '@/components/ChatWindow.vue'

// 引入输入框组件
import InputBox from '@/components/InputBox.vue'

// 引入左侧数字人播放器组件
import DigitalHumanPlayer from '@/components/DigitalHumanPlayer.vue'

// 引入全局智能体 store
import { useAgentStore } from '@/store/agent'
import { useAuthStore } from '@/store/auth'
import { useConversationsStore, resolveOwnerScope } from '@/store/conversations'
import { applyMessagesToConversation, conversationToMessages } from '@/services/conversation-session'
import { clearPendingQuestion, readPendingQuestion, writePendingQuestion } from '@/services/pending-question'
import { useRoute, useRouter } from 'vue-router'
import HistoryDrawer from '@/components/HistoryDrawer.vue'

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
const guestTrialUsed = ref(false)

const getLocalStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
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
  clearPendingQuestion(getLocalStorage())
}

const queuePendingDraft = (text: string) => {
  const normalized = text.trim()
  if (!normalized) return
  pendingDraft.value = normalized
  pendingDraftRestored.value = false
  writePendingQuestion(normalized, getLocalStorage())
}

const restorePendingDraft = () => {
  const stored = readPendingQuestion(getLocalStorage())
  if (!stored) return
  pendingDraft.value = stored.text
  pendingDraftRestored.value = true
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

// 3.3：会话记录、历史抽屉与路由恢复。
const conversations = useConversationsStore()
const route = useRoute()
const router = useRouter()
const historyOpen = ref(false)
const activeConversationId = ref('')
const conversationNotice = ref('')
const draftText = ref('')

const storageMessage = computed(() => {
  if (!conversations.storageError) return ''
  return conversations.storageError === 'quota' || conversations.storageError === 'capacity'
    ? '浏览器存储空间不足，本次对话可能无法恢复，请清理后重试。'
    : '当前浏览器无法保存对话，本次仍可提问，但刷新后可能丢失。'
})

const currentOwnerScope = () => resolveOwnerScope(authStore.loggedIn ? authStore.userId : '')

const ensureConversationScope = () => {
  const scope = currentOwnerScope()
  if (conversations.ownerScope !== scope) conversations.openScope(scope)
}

// 一轮问答结束后把整份消息写回会话；只有出现过用户消息才进入历史。
const persistActiveConversation = () => {
  const messages = store.messages.filter((message) => message.role !== 'system')
  if (!messages.some((message) => message.role === 'user' && message.content.trim())) return ''

  ensureConversationScope()
  const base = conversations.active ?? conversations.createDraft()
  const next = applyMessagesToConversation(base, messages)
  conversations.replaceActive(next)
  activeConversationId.value = next.conversationId
  return next.conversationId
}

const syncRouteAfterSend = () => {
  const conversationId = persistActiveConversation()
  if (!conversationId) return
  if (route.params.conversationId !== conversationId) {
    void router.replace(`/chat/${conversationId}`)
  }
}

const startNewConversation = () => {
  if (store.loading) {
    // 切走前先中断并保存当前内容，旧回答不会写进新会话。
    store.cancelGeneration()
    persistActiveConversation()
  }
  conversations.flush()
  ensureConversationScope()
  const draft = conversations.createDraft()
  activeConversationId.value = draft.conversationId
  store.bindRunScope(draft.conversationId, conversations.ownerScope)
  conversationNotice.value = ''
  historyOpen.value = false
  draftText.value = ''
  store.resetSession()
  void router.push('/chat/new')
}

const restoreConversation = async (conversationId: string) => {
  if (store.loading) {
    store.cancelGeneration()
    persistActiveConversation()
    await store.whenIdle()
  }

  ensureConversationScope()
  if (!conversations.loadConversation(conversationId)) {
    conversationNotice.value = '这条对话不存在，或不属于当前身份，已为你新建对话。'
    activeConversationId.value = ''
    store.resetSession()
    await router.replace('/chat/new')
    return
  }

  activeConversationId.value = conversationId
  store.bindRunScope(conversationId, conversations.ownerScope)
  conversationNotice.value = ''
  const loaded = conversations.active
  const messages = loaded ? conversationToMessages(loaded) : []
  store.messages = [
    { role: 'system', content: store.buildSystemPrompt(), createdAt: Date.now() },
    ...messages,
  ]
  draftText.value = loaded?.draft || ''
  store.clearNarration()
  store.triggerVideoCue('idle')
}

const openConversation = (conversationId: string) => {
  historyOpen.value = false
  void router.push(`/chat/${conversationId}`)
}

const removeConversation = (conversationId: string) => {
  conversations.removeConversation(conversationId)
  if (conversationId === activeConversationId.value) startNewConversation()
}

const serviceShortcuts = [
  { label: '奖助学金', query: '国家助学金怎么申请？' },
  { label: '教务办理', query: '申请转专业需要什么条件？' },
  { label: '考试安排', query: '英语四六级什么时候报名？' },
  { label: '生活服务', query: '宿舍报修怎么申请？' },
] as const

// 发送前确保有一条（尚未写入历史的）草稿会话，让运行从一开始就绑定会话身份。
const ensureDraftForRun = () => {
  ensureConversationScope()
  if (!conversations.active) {
    const draft = conversations.createDraft()
    activeConversationId.value = draft.conversationId
  }

  const conversation = conversations.active
  if (conversation) store.bindRunScope(conversation.conversationId, conversations.ownerScope)
  return conversation
}

const runOptions = () => ({
  conversationId: conversations.active?.conversationId,
  ownerScope: conversations.ownerScope,
})

// 游客可以先完成一次真实问答；第二次保留草稿并登录，成功后自动补发。
const handleSend = async (text: string) => {
  if (!authStore.loggedIn && guestTrialUsed.value) {
    queuePendingDraft(text)
    emit('require-login')
    return
  }

  ensureDraftForRun()
  const result = await store.sendMessage(text, runOptions())
  if (!authStore.loggedIn && result.ok) {
    persistGuestTrialUsed()
    syncRouteAfterSend()
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
    return
  }

  syncRouteAfterSend()
}

// 停止生成：保留已生成内容，标记为中断，并立即写回当前会话。
const handleCancelGeneration = () => {
  if (!store.cancelGeneration()) return
  persistActiveConversation()
  conversationNotice.value = '已停止生成，已保留当前内容。'
}

const handleRetry = async (messageId: string) => {
  if (store.loading || !messageId) return
  ensureDraftForRun()
  await store.retryGeneration(messageId, runOptions())
  syncRouteAfterSend()
}

const sendPendingDraft = async () => {
  const draft = pendingDraft.value.trim()
  if (!draft || !authStore.loggedIn || store.loading) return

  const result = await store.sendMessage(draft, runOptions())
  if (result.ok) {
    clearPendingDraft()
    syncRouteAfterSend()
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

// 从历史抽屉或地址栏切换会话时，按新 ID 重新加载。
watch(
  () => route.params.conversationId,
  (value) => {
    const conversationId = typeof value === 'string' ? value : ''
    if (!conversationId || conversationId === activeConversationId.value) return
    void restoreConversation(conversationId)
  },
)

// 输入中的草稿写入当前会话，切走或刷新后仍能恢复。
watch(draftText, (value) => {
  if (!conversations.active) return
  if (conversations.active.draft === value) return
  conversations.setDraft(value)
})

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

// 跨标签页只刷新历史列表；正在生成的会话保持不动，避免旧标签页覆盖新回答。
const handleStorageChange = (event: StorageEvent) => {
  if (!event.key || !event.key.startsWith('ai-campus-agent.conversations')) return
  if (store.loading) return
  conversations.refreshSummaries()
}

// 刷新或关闭页面时先中断并保存当前内容，刷新后应显示 interrupted 而不是空白。
const handleBeforeUnload = () => {
  if (!store.loading) return
  store.cancelGeneration()
  persistActiveConversation()
}

onMounted(() => {
  window.addEventListener('storage', handleStorageChange)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleStorageChange)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  if (store.loading) {
    store.cancelGeneration()
    persistActiveConversation()
  }
})

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

  // 第六步：按路由恢复会话；/chat/new 建立一条空白草稿，未发送前不进历史。
  ensureConversationScope()
  const routeConversationId =
    typeof route.params.conversationId === 'string' ? route.params.conversationId : ''
  if (routeConversationId) {
    void restoreConversation(routeConversationId)
  } else if (route.name === 'chat-new') {
    activeConversationId.value = conversations.createDraft().conversationId
  }
})
</script>


<style scoped>
.page-bg {
  min-height: 100%;
}

.app-shell {
  width: min(100%, 108rem);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.left-stage,
.right-chat {
  min-width: 0;
}

.left-stage {
  order: 2;
  position: relative;
  min-height: 32rem;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  color: var(--white);
  background: var(--ink);
  box-shadow: 0 0.35rem 0 var(--signal);
}

.left-stage::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  content: "";
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 1px, transparent 1px),
    linear-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px);
  background-size: 2.2rem 2.2rem;
  mask-image: linear-gradient(to bottom, black, transparent 78%);
}

.brand-bar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.35rem 1.25rem 0.8rem;
}

.brand-kicker {
  color: var(--sun);
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 800;
  letter-spacing: 0.14em;
}

.brand-title {
  margin-top: 0.55rem;
  font-family: var(--font-display);
  font-size: clamp(2rem, 9vw, 3.8rem);
  font-weight: 900;
  line-height: 1.04;
  letter-spacing: -0.05em;
}

.brand-subtitle {
  max-width: 30ch;
  margin: 0.7rem 0 0;
  color: rgba(255, 253, 248, 0.68);
  font-size: 0.84rem;
  line-height: 1.65;
}

.brand-edition {
  flex: 0 0 auto;
  display: block;
  border-left: 1px solid rgba(255, 255, 255, 0.3);
  padding-left: 0.8rem;
  color: rgba(255, 255, 255, 0.66);
  font-family: var(--font-mono);
  font-size: 0.67rem;
  line-height: 1.5;
  text-align: right;
}

.stage-wrap {
  position: relative;
  z-index: 1;
  min-height: 20rem;
  margin: 0 0.8rem 0.8rem;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-sm);
  background: #c7d8ce;
}

.stage-status {
  position: absolute;
  left: 0.7rem;
  bottom: 0.7rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.34);
  border-radius: 999px;
  color: var(--white);
  background: rgba(17, 24, 29, 0.72);
  font-family: var(--font-mono);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  backdrop-filter: blur(8px);
}

.stage-status__dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: #6df0b1;
  box-shadow: 0 0 0 0.22rem rgba(109, 240, 177, 0.16);
  animation: status-pulse 2.2s ease-in-out infinite;
}

.right-chat {
  order: 1;
}

.chat-card {
  min-height: 39rem;
  display: grid;
  grid-template-rows: auto minmax(18rem, 1fr) auto auto auto;
  overflow: hidden;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  background: var(--paper-raised);
  box-shadow: 0 0.35rem 0 var(--ink);
}

.chat-header {
  border-bottom: 1px solid var(--line-strong);
  padding: 1.1rem;
  background:
    linear-gradient(135deg, rgba(242, 193, 78, 0.17), transparent 58%),
    var(--paper-raised);
}

.header-main,
.header-title-wrap,
.header-actions,
.service-shortcuts,
.resume-draft,
.guest-trial,
.dialog-footer {
  display: flex;
}

.header-main {
  flex-direction: column;
  gap: 1rem;
}

.header-title-wrap {
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.header-eyebrow {
  display: block;
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.header-title-wrap h2 {
  margin: 0.45rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(2rem, 8vw, 3.4rem);
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: -0.065em;
}

.mode-tag {
  flex: 0 0 auto;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: #08605e;
  background: var(--teal-soft);
  font-size: 0.68rem;
  font-weight: 800;
  white-space: nowrap;
}

.header-actions {
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
}

.profile-summary {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.profile-summary span {
  flex: 0 0 auto;
  padding: 0.35rem 0.48rem;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  background: var(--white);
  font-size: 0.68rem;
  font-weight: 750;
}

.settings-btn {
  flex: 0 0 auto;
}

.service-shortcuts {
  counter-reset: shortcut;
  align-items: center;
  gap: 0.45rem;
  margin-top: 1rem;
  overflow-x: auto;
  padding-bottom: 0.15rem;
  scrollbar-width: none;
}

.service-shortcuts__label {
  flex: 0 0 auto;
  color: var(--ink-soft);
  font-family: var(--font-mono);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.service-shortcuts__item {
  counter-increment: shortcut;
  min-height: 2.35rem;
  flex: 0 0 auto;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.45rem 0.75rem;
  color: var(--ink);
  background: transparent;
  font-size: 0.76rem;
  font-weight: 750;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease, transform 160ms var(--ease-out);
}

.service-shortcuts__item::before {
  content: "0" counter(shortcut) " · ";
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.61rem;
}

.service-shortcuts__item:hover:not(:disabled) {
  color: var(--white);
  background: var(--ink);
  transform: translateY(-2px);
}

.service-shortcuts__item:disabled {
  opacity: 0.48;
}

.resume-draft {
  flex-direction: column;
  gap: 0.8rem;
  margin-top: 0.9rem;
  border-left: 0.3rem solid var(--sun);
  padding: 0.8rem;
  background: #fff4ce;
}

.conversation-notice {
  margin: 0 0 0.7rem;
  border-left: 0.28rem solid var(--teal);
  padding: 0.55rem 0.7rem;
  color: var(--ink-soft);
  background: var(--teal-soft);
  font-size: 0.78rem;
  line-height: 1.5;
}

.conversation-notice--warn {
  border-left-color: var(--signal);
  color: #a82c19;
  background: #fff0ec;
}

.resume-draft__copy {
  min-width: 0;
  display: grid;
  gap: 0.2rem;
}

.resume-draft__copy strong {
  font-size: 0.8rem;
}

.resume-draft__copy span {
  overflow: hidden;
  color: var(--ink-soft);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.resume-draft__actions {
  gap: 0.45rem;
}

.resume-draft__actions button,
.guest-trial__login {
  min-height: 2.55rem;
  border: 1px solid var(--ink);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
  font-size: 0.76rem;
  font-weight: 800;
  cursor: pointer;
}

.resume-draft__secondary {
  background: transparent;
}

.resume-draft__primary {
  color: var(--white);
  background: var(--ink);
}

.chat-body {
  min-height: 0;
  overflow: hidden;
  background:
    linear-gradient(rgba(17, 24, 29, 0.035) 1px, transparent 1px),
    var(--white);
  background-size: 100% 2rem;
}

.chat-actions-bar {
  display: flex;
  justify-content: flex-end;
  border-top: 1px dashed var(--line);
  padding: 0.45rem 0.85rem;
  background: var(--white);
}

.stop-btn {
  min-height: 2.35rem;
  color: var(--signal-dark);
  background: transparent;
}

.guest-trial {
  align-items: center;
  gap: 0.65rem;
  border-top: 1px solid var(--line);
  padding: 0.75rem 0.9rem;
  background: var(--teal-soft);
}

.guest-trial--used {
  background: var(--paper-deep);
}

.guest-trial__mark {
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--white);
  background: var(--teal);
  font-family: var(--font-mono);
  font-weight: 900;
}

.guest-trial__copy {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 0.15rem;
}

.guest-trial__copy strong {
  font-size: 0.78rem;
}

.guest-trial__copy span {
  color: var(--ink-soft);
  font-size: 0.69rem;
  line-height: 1.45;
}

.guest-trial__login {
  flex: 0 0 auto;
  color: var(--white);
  background: var(--ink);
}

.input-area {
  border-top: 1px solid var(--line-strong);
  padding: 0.7rem;
  background: var(--paper-deep);
}

.settings-panel,
.profile-controls {
  display: grid;
  gap: 1rem;
}

.setting-field {
  display: grid;
  gap: 0.45rem;
}

.setting-label {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.ctrl-select,
.major-input {
  width: 100%;
}

.dialog-footer {
  justify-content: space-between;
}

@keyframes status-pulse {
  50% {
    opacity: 0.55;
    transform: scale(0.86);
  }
}

@media (max-width: 47.99rem) {
  .chat-header {
    padding: 1rem;
  }

  .header-title-wrap {
    flex-direction: column;
    gap: 0.65rem;
  }

  .header-title-wrap > div,
  .header-title-wrap h2 {
    min-width: 0;
    max-width: 100%;
  }

  .mode-tag {
    align-self: flex-start;
    white-space: normal;
  }

  .header-actions {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .profile-summary {
    flex-wrap: wrap;
    overflow: visible;
  }

  .service-shortcuts {
    align-items: stretch;
    flex-wrap: wrap;
    overflow: visible;
  }

  .service-shortcuts__label {
    width: 100%;
    padding-bottom: 0.15rem;
  }

  .service-shortcuts__item {
    min-width: 7.8rem;
    flex: 1 1 calc(50% - 0.45rem);
  }

  .guest-trial {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .guest-trial__login {
    width: 100%;
  }
}

@media (min-width: 48rem) {
  .app-shell {
    gap: 1rem;
  }

  .header-main {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }

  .header-actions {
    flex-direction: column;
    align-items: flex-end;
  }

  .resume-draft {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .profile-controls {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .setting-field--full {
    grid-column: 1 / -1;
  }
}

@media (min-width: 64rem) {
  .page-bg,
  .app-shell {
    height: 100%;
    min-height: 0;
  }

  .app-shell {
    display: grid;
    grid-template-columns: minmax(19rem, 0.82fr) minmax(31rem, 1.18fr);
  }

  .left-stage,
  .right-chat {
    order: initial;
    min-height: 0;
  }

  .left-stage,
  .chat-card {
    height: 100%;
  }

  .brand-title {
    font-size: clamp(2.5rem, 3.7vw, 4.4rem);
  }

  .stage-wrap {
    min-height: 0;
  }

  .chat-card {
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr) auto auto auto;
  }

  .chat-header {
    padding: 1.25rem 1.4rem 1rem;
  }

  .header-title-wrap h2 {
    font-size: clamp(2.2rem, 3.4vw, 4.25rem);
  }
}

@media (min-width: 90rem) {
  .app-shell {
    grid-template-columns: minmax(23rem, 0.88fr) minmax(38rem, 1.12fr);
  }
}
</style>
