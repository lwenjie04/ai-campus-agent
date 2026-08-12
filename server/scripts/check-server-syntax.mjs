import { readdirSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const serverRoot = resolve(process.cwd(), 'server')

const collectModules = (directory) => {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...collectModules(fullPath))
    else if (entry.isFile() && extname(entry.name) === '.mjs') files.push(fullPath)
  }
  return files
}

const modules = collectModules(serverRoot)
const failures = []

for (const filePath of modules) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    failures.push({
      file: relative(process.cwd(), filePath),
      message: String(result.stderr || result.stdout || '').trim(),
    })
  }
}

if (failures.length > 0) {
  console.error(`[server-syntax] FAIL ${failures.length}/${modules.length}`)
  for (const failure of failures) {
    console.error(`- ${failure.file}`)
    if (failure.message) console.error(failure.message)
  }
  process.exitCode = 1
} else {
  console.log(`[server-syntax] PASS ${modules.length} modules`)
}
