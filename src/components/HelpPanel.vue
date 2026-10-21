<template>
  <el-dialog
    v-model="visible"
    class="help-dialog"
    width="min(640px, calc(100vw - 2rem))"
    append-to-body
    @closed="emit('update:modelValue', false)"
  >
    <template #header>
      <div class="help-head">
        <span class="help-kicker">ABOUT</span>
        <h2>关于校答</h2>
      </div>
    </template>

    <div class="help-body">
      <section>
        <h3>可以做什么</h3>
        <p>查询教务、考试、奖助学金和生活服务信息，整理办理步骤与可核对来源。</p>
      </section>
      <section>
        <h3>回答从哪里来</h3>
        <p>优先使用学校官方通知与已整理资料；社区内容经审核后才作为辅助经验，并带标识。</p>
        <p>没有足够匹配的资料时，会明确说明无法确认，不编造流程。</p>
      </section>
      <section>
        <h3>怎么使用</h3>
        <p>在问答页描述要办的事；来源在回答下方，桌面显示在右侧，手机可展开查看。</p>
        <p>语音讲解按需开启，不是每次回答都会自动播放。</p>
      </section>
      <section>
        <h3>关于记录</h3>
        <p>历史对话只保存在当前浏览器；登录后按账号隔离，不会跨设备同步。</p>
      </section>
    </div>

    <template #footer>
      <el-button type="primary" round @click="visible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<style scoped>
.help-head {
  display: grid;
  gap: 0.15rem;
}

.help-kicker {
  color: var(--faint);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.12em;
}

.help-head h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.help-body {
  display: grid;
  gap: 1.1rem;
}

.help-body h3 {
  margin: 0 0 0.35rem;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
}

.help-body p {
  margin: 0 0 0.35rem;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.7;
}
</style>
