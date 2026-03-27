<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-card__head">
        <div class="login-kicker">登录页</div>
        <h1>管理员登录</h1>
        <p>当前先提供轻量登录能力，用于进入学生社区审核页。后续我们可以再接学校统一身份认证或真实后台登录。</p>
      </div>

      <el-alert
        title="当前演示账号：admin / admin123"
        type="success"
        :closable="false"
        show-icon
      />

      <el-form label-position="top" class="login-form">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入管理员用户名" />
        </el-form-item>

        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="请输入管理员密码"
            @keyup.enter="submitLogin"
          />
        </el-form-item>
      </el-form>

      <div class="login-actions">
        <el-button round @click="$emit('go-home')">返回首页</el-button>
        <el-button type="primary" round @click="submitLogin">登录管理员页</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/store/auth'

const emit = defineEmits<{
  (e: 'login-success'): void
  (e: 'go-home'): void
}>()

const authStore = useAuthStore()

const form = ref({
  username: 'admin',
  password: 'admin123',
})

const submitLogin = () => {
  try {
    authStore.login({
      username: form.value.username,
      password: form.value.password,
    })
    ElMessage.success('登录成功')
    emit('login-success')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  }
}
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
  width: min(560px, 100%);
  padding: 28px;
  border: 1px solid rgba(103, 167, 94, 0.2);
  border-radius: 28px;
  background: rgba(251, 255, 248, 0.84);
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
  margin: 0 0 18px;
  color: rgba(24, 78, 48, 0.72);
  line-height: 1.75;
}

.login-form {
  margin-top: 18px;
}

.login-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

@media (max-width: 680px) {
  .login-page {
    padding: 16px;
  }

  .login-card {
    padding: 22px;
  }

  .login-actions {
    flex-direction: column;
  }
}
</style>
