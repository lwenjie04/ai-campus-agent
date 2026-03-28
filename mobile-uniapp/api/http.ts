import { mobileAppConfig } from '../utils/config'

type RequestOptions = {
  method?: 'GET' | 'POST'
  data?: Record<string, any>
}

type ApiEnvelope<T> = {
  code?: number
  message?: string
  data?: T
}

export const request = <T>(url: string, options: RequestOptions = {}) =>
  new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${mobileAppConfig.apiBaseUrl}${url}`,
      method: options.method || 'GET',
      data: options.data,
      success: (response: UniApp.RequestSuccessCallbackResult) => {
        const payload = response.data as ApiEnvelope<T> | T

        if (
          payload &&
          typeof payload === 'object' &&
          'code' in (payload as ApiEnvelope<T>) &&
          (payload as ApiEnvelope<T>).code === 0
        ) {
          resolve(((payload as ApiEnvelope<T>).data || {}) as T)
          return
        }

        if (payload && typeof payload === 'object' && 'data' in (payload as ApiEnvelope<T>)) {
          resolve(((payload as ApiEnvelope<T>).data || {}) as T)
          return
        }

        resolve(payload as T)
      },
      fail: (error) => {
        reject(error)
      },
    })
  })
