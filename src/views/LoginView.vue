<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card__head">
        <div class="login-kicker">账号入口</div>
        <h1>校园智能问答平台</h1>
        <p>
          管理员使用账号密码直接登录；普通用户使用邮箱验证码完成注册后，再通过邮箱和密码进入系统。
        </p>
      </div>

      <div class="login-highlights">
        <div class="login-highlight">
          <strong>Prism Core 问答</strong>
          <span>支持知识检索、来源追溯和语音讲解。</span>
        </div>
        <div class="login-highlight">
          <strong>学生社区</strong>
          <span>普通用户可发帖与回复，管理员负责审核与沉淀知识。</span>
        </div>
        <div class="login-highlight">
          <strong>邮箱校验</strong>
          <span>注册需完成邮箱验证码校验，降低恶意注册风险。</span>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs" stretch>
        <el-tab-pane label="登录" name="login">
          <el-alert
            title="管理员输入账号登录；普通用户输入注册邮箱登录。"
            type="success"
            :closable="false"
            show-icon
          />

          <el-form label-position="top" class="login-form">
            <el-form-item label="账号 / 邮箱">
              <el-input v-model="loginForm.account" placeholder="管理员输入账号，普通用户输入邮箱" />
            </el-form-item>

            <el-form-item label="密码">
              <el-input
                v-model="loginForm.password"
                type="password"
                show-password
                placeholder="请输入密码"
                @keyup.enter="submitLogin"
              />
            </el-form-item>
          </el-form>

          <div class="login-actions login-actions--single">
            <el-button type="primary" round :loading="submittingLogin" @click="submitLogin">
              登录并进入系统
            </el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-alert
            title="注册仅支持普通用户；验证码会发送到填写的邮箱，注册成功后系统会通知管理员邮箱。"
            type="info"
            :closable="false"
            show-icon
          />

          <el-form label-position="top" class="login-form">
            <el-form-item label="姓名 / 昵称">
              <el-input v-model="registerForm.displayName" placeholder="请输入姓名或昵称" />
            </el-form-item>

            <el-form-item label="邮箱（唯一标识）">
              <el-input v-model="registerForm.email" placeholder="请输入常用邮箱，用于接收验证码和后续登录" />
            </el-form-item>

            <el-form-item label="邮箱验证码">
              <div class="verify-row">
                <el-input
                  v-model="registerForm.verifyCode"
                  placeholder="请输入邮箱验证码"
                  @keyup.enter="submitRegister"
                />
                <el-button
                  class="verify-row__button"
                  round
                  :loading="sendingCode"
                  :disabled="countdown > 0"
                  @click="sendCode"
                >
                  {{ countdown > 0 ? `${countdown}s 后重发` : '发送验证码' }}
                </el-button>
              </div>
            </el-form-item>

            <el-form-item label="密码">
              <el-input
                v-model="registerForm.password"
                type="password"
                show-password
                placeholder="请设置至少 6 位密码"
              />
            </el-form-item>

            <el-form-item label="确认密码">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                show-password
                placeholder="请再次输入密码"
                @keyup.enter="submitRegister"
              />
            </el-form-item>
          </el-form>

          <div class="login-actions">
            <el-button round @click="backToLogin">返回登录</el-button>
            <el-button type="primary" round :loading="submittingRegister" @click="submitRegister">
              注册普通用户
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, ref } from 'vue'
import { sendRegisterCode } from '@/api/auth'
import { useAuthStore } from '@/store/auth'

type LoginRole = 'user' | 'admin'

const emit = defineEmits<{
  (e: 'login-success', role: LoginRole): void
}>()

const authStore = useAuthStore()
const activeTab = ref<'login' | 'register'>('login')
const submittingLogin = ref(false)
const submittingRegister = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
let countdownTimer: number | null = null

const loginForm = ref({
  account: '',
  password: '',
})

const registerForm = ref({
  displayName: '',
  email: '',
  verifyCode: '',
  password: '',
  confirmPassword: '',
})

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'status' in error && 'code' in error) {
    const err = error as { status?: number; code?: string; message?: string }
    return (
      err.message ||
      fallback
    )
  }
  return error instanceof Error ? error.message : fallback
}

const startCountdown = (seconds: number) => {
  countdown.value = seconds
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
  }

  countdownTimer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      if (countdownTimer) {
        window.clearInterval(countdownTimer)
        countdownTimer = null
      }
      countdown.value = 0
    }
  }, 1000)
}

const sendCode = async () => {
  sendingCode.value = true
  try {
    const result = await sendRegisterCode({
      email: registerForm.value.email,
      displayName: registerForm.value.displayName,
    })
    startCountdown(result.data?.resendSeconds || 60)
    ElMessage.success(result.message || '验证码已发送，请查收邮箱')
  } catch (error) {
    ElMessage.error(extractErrorMessage(error, '验证码发送失败'))
  } finally {
    sendingCode.value = false
  }
}

