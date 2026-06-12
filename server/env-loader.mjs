import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const loadEnvFile = (filePath) => {
  if (!existsSync(filePath)) return

  const text = readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eqIndex = line.indexOf('=')
    if (eqIndex <= 0) continue

    const key = line.slice(0, eqIndex).trim()
    let value = line.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), 'server/.env'))
loadEnvFile(resolve(process.cwd(), '.env.server'))
