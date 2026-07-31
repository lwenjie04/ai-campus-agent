<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card__head">
        <div class="login-kicker">账号入口</div>
        <h1>数智校答</h1>
        <p>
          管理员使用账号密码直接登录；普通用户使用邮箱验证码完成注册后，再通过邮箱和密码进入系统。
        </p>
      </div>

      <div class="login-highlights">
        <div class="login-highlight">
          <strong>数字人问答</strong>
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

      <el-dialog
        v-model="showChangePassword"
        title="修改初始密码"
        width="420px"
        :close-on-click-modal="false"
        :show-close="false"
        append-to-body
      >
        <el-alert title="为保障账号安全，首次登录后必须修改初始密码。" type="warning" :closable="false" show-icon />
        <el-form label-position="top" class="login-form">
          <el-form-item label="原密码">
            <el-input v-model="changeForm.oldPassword" type="password" show-password placeholder="请输入当前密码" />
          </el-form-item>
          <el-form-item label="新密码">
            <el-input
              v-model="changeForm.newPassword"
              type="password"
              show-password
              placeholder="请设置至少 6 位新密码"
            />
          </el-form-item>
          <el-form-item label="确认新密码">
            <el-input
              v-model="changeForm.confirmPassword"
              type="password"
              show-password
              placeholder="请再次输入新密码"
              @keyup.enter="submitChangePassword"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button type="primary" round :loading="submittingChange" @click="submitChangePassword">
            确认修改
          </el-button>
        </template>
      </el-dialog>
    </div>
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

const showChangePassword = ref(false)
const submittingChange = ref(false)
const changeForm = ref({
  oldPassword: '',
  newPassword: '',
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

    // 首次登录（默认管理员 admin123）需先改密才能进入系统。
    if (authStore.mustChangePassword) {
      changeForm.value.oldPassword = loginForm.value.password
      showChangePassword.value = true
      ElMessage.warning('出于安全考虑，请先修改初始密码')
      return
    }

    ElMessage.success(role === 'admin' ? '管理员登录成功' : '登录成功')
    emit('login-success', role)
  } catch (error) {
    ElMessage.error(extractErrorMessage(error, '登录失败'))
  } finally {
    submittingLogin.value = false
  }
}

const submitChangePassword = async () => {
  if (changeForm.value.newPassword.length < 6) {
    ElMessage.error('新密码长度至少为 6 位')
    return
  }
  if (changeForm.value.newPassword !== changeForm.value.confirmPassword) {
    ElMessage.error('两次输入的新密码不一致')
    return
  }

  submittingChange.value = true
  try {
    await authStore.changePassword({
      oldPassword: changeForm.value.oldPassword,
      newPassword: changeForm.value.newPassword,
    })
    ElMessage.success('密码修改成功')
    showChangePassword.value = false
    emit('login-success', authStore.role as LoginRole)
  } catch (error) {
    ElMessage.error(extractErrorMessage(error, '密码修改失败'))
  } finally {
    submittingChange.value = false
  }
}

const submitRegister = async () => {
  submittingRegister.value = true
  try {
    const role = await authStore.register({
      displayName: registerForm.value.displayName,
      email: registerForm.value.email,
      verifyCode: registerForm.value.verifyCode,
      password: registerForm.value.password,
      confirmPassword: registerForm.value.confirmPassword,
    })

    ElMessage.success('注册成功，已自动登录')
    emit('login-success', role)
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
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at top, rgba(243, 255, 240, 0.98), rgba(222, 249, 214, 0.92) 42%, rgba(135, 223, 99, 0.96) 100%);
}

.login-card {
  width: min(680px, 100%);
  padding: 30px;
  border: 1px solid rgba(103, 167, 94, 0.2);
  border-radius: 28px;
  background: rgba(251, 255, 248, 0.88);
  box-shadow: 0 20px 42px rgba(55, 116, 63, 0.14);
  backdrop-filter: blur(18px);
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
