import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const require = createRequire(import.meta.url)
const tencentCloudTtsSdk = require('tencentcloud-sdk-nodejs-tts')

const hasTencentCloudCredentials = Boolean(
  process.env.TENCENTCLOUD_SECRET_ID && process.env.TENCENTCLOUD_SECRET_KEY,
)

// TTS 提供方优先使用腾讯云；如果本地开发机是 Windows 且未配置腾讯云密钥，则保留本地语音引擎兜底。
const TTS_PROVIDER =
  process.env.TTS_PROVIDER || (hasTencentCloudCredentials ? 'tencentcloud' : process.platform === 'win32' ? 'windows_sapi' : 'disabled')
const TTS_AUTH_TOKEN = process.env.TTS_AUTH_TOKEN || ''
const TTS_MAX_TEXT_LENGTH = Number(process.env.TTS_MAX_TEXT_LENGTH || 100000)

// 腾讯云 TTS 配置。默认选广州地域，便于你们后续部署在国内服务器。
const TENCENTCLOUD_SECRET_ID = process.env.TENCENTCLOUD_SECRET_ID || ''
const TENCENTCLOUD_SECRET_KEY = process.env.TENCENTCLOUD_SECRET_KEY || ''
const TENCENTCLOUD_TTS_REGION = process.env.TENCENTCLOUD_TTS_REGION || 'ap-guangzhou'
const TENCENTCLOUD_TTS_VOICE_TYPE = Number(process.env.TENCENTCLOUD_TTS_VOICE_TYPE || 101001)
const TENCENTCLOUD_TTS_SPEED = Number(process.env.TENCENTCLOUD_TTS_SPEED || 0)
const TENCENTCLOUD_TTS_VOLUME = Number(process.env.TENCENTCLOUD_TTS_VOLUME || 0)
const TENCENTCLOUD_TTS_SAMPLE_RATE = Number(process.env.TENCENTCLOUD_TTS_SAMPLE_RATE || 16000)
const TENCENTCLOUD_TTS_CODEC = String(process.env.TENCENTCLOUD_TTS_CODEC || 'wav').toLowerCase()
const TENCENTCLOUD_TTS_PRIMARY_LANGUAGE = Number(process.env.TENCENTCLOUD_TTS_PRIMARY_LANGUAGE || 1)
const TENCENTCLOUD_TTS_PROJECT_ID = Number(process.env.TENCENTCLOUD_TTS_PROJECT_ID || 0)
const TENCENTCLOUD_TTS_MODEL_TYPE = Number(process.env.TENCENTCLOUD_TTS_MODEL_TYPE || 1)
const TENCENTCLOUD_TTS_MODE = String(process.env.TENCENTCLOUD_TTS_MODE || 'auto').toLowerCase()
const TENCENTCLOUD_TTS_LONG_TEXT_THRESHOLD = Number(process.env.TENCENTCLOUD_TTS_LONG_TEXT_THRESHOLD || 220)
const TENCENTCLOUD_TTS_POLL_INTERVAL_MS = Number(process.env.TENCENTCLOUD_TTS_POLL_INTERVAL_MS || 1500)
const TENCENTCLOUD_TTS_POLL_TIMEOUT_MS = Number(process.env.TENCENTCLOUD_TTS_POLL_TIMEOUT_MS || 180000)

// 本地 Windows 语音引擎配置。保留它只是为了你本机开发时更方便，不作为正式部署方案。
const WINDOWS_TTS_SCRIPT = resolve(process.cwd(), 'server/scripts/tts-synthesize.ps1')
const WINDOWS_POWERSHELL =
  process.env.WINDOWS_POWERSHELL_PATH || 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const WINDOWS_TTS_DEFAULT_VOICE = process.env.WINDOWS_TTS_DEFAULT_VOICE || ''
const WINDOWS_TTS_DEFAULT_RATE = Number(process.env.WINDOWS_TTS_DEFAULT_RATE || 0)

const { tts } = tencentCloudTtsSdk
const TencentCloudTtsClient = tts?.v20190823?.Client

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0

const toErrorPayload = (message, code, extra = {}) => ({
  error: {
    code,
    message,
    ...extra,
  },
})

const codecToMimeType = (codec) => {
  if (codec === 'mp3') return 'audio/mpeg'
  if (codec === 'pcm') return 'audio/L16'
  return 'audio/wav'
}

const normalizeCodec = (codec) => {
  const value = String(codec || '').trim().toLowerCase()
  if (value === 'mp3' || value === 'pcm') return value
  return 'wav'
}

