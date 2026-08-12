<template>
  <div class="login-card login-card--dialog">
      <div class="login-card__head">
        <div class="login-kicker">数智校答 · 账号入口</div>
        <h1>登录校园智能服务台</h1>
        <p>
          校园用户使用邮箱登录服务台；知识运营员使用管理员账号进入运营后台。
        </p>
      </div>

      <div class="login-highlights">
        <div class="login-highlight">
          <strong>可信事项导办</strong>
          <span>查询校园规则、办理步骤和可核对来源。</span>
        </div>
        <div class="login-highlight">
          <strong>校园经验</strong>
          <span>校园用户可发帖与回复，审核后可沉淀为辅助知识。</span>
        </div>
        <div class="login-highlight">
          <strong>知识运营</strong>
          <span>运营人员审核内容、发布知识并维护检索运行。</span>
        </div>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs" stretch>
        <el-tab-pane label="登录" name="login">
          <el-alert
            title="知识运营员输入账号；校园用户输入注册邮箱。"
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
              登录并继续
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
  try {
    const role = await authStore.login({
      account: loginForm.value.account,
      password: loginForm.value.password,
    })

    ElMessage.success(role === 'admin' ? '知识运营员登录成功' : '登录成功')
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
/* 登录弹窗模式：不再需要全屏背景 */
.login-card {
  width: 100%;
  box-sizing: border-box;
}

.login-card--dialog {
  padding: 30px 32px 32px;
  border: none;
  background: transparent;
  box-shadow: none;
}

/* 弹窗内隐藏装饰性高亮，专注登录表单 */
.login-card--dialog .login-highlights {
  display: none;
}

/* 品牌头部：居中、清爽 */
.login-card--dialog .login-kicker {
  display: none;
}

.login-card--dialog .login-card__head {
  text-align: center;
  margin-bottom: 6px;
}

.login-card--dialog .login-card__head h1 {
  margin: 4px 0 6px;
  font-size: 26px;
  color: #1a5c33;
  letter-spacing: 0.02em;
}

.login-card--dialog .login-card__head p {
  font-size: 13px;
  color: rgba(24, 78, 48, 0.58);
}

/* tabs 居中、紧凑 */
.login-card--dialog .login-tabs {
  margin-top: 4px;
}

.login-card--dialog :deep(.el-tabs__header) {
  margin-bottom: 6px;
}

/* 表单舒适 */
.login-card--dialog .login-form {
  margin-top: 16px;
}

.login-card--dialog :deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 3px 12px;
  box-shadow: 0 0 0 1px rgba(103, 167, 94, 0.18) inset;
}

.login-card--dialog :deep(.el-input__wrapper:hover),
.login-card--dialog :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px rgba(63, 140, 82, 0.35) inset;
}

.login-card--dialog :deep(.el-form-item) {
  margin-bottom: 16px;
}

.login-card--dialog :deep(.el-form-item__label) {
  font-weight: 600;
  color: #2a5c3c;
}

/* 按钮 */
.login-card--dialog .login-actions {
  margin-top: 14px;
}

.login-card--dialog .login-actions .el-button {
  min-height: 42px;
  padding: 0 22px;
  border-radius: 999px;
  font-weight: 700;
}

.login-card--dialog .login-actions--single {
  justify-content: stretch;
}

.login-card--dialog .login-actions--single .el-button {
  width: 100%;
}

.login-kicker {
  display: inline-flex;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(122, 202, 117, 0.14);
  color: #2f7b40;
  font-size: 13px;
  font-weight: 700;
}

.login-card__head h1 {
  margin: 12px 0 10px;
  color: #184e30;
  font-size: 34px;
}

.login-card__head p {
  margin: 0;
  color: rgba(24, 78, 48, 0.72);
  line-height: 1.75;
}

.login-highlights {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 22px 0 18px;
}

.login-highlight {
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(96, 162, 90, 0.14);
}

.login-highlight strong {
  display: block;
  margin-bottom: 6px;
  color: #1f5e39;
  font-size: 15px;
}

.login-highlight span {
  color: rgba(24, 78, 48, 0.72);
  line-height: 1.65;
  font-size: 13px;
}

.login-tabs {
  margin-top: 10px;
}

.login-form {
  margin-top: 18px;
}

.verify-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.verify-row__button {
  min-width: 134px;
}

.login-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.login-actions--single {
  justify-content: flex-end;
}

@media (max-width: 680px) {
  .login-page {
    padding: 16px;
  }

  .login-card {
    padding: 22px;
  }

  .login-highlights {
    grid-template-columns: 1fr;
  }

  .verify-row,
  .login-actions {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .verify-row__button {
    width: 100%;
  }
}
</style>
