<template>
  <view class="page">
    <view class="card">
      <view class="title">用户信息设置</view>

      <view class="field">
        <text class="label">身份</text>
        <picker :range="roleOptions" range-key="label" @change="onRoleChange">
          <view class="picker-value">{{ currentRoleLabel }}</view>
        </picker>
      </view>

      <view class="field">
        <text class="label">年级</text>
        <input v-model="grade" class="input" placeholder="例如：大三" />
      </view>

      <view class="field">
        <text class="label">专业</text>
        <input v-model="major" class="input" placeholder="请输入专业" />
      </view>

      <button class="save-btn" @tap="saveProfile">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProfileStore } from '../../stores/profile'

const profileStore = useProfileStore()

const roleOptions = [
  { label: '学生', value: 'student' },
  { label: '教师', value: 'teacher' },
  { label: '访客', value: 'guest' },
]

const role = ref(profileStore.role)
const grade = ref(profileStore.grade)
const major = ref(profileStore.major)

const currentRoleLabel = computed(() => roleOptions.find((item) => item.value === role.value)?.label || '学生')

const onRoleChange = (event: any) => {
  const index = Number(event?.detail?.value || 0)
  role.value = roleOptions[index]?.value || 'student'
}

const saveProfile = () => {
  profileStore.setProfile({
    role: role.value,
    grade: grade.value.trim(),
    major: major.value.trim(),
  })

  uni.showToast({
    title: '已保存',
    icon: 'success',
  })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.card {
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(61, 145, 74, 0.14);
  box-shadow: 0 12rpx 28rpx rgba(23, 90, 38, 0.06);
}

.title {
  font-size: 34rpx;
  font-weight: 800;
  color: #153722;
}

.field {
  margin-top: 24rpx;
}

.label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 25rpx;
  color: #406247;
}

.input,
.picker-value {
  min-height: 88rpx;
  padding: 0 24rpx;
  border-radius: 20rpx;
  background: #f7fff6;
  border: 1px solid rgba(61, 145, 74, 0.16);
  display: flex;
  align-items: center;
  font-size: 28rpx;
  color: #173b22;
}

.save-btn {
  margin-top: 28rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #73dd6c 0%, #47b85f 100%);
  color: #fff;
  font-size: 28rpx;
}
</style>
