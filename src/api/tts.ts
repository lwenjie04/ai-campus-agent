import { appConfig } from '@/config/app'

type TtsRequest = {
  text: string
  voiceName?: string
}

export const requestBackendTts = async ({ text, voiceName }: TtsRequest): Promise<Blob> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (appConfig.ttsAuthToken) {
    headers.Authorization = `Bearer ${appConfig.ttsAuthToken}`
  }

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
      const data = await resp.json()
      message = data?.error?.message || message
    } catch {
      // ignore
    }
    throw new Error(message)
  }

  return resp.blob()
}
