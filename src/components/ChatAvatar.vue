<template>
  <div
    class="chat-avatar"
    :class="[`chat-avatar--${role}`, { 'is-active': active }]"
    role="img"
    :aria-label="role === 'assistant' ? '校园智能服务台助手标识' : '用户消息标识'"
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
  width: 2.35rem;
  height: 2.35rem;
  flex: 0 0 2.35rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--ink);
  border-radius: 0.35rem;
  color: var(--white);
  background: var(--signal);
  box-shadow: 0.18rem 0.18rem 0 var(--ink);
}

.chat-avatar--user {
  color: var(--white);
  background: var(--teal);
  transform: rotate(3deg);
}

.chat-avatar svg {
  width: 1.35rem;
  height: 1.35rem;
}

.status-dot {
  position: absolute;
  right: -0.22rem;
  bottom: -0.22rem;
  width: 0.65rem;
  height: 0.65rem;
  border: 2px solid var(--white);
  border-radius: 50%;
  background: #20c67a;
}

.is-active {
  animation: avatar-live 1.35s ease-in-out infinite;
}

@keyframes avatar-live {
  50% { transform: translateY(-0.16rem) rotate(-2deg); }
}

@media (max-width: 47.99rem) {
  .chat-avatar {
    width: 2rem;
    height: 2rem;
    flex-basis: 2rem;
  }

  .chat-avatar svg {
    width: 1.15rem;
    height: 1.15rem;
  }
}
</style>
