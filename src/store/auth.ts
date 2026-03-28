import { defineStore } from 'pinia'
import { loginByPassword, registerUserAccount, type AuthUser } from '@/api/auth'

type AuthRole = 'guest' | 'user' | 'admin'

type PersistedAuthState = {
  loggedIn?: boolean
  role?: AuthRole
  displayName?: string
  username?: string
  userId?: string
  email?: string
}

const AUTH_STORAGE_KEY = 'ai-campus-agent.auth.v4'
const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage

const normalizeRole = (role: unknown): AuthRole => {
  if (role === 'admin') return 'admin'
  if (role === 'user') return 'user'
  return 'guest'
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    loggedIn: false,
    role: 'guest' as AuthRole,
    displayName: '',
    username: '',
    userId: '',
    email: '',
  }),

  getters: {
    isAdmin(state) {
      return state.loggedIn && state.role === 'admin'
    },
    isUser(state) {
      return state.loggedIn && state.role === 'user'
    },
  },

  actions: {
    hydrate() {
      if (!canUseStorage()) return
      const raw = localStorage.getItem(AUTH_STORAGE_KEY)
      if (!raw) return

      try {
        const parsed = JSON.parse(raw) as PersistedAuthState
        this.loggedIn = Boolean(parsed.loggedIn)
        this.role = normalizeRole(parsed.role)
        this.displayName = typeof parsed.displayName === 'string' ? parsed.displayName : ''
        this.username = typeof parsed.username === 'string' ? parsed.username : ''
        this.userId = typeof parsed.userId === 'string' ? parsed.userId : ''
        this.email = typeof parsed.email === 'string' ? parsed.email : ''

        if (!this.loggedIn || this.role === 'guest') {
          this.resetAuthState()
        }
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY)
        this.resetAuthState()
      }
    },

    persist() {
      if (!canUseStorage()) return
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          loggedIn: this.loggedIn,
          role: this.role,
          displayName: this.displayName,
          username: this.username,
          userId: this.userId,
          email: this.email,
        }),
      )
    },

    resetAuthState() {
      this.loggedIn = false
      this.role = 'guest'
      this.displayName = ''
      this.username = ''
      this.userId = ''
      this.email = ''
    },

    applyUser(user: AuthUser) {
      this.loggedIn = true
      this.role = user.role === 'admin' ? 'admin' : 'user'
      this.displayName = user.displayName
      this.username = user.username
      this.userId = user.id
      this.email = user.email || ''
      this.persist()
    },

    async login(payload: { account: string; password: string }) {
      const user = await loginByPassword(payload)
      this.applyUser(user)
      return this.role === 'admin' ? 'admin' : 'user'
    },

    async register(payload: {
      displayName: string
      email: string
      verifyCode: string
      password: string
      confirmPassword: string
    }) {
      return registerUserAccount(payload)
    },

    logout() {
      this.resetAuthState()
      this.persist()
    },
  },
})
