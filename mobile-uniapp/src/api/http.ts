import { mobileAppConfig } from '@/utils/config'

type RequestOptions = {
  method?: 'GET' | 'POST'
  data?: Record<string, any>
}

type ApiEnvelope<T> = {
  code: number
  message: string
  data: T
}

export const request = <T>(path: string, options: RequestOptions = {}) =>
  new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${mobileAppConfig.apiBaseUrl}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
      },
      success: (response: UniApp.RequestSuccessCallbackResult) => {
        const payload = response.data as ApiEnvelope<T> | undefined
        if (payload && payload.code === 0) {
          resolve(payload.data)
          return
        }
        reject(new Error(payload?.message || `HTTP ${response.statusCode}`))
      },
      fail: (error: any) => {
        reject(error)
      },
    })
  })
