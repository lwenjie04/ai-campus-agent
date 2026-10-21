<template>
  <div class="login-panel">
    <header class="login-panel__head">
      <div>
        <p class="login-panel__title">账号</p>
        <p class="login-panel__note">登录后继续刚才的操作。</p>
      </div>
      <button type="button" class="login-panel__close" @click="emit('close')">关闭</button>
    </header>

    <el-tabs v-model="activeTab" class="login-tabs" stretch>
      <el-tab-pane label="登录" name="login">
        <p class="login-explain">登录后可继续提问、查看社区和管理账号。</p>

        <el-form label-position="top" class="login-form" @submit.prevent>
          <el-form-item label="邮箱">
            <el-input
              v-model="loginForm.account"
              placeholder="name@school.edu"
              @input="loginError = ''"
            />
          </el-form-item>

          <el-form-item label="密码">
            <el-input
              v-model="loginForm.password"
              type="password"
              show-password
              placeholder="请输入密码"
              @input="loginError = ''"
              @keyup.enter="submitLogin"
            />
          </el-form-item>
        </el-form>

        <p v-if="loginError" class="login-error" role="alert">{{ loginError }}</p>

        <el-button
          type="primary"
          round
          class="login-submit"
          :loading="submittingLogin"
          @click="submitLogin"
        >
          登录
        </el-button>

        <p class="login-switch">
          没有账号？
          <button type="button" @click="activeTab = 'register'">注册</button>
        </p>
        <p class="login-footnote">关闭后保留当前页面和输入内容。</p>
      </el-tab-pane>

      <el-tab-pane label="注册" name="register">
        <p class="login-explain">注册仅支持校园用户；验证码会发送到填写的邮箱。</p>

        <el-form label-position="top" class="login-form" @submit.prevent>
          <el-form-item label="姓名 / 昵称">
            <el-input v-model="registerForm.displayName" placeholder="请输入姓名或昵称" />
          </el-form-item>

          <el-form-item label="注册邮箱">
            <el-input v-model="registerForm.email" placeholder="name@school.edu" @input="registerError = ''" />
          </el-form-item>

          <el-form-item label="验证码">
            <div class="verify-row">
              <el-input
                v-model="registerForm.verifyCode"
                placeholder="输入邮箱验证码"
                @input="registerError = ''"
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

          <el-form-item label="设置密码">
            <el-input
              v-model="registerForm.password"
              type="password"
              show-password
              placeholder="至少 8 位"
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

        <p v-if="registerError" class="login-error" role="alert">{{ registerError }}</p>

        <el-button
          type="primary"
          round
          class="login-submit"
          :loading="submittingRegister"
          @click="submitRegister"
        >
          创建账号
        </el-button>

        <p class="login-switch">
          已有账号？
          <button type="button" @click="backToLogin">返回登录</button>
        </p>
        <p class="login-footnote">注册成功后返回登录，并保留刚才的操作。</p>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import { ElMessage } from 'element-plus'
import { onBeforeUnmount, ref } from 'vue'
import { sendRegisterCode } from '@/api/auth'
import { useAuthStore } from '@/store/auth'

type LoginRole = 'user' | 'admin'

const emit = defineEmits<{
  (e: 'login-success', role: LoginRole): void
  (e: 'close'): void
}>()

const authStore = useAuthStore()
const activeTab = ref<'login' | 'register'>('login')
const submittingLogin = ref(false)
const submittingRegister = ref(false)
const sendingCode = ref(false)
const countdown = ref(0)
const loginError = ref('')
const registerError = ref('')
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
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message ||
      error.message ||
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
  loginError.value = ''
  try {
    const role = await authStore.login({
      account: loginForm.value.account,
      password: loginForm.value.password,
    })

    ElMessage.success(role === 'admin' ? '知识运营员登录成功' : '登录成功')
    emit('login-success', role)
  } catch (error) {
    loginError.value = extractErrorMessage(error, '登录失败')
  } finally {
    submittingLogin.value = false
  }
}

const submitRegister = async () => {
  submittingRegister.value = true
  registerError.value = ''
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
    registerError.value = extractErrorMessage(error, '注册失败')
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
.login-card {
  position: relative;
  display: grid;
  overflow: hidden;
  background: var(--paper-raised);
}

.login-card::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 0.32rem;
  content: "";
  background: linear-gradient(90deg, var(--signal) 0 38%, var(--sun) 38% 62%, var(--teal) 62%);
}

.login-card__head {
  padding: 2rem 1.25rem 1rem;
  color: var(--white);
  background: var(--ink);
}

