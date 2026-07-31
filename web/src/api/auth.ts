import { setAuthToken } from '@/auth/token'
import { http } from '@/api/http'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  role: 'user' | 'admin'
  email?: string
  mustChangePassword?: boolean
  createdAt?: string
}

export type AuthSession = {
  token: string
  user: AuthUser
}

const applySession = (session: AuthSession) => {
  setAuthToken(session.token)
  return session
}

export const sendRegisterCode = async (payload: { email: string; displayName?: string }) => {
  const response = await http.post<{ message?: string; data?: { expireMinutes: number; resendSeconds: number } }>(
    '/auth/send-register-code',
    payload,
  )
  return response.data
}

export const loginByPassword = async (payload: { account: string; password: string }): Promise<AuthSession> => {
  const response = await http.post<{ data: AuthSession }>('/auth/login', payload)
  return applySession(response.data.data)
}

export const registerUserAccount = async (payload: {
  displayName: string
  email: string
  verifyCode: string
  password: string
  confirmPassword: string
}): Promise<AuthSession> => {
  const response = await http.post<{ data: AuthSession; message?: string }>('/auth/register', payload)
  return applySession(response.data.data)
}

export const changePassword = async (payload: { oldPassword: string; newPassword: string }) => {
  const response = await http.post<{ message?: string }>('/auth/change-password', payload)
  return response.data
}
