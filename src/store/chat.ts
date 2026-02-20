import { defineStore } from 'pinia'

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as any[]
  }),

  actions: {
    addMessage(role: string, content: string) {
      this.messages.push({ role, content })
    }
  }
})
