import axios from 'axios'
import { appConfig } from '@/config/app'

const AUTH_BASE_URL = appConfig.apiBaseUrl

export type AuthUser = {
  id: string
  username: string
  displayName: string
  role: 'user' | 'admin'
  email?: string
  createdAt?: string
}

export type AuthSession = {
  user: AuthUser
  accessToken: string
  expiresInSeconds: number
  expiresAt: string
}

let activeAccessToken = ''

export const setAuthAccessToken = (token: string) => {
  activeAccessToken = token.trim()
}

export const getAuthRequestHeaders = (): Record<string, string> =>
  activeAccessToken ? { Authorization: `Bearer ${activeAccessToken}` } : {}

export const sendRegisterCode = async (payload: { email: string; displayName?: string }) => {
  const response = await axios.post<{ message?: string; data?: { expireMinutes: number; resendSeconds: number } }>(
    `${AUTH_BASE_URL}/auth/send-register-code`,
    payload,
  )
  return response.data
}

export const loginByPassword = async (payload: { account: string; password: string }) => {
  const response = await axios.post<{ data: AuthSession }>(`${AUTH_BASE_URL}/auth/login`, payload)
  return response.data.data
}

export const registerUserAccount = async (payload: {
  displayName: string
  email: string
  verifyCode: string
  password: string
  confirmPassword: string
}) => {
  const response = await axios.post<{ data: AuthUser; message?: string }>(`${AUTH_BASE_URL}/auth/register`, payload)
  return response.data.data
}