const normalizeVoiceType = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  if (!isNonEmptyString(value)) return TENCENTCLOUD_TTS_VOICE_TYPE

  const parsed = Number(String(value).trim())
  return Number.isFinite(parsed) ? Math.trunc(parsed) : TENCENTCLOUD_TTS_VOICE_TYPE
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const createTencentCloudClient = () => {
  if (!TENCENTCLOUD_SECRET_ID || !TENCENTCLOUD_SECRET_KEY) {
    const err = new Error('未配置腾讯云 TTS 密钥，请先填写 TENCENTCLOUD_SECRET_ID 和 TENCENTCLOUD_SECRET_KEY。')
    err.code = 'TENCENTCLOUD_CREDENTIALS_MISSING'
    throw err
  }

  if (!TencentCloudTtsClient) {
    const err = new Error('腾讯云 TTS SDK 未正确加载，请确认 tencentcloud-sdk-nodejs-tts 已安装。')
    err.code = 'TENCENTCLOUD_SDK_MISSING'
    throw err
  }

  return new TencentCloudTtsClient({
    credential: {
      secretId: TENCENTCLOUD_SECRET_ID,
      secretKey: TENCENTCLOUD_SECRET_KEY,
    },
    region: TENCENTCLOUD_TTS_REGION,
    profile: {
      httpProfile: {
        reqMethod: 'POST',
        reqTimeout: 30,
      },
    },
  })
}

const buildTencentCloudTtsPayload = ({ text, voiceName, codec }) => ({
  Text: text,
  SessionId: randomUUID(),
  VoiceType: normalizeVoiceType(voiceName),
  Volume: TENCENTCLOUD_TTS_VOLUME,
  Speed: TENCENTCLOUD_TTS_SPEED,
  ProjectId: TENCENTCLOUD_TTS_PROJECT_ID,
  ModelType: TENCENTCLOUD_TTS_MODEL_TYPE,
  PrimaryLanguage: TENCENTCLOUD_TTS_PRIMARY_LANGUAGE,
  SampleRate: TENCENTCLOUD_TTS_SAMPLE_RATE,
  Codec: codec,
})

const synthesizeWithWindowsSapi = async ({ text, voiceName, rate }) => {
  const outputPath = join(tmpdir(), `ai-campus-tts-${randomUUID()}.wav`)

  try {
    await new Promise((resolvePromise, reject) => {
      const args = [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        WINDOWS_TTS_SCRIPT,
        '-Text',
        text,
        '-OutputPath',
        outputPath,
        '-Rate',
        String(Number.isFinite(rate) ? rate : WINDOWS_TTS_DEFAULT_RATE),
      ]

      if (isNonEmptyString(voiceName)) {
        args.push('-VoiceName', voiceName.trim())
      } else if (isNonEmptyString(WINDOWS_TTS_DEFAULT_VOICE)) {
        args.push('-VoiceName', WINDOWS_TTS_DEFAULT_VOICE.trim())
      }

      const child = spawn(WINDOWS_POWERSHELL, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })

      let stderr = ''
      child.stderr.on('data', (chunk) => {
        stderr += String(chunk || '')
      })

      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) {
          resolvePromise()
          return
        }
        const err = new Error(stderr.trim() || `TTS process exited with code ${code}`)
        err.code = 'TTS_PROCESS_FAILED'
        reject(err)
      })
    })

    return {
      audioBuffer: await readFile(outputPath),
      contentType: 'audio/wav',
      provider: 'windows_sapi',
    }
  } finally {
    await rm(outputPath, { force: true }).catch(() => {})
  }
}

const synthesizeWithTencentCloudShortText = async ({ text, voiceName }) => {
  const codec = normalizeCodec(TENCENTCLOUD_TTS_CODEC)
  const client = createTencentCloudClient()

  const response = await client.TextToVoice(buildTencentCloudTtsPayload({ text, voiceName, codec }))

  if (!response?.Audio) {
    const err = new Error('腾讯云 TTS 未返回音频数据。')
    err.code = 'TENCENTCLOUD_TTS_EMPTY_AUDIO'
    throw err
  }

  return {
    audioBuffer: Buffer.from(response.Audio, 'base64'),
    contentType: codecToMimeType(codec),
    provider: 'tencentcloud-short',
    sessionId: response.SessionId || '',
    requestId: response.RequestId || '',
  }
}

const downloadAudioBuffer = async (url) => {
  const response = await fetch(url)
  if (!response.ok) {
    const err = new Error(`下载腾讯云长文本音频失败：HTTP ${response.status}`)
    err.code = 'TENCENTCLOUD_TTS_DOWNLOAD_FAILED'
    throw err
  }
  return Buffer.from(await response.arrayBuffer())
}

