import { defineStore } from 'pinia'
import {
  loginByPassword,
  registerUserAccount,
  setAuthAccessToken,
  type AuthSession,
} from '@/api/auth'

type AuthRole = 'guest' | 'user' | 'admin'

type PersistedAuthState = {
  loggedIn?: boolean
  role?: AuthRole
  displayName?: string
  username?: string
  userId?: string
  email?: string
  accessToken?: string
  expiresAt?: string
}

const AUTH_STORAGE_KEY = 'ai-campus-agent.auth.v4'
const getLocalStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

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
    accessToken: '',
    expiresAt: '',
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
      const storage = getLocalStorage()
      if (!storage) return

      try {
        const raw = storage.getItem(AUTH_STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw) as PersistedAuthState
        this.loggedIn = Boolean(parsed.loggedIn)
        this.role = normalizeRole(parsed.role)
        this.displayName = typeof parsed.displayName === 'string' ? parsed.displayName : ''
        this.username = typeof parsed.username === 'string' ? parsed.username : ''
        this.userId = typeof parsed.userId === 'string' ? parsed.userId : ''
        this.email = typeof parsed.email === 'string' ? parsed.email : ''
        this.accessToken = typeof parsed.accessToken === 'string' ? parsed.accessToken : ''
        this.expiresAt = typeof parsed.expiresAt === 'string' ? parsed.expiresAt : ''

        const expired = !this.expiresAt || new Date(this.expiresAt).getTime() <= Date.now()
        if (!this.loggedIn || this.role === 'guest' || !this.accessToken || expired) {
          this.resetAuthState()
        } else {
          setAuthAccessToken(this.accessToken)
        }
      } catch {
        try {
          storage.removeItem(AUTH_STORAGE_KEY)
        } catch {
          // 存储不可写时仅重置内存认证状态。
        }
        this.resetAuthState()
      }
    },

    persist() {
      const storage = getLocalStorage()
      if (!storage) return
      try {
        storage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify({
            loggedIn: this.loggedIn,
            role: this.role,
            displayName: this.displayName,
            username: this.username,
            userId: this.userId,
            email: this.email,
            accessToken: this.accessToken,
            expiresAt: this.expiresAt,
          }),
        )
      } catch {
        // 无痕或禁用存储时，当前标签页内登录仍可继续使用。
      }
    },

    resetAuthState() {
      this.loggedIn = false
      this.role = 'guest'
      this.displayName = ''
      this.username = ''
      this.userId = ''
      this.email = ''
      this.accessToken = ''
      this.expiresAt = ''
      setAuthAccessToken('')
    },

    applySession(session: AuthSession) {
      const user = session.user
      this.loggedIn = true
      this.role = user.role === 'admin' ? 'admin' : 'user'
      this.displayName = user.displayName
      this.username = user.username
      this.userId = user.id
      this.email = user.email || ''
      this.accessToken = session.accessToken
      this.expiresAt = session.expiresAt
      setAuthAccessToken(session.accessToken)
      this.persist()
    },

    async login(payload: { account: string; password: string }) {
      const session = await loginByPassword(payload)
      this.applySession(session)
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
