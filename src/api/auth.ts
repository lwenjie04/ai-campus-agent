import axios from 'axios'
import { apiUrl } from '@/config/app'

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
    apiUrl('/auth/send-register-code'),
    payload,
  )
  return response.data
}

export const loginByPassword = async (payload: { account: string; password: string }) => {
  const response = await axios.post<{ data: AuthSession }>(apiUrl('/auth/login'), payload)
  return response.data.data
}

export const registerUserAccount = async (payload: {
  displayName: string
  email: string
  verifyCode: string
  password: string
  confirmPassword: string
}) => {
  const response = await axios.post<{ data: AuthUser; message?: string }>(apiUrl('/auth/register'), payload)
  return response.data.data
}
