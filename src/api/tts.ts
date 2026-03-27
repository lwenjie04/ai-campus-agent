import { appConfig } from '@/config/app'

// 发给后端 TTS 接口的最小请求结构。
type TtsRequest = {
  text: string
  voiceName?: string
}

// 请求后端合成语音，成功后返回一个音频 Blob。
// 调用方通常会把它转成 ObjectURL，再交给 Audio 播放。
export const requestBackendTts = async ({ text, voiceName }: TtsRequest): Promise<Blob> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  // 如果前端配置了鉴权 token，就把它带给后端用于权限校验。
  if (appConfig.ttsAuthToken) {
    headers.Authorization = `Bearer ${appConfig.ttsAuthToken}`
  }

  // 这里走的是普通 POST 请求，因为 TTS 返回的是完整音频文件，不需要流式解析。
  const resp = await fetch(`${appConfig.apiBaseUrl}/tts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      voiceName,
    }),
  })

  if (!resp.ok) {
    let message = `TTS HTTP ${resp.status}`
    try {
      // 尽量读取后端返回的结构化错误，便于在前端展示更清晰的失败原因。
      const data = await resp.json()
      message = data?.error?.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  return resp.blob()
}
