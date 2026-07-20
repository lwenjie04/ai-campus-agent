<template>
  <div
    class="chat-avatar"
    :class="[`chat-avatar--${role}`, { 'is-active': active }]"
    role="img"
    :aria-label="role === 'assistant' ? '数智校答助手标识' : '用户消息标识'"
  >
    <svg v-if="role === 'assistant'" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.7 6.7h8.05a3.55 3.55 0 0 1 3.55 3.55v2.35a3.55 3.55 0 0 1-3.55 3.55h-4.6l-3.45 2.4v-2.4a3.55 3.55 0 0 1-3-3.5v-2.4A3.55 3.55 0 0 1 6.7 6.7Z"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.65"
      />
      <path d="M8.1 10.45h5.2M8.1 13h3.55" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.55" />
      <path
        d="m17.6 3.2.45 1.2 1.2.45-1.2.45-.45 1.2-.45-1.2-1.2-.45 1.2-.45.45-1.2Z"
        fill="currentColor"
      />
    </svg>

    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M18.85 5.15C13 5.35 7.5 7.05 5.65 11.45c-1.35 3.2.2 6.35 3.45 7.15 3.35.85 6.55-1.15 7.4-4.55.65-2.6.15-5.45 2.35-8.9Z"
        fill="none"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.6"
      />
      <path d="M6.55 19.7c2.2-4.45 5.35-7.7 9.55-9.85" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.6" />
      <path d="M10.25 13.7c.05-1.3-.2-2.25-.75-3M12.25 12c1.25.05 2.15.35 2.85.8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="1.35" />
    </svg>

    <span v-if="role === 'assistant'" class="status-dot" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    role: 'assistant' | 'user'
    active?: boolean
  }>(),
  {
    active: false,
  },
)
</script>

<style scoped>
.chat-avatar {
  position: relative;
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  border-radius: 14px;
}

.chat-avatar svg {
  width: 25px;
  height: 25px;
}

.chat-avatar--assistant {
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: linear-gradient(145deg, #1b653e 0%, #2f8e53 56%, #55c86c 100%);
  box-shadow:
    0 9px 20px rgba(24, 100, 59, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.24);
}

.chat-avatar--user {
  color: #356c47;
  border: 1px solid rgba(61, 121, 76, 0.16);
  background: linear-gradient(145deg, rgba(250, 253, 244, 0.98), rgba(218, 240, 216, 0.96));
  box-shadow:
    0 7px 16px rgba(55, 116, 63, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.76);
}

.status-dot {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  border: 2px solid #f7fcf4;
  border-radius: 50%;
  background: #61d86d;
  box-shadow: 0 2px 6px rgba(29, 101, 48, 0.22);
}

.is-active .status-dot {
  animation: status-pulse 1.35s ease-in-out infinite;
}

@keyframes status-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(78, 207, 98, 0.32);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(78, 207, 98, 0);
  }
}

@media (max-width: 680px) {
  .chat-avatar {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
    border-radius: 12px;
  }

  .chat-avatar svg {
    width: 22px;
    height: 22px;
  }

  .status-dot {
    width: 9px;
    height: 9px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .is-active .status-dot {
    animation: none;
  }
}
</style>