const synthesizeWithTencentCloudLongText = async ({ text, voiceName }) => {
  const codec = normalizeCodec(TENCENTCLOUD_TTS_CODEC)
  const client = createTencentCloudClient()

  const createResp = await client.CreateTtsTask({
    Text: text,
    VoiceType: normalizeVoiceType(voiceName),
    Volume: TENCENTCLOUD_TTS_VOLUME,
    Speed: TENCENTCLOUD_TTS_SPEED,
    ProjectId: TENCENTCLOUD_TTS_PROJECT_ID,
    ModelType: TENCENTCLOUD_TTS_MODEL_TYPE,
    PrimaryLanguage: TENCENTCLOUD_TTS_PRIMARY_LANGUAGE,
    SampleRate: TENCENTCLOUD_TTS_SAMPLE_RATE,
    Codec: codec,
  })

  const taskId = createResp?.Data?.TaskId
  if (!taskId) {
    const err = new Error('腾讯云长文本 TTS 未返回任务 ID。')
    err.code = 'TENCENTCLOUD_TTS_TASK_ID_MISSING'
    throw err
  }

  const deadline = Date.now() + TENCENTCLOUD_TTS_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const statusResp = await client.DescribeTtsTaskStatus({ TaskId: taskId })
    const data = statusResp?.Data
    const status = Number(data?.Status)

    if (status === 2 && data?.ResultUrl) {
      return {
        audioBuffer: await downloadAudioBuffer(data.ResultUrl),
        contentType: codecToMimeType(codec),
        provider: 'tencentcloud-long',
        taskId,
        requestId: statusResp?.RequestId || createResp?.RequestId || '',
      }
    }

    if (status === 3) {
      const err = new Error(data?.ErrorMsg || '腾讯云长文本 TTS 任务失败。')
      err.code = 'TENCENTCLOUD_TTS_TASK_FAILED'
      throw err
    }

    await sleep(TENCENTCLOUD_TTS_POLL_INTERVAL_MS)
  }

  const err = new Error('腾讯云长文本 TTS 等待超时，请稍后重试。')
  err.code = 'TENCENTCLOUD_TTS_TASK_TIMEOUT'
  throw err
}

const synthesizeSpeech = async ({ text, voiceName }) => {
  if (TTS_PROVIDER === 'disabled') {
    const err = new Error('TTS 服务未启用。')
    err.code = 'TTS_DISABLED'
    throw err
  }

  if (TTS_PROVIDER === 'tencentcloud') {
    const shouldUseLongText =
      TENCENTCLOUD_TTS_MODE === 'long' ||
      (TENCENTCLOUD_TTS_MODE === 'auto' && text.length > TENCENTCLOUD_TTS_LONG_TEXT_THRESHOLD)

    return shouldUseLongText
      ? synthesizeWithTencentCloudLongText({ text, voiceName })
      : synthesizeWithTencentCloudShortText({ text, voiceName })
  }

  if (TTS_PROVIDER === 'windows_sapi') {
    if (process.platform !== 'win32') {
      const err = new Error('当前仅 Windows 环境支持本地语音引擎，请改用腾讯云 TTS。')
      err.code = 'TTS_UNSUPPORTED_PLATFORM'
      throw err
    }

    return synthesizeWithWindowsSapi({
      text,
      voiceName,
      rate: WINDOWS_TTS_DEFAULT_RATE,
    })
  }

  const err = new Error(`不支持的 TTS_PROVIDER: ${TTS_PROVIDER}`)
  err.code = 'TTS_PROVIDER_UNSUPPORTED'
  throw err
}

export const handleTtsRoute = async (req, res, tools) => {
  const { json, parseJsonBody, allowOrigin } = tools

  const path = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname.replace(/^\/api/, '')
  if (!(req.method === 'POST' && path === '/tts')) return false

  if (TTS_AUTH_TOKEN) {
    const authorization = String(req.headers.authorization || '')
    if (authorization !== `Bearer ${TTS_AUTH_TOKEN}`) {
      return json(res, 401, toErrorPayload('TTS 鉴权失败。', 'TTS_UNAUTHORIZED'))
    }
  }

  let body = {}
  try {
    body = await parseJsonBody(req)
  } catch (error) {
    const code = error?.message === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : 'INVALID_JSON'
    const message = code === 'BODY_TOO_LARGE' ? '请求体过大。' : '请求体不是有效的 JSON。'
    return json(res, 400, toErrorPayload(message, code))
  }

  const text = String(body.text || '').trim()
  const voiceName = String(body.voiceName || '').trim()

  if (!text) {
    return json(res, 400, toErrorPayload('text 不能为空。', 'TTS_TEXT_REQUIRED'))
  }

  if (text.length > TTS_MAX_TEXT_LENGTH) {
    return json(
      res,
      400,
      toErrorPayload(`文本长度不能超过 ${TTS_MAX_TEXT_LENGTH} 个字符。`, 'TTS_TEXT_TOO_LONG'),
    )
  }

  try {
    const { audioBuffer, contentType, provider, sessionId, requestId, taskId } = await synthesizeSpeech({
      text,
      voiceName,
    })

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'no-store',
      'X-TTS-Provider': provider,
      ...(sessionId ? { 'X-TTS-Session-Id': sessionId } : {}),
      ...(requestId ? { 'X-TTS-Request-Id': requestId } : {}),
      ...(taskId ? { 'X-TTS-Task-Id': taskId } : {}),
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    res.end(audioBuffer)
    return true
  } catch (error) {
    const code = error?.code || 'TTS_FAILED'
    const statusCode =
      code === 'TTS_DISABLED' ||
      code === 'TTS_UNSUPPORTED_PLATFORM' ||
      code === 'TTS_PROVIDER_UNSUPPORTED' ||
      code === 'TENCENTCLOUD_CREDENTIALS_MISSING'
        ? 503
        : 500

    return json(
      res,
      statusCode,
      toErrorPayload(error?.message || '语音合成失败。', code),
    )
  }
}