const submitLogin = async () => {
  submittingLogin.value = true
  try {
    const role = await authStore.login({
      account: loginForm.value.account,
      password: loginForm.value.password,
    })

    ElMessage.success(role === 'admin' ? '管理员登录成功' : '登录成功')
    emit('login-success', role)
  } catch (error) {
    ElMessage.error(extractErrorMessage(error, '登录失败'))
  } finally {
    submittingLogin.value = false
  }
}

const submitRegister = async () => {
  submittingRegister.value = true
  try {
    await authStore.register({
      displayName: registerForm.value.displayName,
      email: registerForm.value.email,
      verifyCode: registerForm.value.verifyCode,
      password: registerForm.value.password,
      confirmPassword: registerForm.value.confirmPassword,
    })

    loginForm.value.account = registerForm.value.email
    loginForm.value.password = registerForm.value.password

    registerForm.value = {
      displayName: '',
      email: '',
      verifyCode: '',
      password: '',
      confirmPassword: '',
    }

    if (countdownTimer) {
      window.clearInterval(countdownTimer)
      countdownTimer = null
    }
    countdown.value = 0
    activeTab.value = 'login'
    ElMessage.success('注册成功，请使用邮箱和密码登录')
  } catch (error) {
    ElMessage.error(extractErrorMessage(error, '注册失败'))
  } finally {
    submittingRegister.value = false
  }
}

const backToLogin = () => {
  activeTab.value = 'login'
}

onBeforeUnmount(() => {
  if (countdownTimer) {
    window.clearInterval(countdownTimer)
  }
})
</script>

<style scoped>
/* Apple ID style — minimal, centered, glass card */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  background: var(--dark-bg);
  font-family: var(--font-sans);
}

.login-card {
  width: min(28rem, 100%);
  padding: var(--space-10) var(--space-8);
  border-radius: var(--radius-2xl);
  background: #1c1c1e;
  border: 0.5px solid rgba(255,255,255,0.06);
  box-shadow: var(--shadow-floating);
}

.login-kicker {
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-pill);
  background: rgba(0,113,227,0.12);
  color: var(--apple-blue);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
}

.login-card__head h1 {
  margin: var(--space-4) 0 var(--space-3);
  color: var(--dark-ink);
  font-size: var(--font-size-large-title);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-tight);
  line-height: var(--line-height-tight);
}

.login-card__head p {
  margin: 0;
  color: var(--dark-muted);
  font-size: var(--font-size-callout);
  line-height: var(--line-height-relaxed);
}

.login-highlights {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;
  margin: var(--space-6) 0;
}
.login-highlight {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.04);
  border: 0.5px solid rgba(255,255,255,0.05);
}
.login-highlight strong {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--dark-ink);
  font-size: var(--font-size-subhead);
  font-weight: var(--font-weight-medium);
}
.login-highlight span {
  color: var(--dark-muted);
  font-size: var(--font-size-caption);
  line-height: var(--line-height-relaxed);
}

.login-tabs { margin-top: var(--space-2); }

.login-form { margin-top: var(--space-5); }

:deep(.el-tabs__nav-wrap::after) { display: none; }
:deep(.el-tabs__item) {
  color: var(--dark-muted);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-regular);
}
:deep(.el-tabs__item.is-active) { color: var(--apple-blue); }
:deep(.el-tabs__active-bar) { background: var(--apple-blue); }

:deep(.el-form-item__label) {
  color: var(--dark-muted);
  font-size: var(--font-size-footnote);
  font-weight: var(--font-weight-medium);
}
:deep(.el-input__wrapper) {
  background: rgba(255,255,255,0.05);
  border-radius: var(--radius-md);
  border: 0.5px solid rgba(255,255,255,0.08);
  box-shadow: none !important;
}
:deep(.el-input__inner) { color: var(--dark-ink); font-size: var(--font-size-body); }
:deep(.el-input__inner::placeholder) { color: rgba(245,245,247,0.35); }
:deep(.el-button--primary) {
  --el-button-bg-color: var(--apple-blue);
  --el-button-border-color: var(--apple-blue);
  --el-button-hover-bg-color: var(--apple-blue-hover);
  --el-button-hover-border-color: var(--apple-blue-hover);
  border-radius: var(--radius-pill);
  font-weight: var(--font-weight-medium);
  height: 2.75rem;
  width: 100%;
}

.verify-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-2);
}
.verify-row__button { min-width: 8rem; border-radius: var(--radius-pill); }

.login-actions {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-2);
}
.login-actions--single { justify-content: flex-end; }

@media (max-width: 680px) {
  .login-page { padding: var(--space-4); }
  .login-card { padding: var(--space-6) var(--space-5); }
  .login-highlights { grid-template-columns: 1fr; }
  .verify-row, .login-actions { grid-template-columns: 1fr; flex-direction: column; }
  .verify-row__button { width: 100%; }
}
</style>
