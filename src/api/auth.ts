import axios from 'axios'

const AUTH_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  role: 'user' | 'admin'
  email?: string
  createdAt?: string
}

export const sendRegisterCode = async (payload: { email: string; displayName?: string }) => {
  const response = await axios.post<{ message?: string; data?: { expireMinutes: number; resendSeconds: number } }>(
    `${AUTH_BASE_URL}/auth/send-register-code`,
    payload,
  )
  return response.data
}

export const loginByPassword = async (payload: { account: string; password: string }) => {
  const response = await axios.post<{ data: AuthUser }>(`${AUTH_BASE_URL}/auth/login`, payload)
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
