import { defineStore } from 'pinia'

const STORAGE_KEY = 'ai-campus-agent.auth.v1'

type AuthRole = 'guest' | 'admin'

type PersistedAuthState = {
  loggedIn?: boolean
  role?: AuthRole
  displayName?: string
}

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage

export const useAuthStore = defineStore('auth', {
  state: () => ({
    loggedIn: false,
    role: 'guest' as AuthRole,
    displayName: '',
  }),

  getters: {
    isAdmin(state) {
      return state.loggedIn && state.role === 'admin'
    },
  },

  actions: {
    hydrate() {
      if (!canUseStorage()) return
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return

      try {
        const parsed = JSON.parse(raw) as PersistedAuthState
        this.loggedIn = Boolean(parsed.loggedIn)
        this.role = parsed.role === 'admin' ? 'admin' : 'guest'
        this.displayName = typeof parsed.displayName === 'string' ? parsed.displayName : ''
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    },

    persist() {
      if (!canUseStorage()) return
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          loggedIn: this.loggedIn,
          role: this.role,
          displayName: this.displayName,
        }),
      )
    },

    login(payload: { username: string; password: string }) {
      // 第一版先做轻量登录页，不引入后端鉴权。
      // 管理员账号用于支撑审核页演示，后续再替换成真实登录体系。
      const username = payload.username.trim()
      const password = payload.password.trim()

      if (username !== 'admin' || password !== 'admin123') {
        const err = new Error('用户名或密码错误')
        err.name = 'AUTH_INVALID'
        throw err
      }

      this.loggedIn = true
      this.role = 'admin'
      this.displayName = '管理员'
      this.persist()
    },

    logout() {
      this.loggedIn = false
      this.role = 'guest'
      this.displayName = ''
      this.persist()
    },
  },
})
