import { appConfig } from '@/config/app'

const AUTH_BASE_URL = appConfig.apiBaseUrl

const post = async <T>(url: string, body: unknown): Promise<T> => {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    let errData: any = null
    try { errData = await resp.json() } catch { /* ignore */ }
    const err: any = new Error(errData?.message || `HTTP ${resp.status}`)
    err.code = errData?.code || 'HTTP_ERROR'
    err.status = resp.status
    throw err
  }
  return resp.json()
}

export type AuthUser = {
  id: string
  username: string
  displayName: string
  role: 'user' | 'admin'
  email?: string
  createdAt?: string
}

export const sendRegisterCode = async (payload: { email: string; displayName?: string }) => {
  return post<{ message?: string; data?: { expireMinutes: number; resendSeconds: number } }>(
    `${AUTH_BASE_URL}/auth/send-register-code`,
    payload,
  )
}

export const loginByPassword = async (payload: { account: string; password: string }) => {
  const result = await post<{ data: AuthUser }>(`${AUTH_BASE_URL}/auth/login`, payload)
  return result.data
}

export const registerUserAccount = async (payload: {
  displayName: string
  email: string
  verifyCode: string
  password: string
  confirmPassword: string
}) => {
  const result = await post<{ data: AuthUser; message?: string }>(`${AUTH_BASE_URL}/auth/register`, payload)
  return result.data
}
