import '../env-loader.mjs'

import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const rootDir = resolve(import.meta.dirname, '../..')
const lightRagExe = resolve(rootDir, '.venv-lightrag/Scripts/lightrag-server.exe')
const workingDir = resolve(
  rootDir,
  process.env.LIGHTRAG_WORKING_DIR || 'rag_storage/student-handbook',
)
const inputDir = resolve(rootDir, process.env.LIGHTRAG_INPUT_DIR || 'rag_storage/student-handbook/inputs')

const requireValue = (name, value) => {
  if (!String(value || '').trim()) {
    throw new Error(`${name} is required in server/.env`)
  }
  return String(value).trim()
}

const env = {
  ...process.env,
  HOST: process.env.LIGHTRAG_HOST || '127.0.0.1',
  PORT: process.env.LIGHTRAG_PORT || '9621',
  WORKING_DIR: workingDir,
  INPUT_DIR: inputDir,
  PYTHONUTF8: '1',
  PYTHONIOENCODING: 'utf-8',
  LLM_BINDING: process.env.LIGHTRAG_LLM_BINDING || 'openai',
  LLM_BINDING_HOST: requireValue(
    'LIGHTRAG_LLM_BINDING_HOST or LLM_API_BASE_URL',
    process.env.LIGHTRAG_LLM_BINDING_HOST || process.env.LLM_API_BASE_URL,
  ),
  LLM_BINDING_API_KEY: requireValue(
    'LIGHTRAG_LLM_BINDING_API_KEY or LLM_API_KEY',
    process.env.LIGHTRAG_LLM_BINDING_API_KEY || process.env.LLM_API_KEY,
  ),
  LLM_MODEL: requireValue(
    'LIGHTRAG_LLM_MODEL or LLM_MODEL',
    process.env.LIGHTRAG_LLM_MODEL || process.env.LLM_MODEL,
  ),
  EMBEDDING_BINDING: process.env.LIGHTRAG_EMBEDDING_BINDING || 'openai',
  EMBEDDING_BINDING_HOST: requireValue(
    'LIGHTRAG_EMBEDDING_BINDING_HOST or VECTOR_EMBEDDING_API_BASE_URL',
    process.env.LIGHTRAG_EMBEDDING_BINDING_HOST || process.env.VECTOR_EMBEDDING_API_BASE_URL,
  ),
  EMBEDDING_BINDING_API_KEY: requireValue(
    'LIGHTRAG_EMBEDDING_BINDING_API_KEY or VECTOR_EMBEDDING_API_KEY',
    process.env.LIGHTRAG_EMBEDDING_BINDING_API_KEY || process.env.VECTOR_EMBEDDING_API_KEY,
  ),
  EMBEDDING_MODEL: requireValue(
    'LIGHTRAG_EMBEDDING_MODEL or VECTOR_EMBEDDING_MODEL',
    process.env.LIGHTRAG_EMBEDDING_MODEL || process.env.VECTOR_EMBEDDING_MODEL,
  ),
  EMBEDDING_DIM: process.env.LIGHTRAG_EMBEDDING_DIM || process.env.VECTOR_EMBEDDING_DIM || '1024',
}

if (!existsSync(lightRagExe)) {
  throw new Error(`LightRAG executable not found: ${lightRagExe}`)
}

mkdirSync(workingDir, { recursive: true })
mkdirSync(inputDir, { recursive: true })
mkdirSync(dirname(resolve(rootDir, 'server/logs/lightrag-server.log')), { recursive: true })

const args = [
  '--host',
  env.HOST,
  '--port',
  env.PORT,
  '--working-dir',
  workingDir,
  '--input-dir',
  inputDir,
  '--llm-binding',
  env.LLM_BINDING,
  '--embedding-binding',
  env.EMBEDDING_BINDING,
  '--log-level',
  process.env.LIGHTRAG_LOG_LEVEL || 'INFO',
]

console.log(`[lightrag:start] using config from ${resolve(rootDir, 'server/.env')}`)
console.log(`[lightrag:start] webui http://${env.HOST}:${env.PORT}`)
console.log(`[lightrag:start] working-dir ${workingDir}`)

const child = spawn(lightRagExe, args, {
  cwd: workingDir,
  env,
  stdio: 'inherit',
  windowsHide: false,
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.log(`[lightrag:start] stopped by ${signal}`)
    return
  }
  process.exitCode = code ?? 0
})
