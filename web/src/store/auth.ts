import { setAuthToken } from '@/auth/token'
import { defineStore } from 'pinia'
import {
  changePassword as changePasswordApi,
  loginByPassword,
  registerUserAccount,
  type AuthUser,
} from '@/api/auth'

type AuthRole = 'guest' | 'user' | 'admin'

type PersistedAuthState = {
  loggedIn?: boolean
  role?: AuthRole
  displayName?: string
  username?: string
  userId?: string
  email?: string
  token?: string
  mustChangePassword?: boolean
}

const AUTH_STORAGE_KEY = 'ai-campus-agent.auth.v5'
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
    token: '',
    mustChangePassword: false,
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
        this.token = typeof parsed.token === 'string' ? parsed.token : ''
        this.mustChangePassword = Boolean(parsed.mustChangePassword)

        // 无 token 的旧登录态（v4 升级）或游客态一律清空，要求重新登录。
        if (!this.loggedIn || this.role === 'guest' || !this.token) {
          this.resetAuthState()
          return
        }
        setAuthToken(this.token)
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
          token: this.token,
          mustChangePassword: this.mustChangePassword,
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
      this.token = ''
      this.mustChangePassword = false
      setAuthToken('')
    },

    enterGuestUser() {
      this.loggedIn = true
      this.role = 'user'
      this.displayName = '学生用户'
      this.username = 'student.preview'
      this.userId = 'guest-preview'
      this.email = ''
    },

    applyUser(user: AuthUser, token: string) {
      this.loggedIn = true
      this.role = user.role === 'admin' ? 'admin' : 'user'
      this.displayName = user.displayName
      this.username = user.username
      this.userId = user.id
      this.email = user.email || ''
      this.token = token
      this.mustChangePassword = user.mustChangePassword === true
      setAuthToken(token)
      this.persist()
    },

    async login(payload: { account: string; password: string }) {
      const session = await loginByPassword(payload)
      this.applyUser(session.user, session.token)
      return this.role === 'admin' ? 'admin' : 'user'
    },

    async register(payload: {
      displayName: string
      email: string
      verifyCode: string
      password: string
      confirmPassword: string
    }) {
      const session = await registerUserAccount(payload)
      this.applyUser(session.user, session.token)
      return this.role === 'admin' ? 'admin' : 'user'
    },

    async changePassword(payload: { oldPassword: string; newPassword: string }) {
      await changePasswordApi(payload)
      this.mustChangePassword = false
      this.persist()
    },

    logout() {
      this.resetAuthState()
      this.persist()
    },
  },
})
