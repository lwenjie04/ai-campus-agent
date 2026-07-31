import { defineStore } from 'pinia'

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as { role: string; content: string }[]
  }),

  actions: {
    addMessage(role: string, content: string) {
      this.messages.push({ role, content })
    }
  }
})
