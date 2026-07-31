import axios, { type AxiosError } from 'axios'
import { getAuthToken } from '@/auth/token'
import { appConfig } from '@/config/app'

// 统一 axios 实例：所有后端请求都经它发出，自动携带 JWT。
export const http = axios.create({
  baseURL: appConfig.apiBaseUrl,
})

http.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 = token 缺失/过期/无效：派发事件，由 App.vue 统一登出回登录页。
// 这里不反向依赖 auth store，避免循环引用。
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(error)
  },
)