.login-kicker {
  color: var(--sun);
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.login-card__head h1 {
  max-width: 8ch;
  margin: 0.75rem 0 0;
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 10vw, 4.8rem);
  font-weight: 900;
  line-height: 1.03;
  letter-spacing: -0.07em;
}

.login-card__head p {
  max-width: 34ch;
  margin: 1rem 0 0;
  color: rgba(255, 253, 248, 0.66);
  font-size: 0.82rem;
  line-height: 1.7;
}

.login-highlights {
  display: grid;
  gap: 0;
  color: var(--white);
  background: var(--ink);
}

.login-highlight {
  display: grid;
  gap: 0.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  padding: 0.85rem 1.25rem;
}

.login-highlight::before {
  color: var(--signal);
  font-family: var(--font-mono);
  font-size: 0.62rem;
  font-weight: 900;
}

.login-highlight:nth-child(1)::before { content: "01 / GUIDE"; }
.login-highlight:nth-child(2)::before { content: "02 / SHARE"; }
.login-highlight:nth-child(3)::before { content: "03 / OPERATE"; }

.login-highlight strong {
  font-family: var(--font-display);
  font-size: 0.94rem;
}

.login-highlight span {
  color: rgba(255, 253, 248, 0.58);
  font-size: 0.72rem;
  line-height: 1.5;
}

.login-tabs {
  min-width: 0;
  padding: 1rem 1.15rem 1.35rem;
}

:deep(.el-tabs__header) {
  margin-bottom: 1rem;
}

:deep(.el-form-item__label) {
  padding-bottom: 0.35rem;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.05em;
}

.login-form {
  margin-top: 1rem;
}

.verify-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.55rem;
}

.verify-row__button {
  width: 100%;
}

.login-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
  margin-top: 0.4rem;
}

.login-actions--single :deep(.el-button) {
  width: 100%;
}

@media (min-width: 40rem) {
  .verify-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .verify-row__button {
    width: auto;
  }
}

@media (min-width: 52rem) {
  .login-card {
    min-height: 36rem;
    grid-template-columns: minmax(19rem, 0.86fr) minmax(26rem, 1.14fr);
    grid-template-rows: auto 1fr;
  }

  .login-card__head {
    padding: 3.2rem 2.2rem 1.2rem;
  }

  .login-highlights {
    align-content: end;
  }

  .login-highlight {
    padding: 0.9rem 2.2rem;
  }

  .login-tabs {
    grid-column: 2;
    grid-row: 1 / 3;
    align-self: center;
    padding: 2.5rem 2.6rem;
  }
}
</style>

<style scoped>
/* 22:35 账号：银白卡片、绿色主按钮、错误文案用中性色。 */
.login-panel {
  padding: 2rem 2.2rem 2.2rem;
  background: var(--white);
}

.login-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.login-panel__title {
  margin: 0;
  color: var(--text);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.login-panel__note {
  margin: 0.35rem 0 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.login-panel__close {
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  padding: 0.35rem 0.8rem;
  color: var(--muted);
  background: var(--white);
  font-size: 0.8rem;
  cursor: pointer;
}

.login-panel__close:hover {
  color: var(--text);
  border-color: var(--faint);
}

.login-tabs {
  margin-top: 1rem;
}

:deep(.el-tabs__header) {
  margin-bottom: 1.25rem;
}

:deep(.el-tabs__item) {
  font-size: 0.95rem;
}

.login-explain {
  margin: 0 0 1rem;
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.65;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 1rem;
}

.login-form :deep(.el-form-item__label) {
  padding-bottom: 0.35rem;
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 500;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: var(--radius-sm);
}

.login-error {
  margin: 0.15rem 0 0.85rem;
  color: var(--text);
  font-size: 0.82rem;
  line-height: 1.6;
}

.login-submit {
  width: 100%;
  min-height: 2.75rem;
  margin-top: 0.2rem;
}

.login-switch {
  margin: 1rem 0 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.login-switch button {
  border: 0;
  padding: 0;
  color: var(--link);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.login-footnote {
  margin: 1.6rem 0 0;
  color: var(--faint);
  font-size: 0.78rem;
}

.verify-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.5rem;
}

.verify-row__button {
  min-height: 2.75rem;
  border-color: transparent;
  color: var(--brand);
  background: var(--tint);
}

.verify-row__button:hover {
  border-color: var(--brand);
  background: var(--tint);
}

@media (max-width: 34rem) {
  .login-panel {
    padding: 1.4rem 1.2rem 1.6rem;
  }

  .login-panel__title {
    font-size: 1.6rem;
  }

  .verify-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .verify-row__button {
    width: 100%;
  }
}
</style>
