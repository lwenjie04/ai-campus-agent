import '../env-loader.mjs'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const requiredFiles = [
  'server/data/knowledge-base.json',
  'public/videos/digital-human/greeting.mp4',
  'public/videos/digital-human/idle.mp4',
  'public/videos/digital-human/teaching.mp4',
  'src/views/AgentChat.vue',
  'src/views/AdminReviewView.vue',
  'server/sql/community-demo-seed.sql',
  'docs/product-brief.md',
  'docs/product-roadmap.md',
  'docs/product-status.md',
  'docs/release-checklist.md',
]

const errors = []
const warnings = []
const strictConfig = process.env.RELEASE_STRICT_CONFIG === 'true'
const configIssue = (message) => (strictConfig ? errors : warnings).push(message)

for (const file of requiredFiles) {
  const fullPath = resolve(process.cwd(), file)
  if (!existsSync(fullPath)) {
    errors.push(`missing required file: ${file}`)
    continue
  }
  if (statSync(fullPath).size === 0) errors.push(`required file is empty: ${file}`)
}

const llmKey = String(process.env.LLM_API_KEY || '').trim()
const llmProviderMode = process.env.LLM_PROVIDER_MODE === 'mock' ? 'mock' : 'deepseek'
if (llmProviderMode === 'mock') {
  configIssue('LLM_PROVIDER_MODE=mock; this is suitable for automated journeys only, not a live-service release')
} else if (!llmKey || /your_|replace|example/i.test(llmKey)) {
  errors.push('LLM_API_KEY is missing or still uses a placeholder')
}

const adminPassword = String(process.env.AUTH_DEFAULT_ADMIN_PASSWORD || '').trim()
if (!adminPassword) {
  configIssue('AUTH_DEFAULT_ADMIN_PASSWORD is not set; server startup policy must provide a secure initialization path')
} else if (adminPassword === 'admin123' || adminPassword.length < 10) {
  errors.push('AUTH_DEFAULT_ADMIN_PASSWORD is still weak; set a production-only strong password')
}

const sessionSecret = String(process.env.AUTH_SESSION_SECRET || '').trim()
if (sessionSecret.length < 32) {
  configIssue('AUTH_SESSION_SECRET is missing or shorter than 32 characters; sessions will not survive a restart safely')
}

const guestCookieSecret = String(process.env.GUEST_COOKIE_SECRET || '').trim()
if (guestCookieSecret.length < 32) {
  configIssue('GUEST_COOKIE_SECRET is missing or shorter than 32 characters; set a stable production secret')
}

if (!process.env.MYSQL_PASSWORD) {
  configIssue('MYSQL_PASSWORD is not set; community may fall back to in-memory demo data')
}

if (!existsSync(resolve(process.cwd(), 'server/data/chunked-knowledge-base.json'))) {
  configIssue('chunked knowledge base is missing; keyword retrieval remains the stable fallback')
}

if (!existsSync(resolve(process.cwd(), 'server/data/vector-index.json'))) {
  configIssue('vector index is missing; vector retrieval is not release-ready yet')
}

for (const warning of warnings) console.warn(`[release-assets] WARN ${warning}`)
for (const error of errors) console.error(`[release-assets] FAIL ${error}`)

if (errors.length > 0) {
  process.exitCode = 1
} else {
  console.log(`[release-assets] PASS ${requiredFiles.length} required files, ${warnings.length} warnings`)
}
