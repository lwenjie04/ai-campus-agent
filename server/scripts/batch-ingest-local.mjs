import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const cwd = process.cwd()
const DEFAULT_INPUT_DIRS = ['src/project-text']
const DEFAULT_OUTPUT = 'server/data/knowledge-base.json'

const TEXT_EXTS = new Set(['.txt', '.md', '.markdown', '.json'])

const parseArgs = (argv) => {
  const args = {
    inputs: [],
    out: DEFAULT_OUTPUT,
    dryRun: false,
    replace: false,
    category: '',
    sourceType: '',
    limit: 0,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input' || arg === '-i') {
      args.inputs.push(argv[++i])
      continue
    }
    if (arg === '--out' || arg === '-o') {
      args.out = argv[++i]
      continue
    }
    if (arg === '--dry-run') {
      args.dryRun = true
      continue
    }
    if (arg === '--replace') {
      args.replace = true
      continue
    }
    if (arg === '--category') {
      args.category = argv[++i] || ''
      continue
    }
    if (arg === '--source-type') {
      args.sourceType = argv[++i] || ''
      continue
    }
    if (arg === '--limit') {
      args.limit = Number(argv[++i] || 0) || 0
      continue
    }
    if (!arg.startsWith('-')) {
      args.inputs.push(arg)
    }
  }

  if (args.inputs.length === 0) args.inputs = [...DEFAULT_INPUT_DIRS]
  return args
}

const normalizeText = (text) =>
  String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()

const walkFiles = (dirPath) => {
  const results = []
  if (!existsSync(dirPath)) return results

  const stack = [dirPath]
  while (stack.length > 0) {
    const current = stack.pop()
    const entries = readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = resolve(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile()) {
        results.push(full)
      }
    }
  }
  return results
}

const toDate = (input) => new Date(input).toISOString().slice(0, 10)

const fileExtToSourceType = (ext) => {
  if (ext === '.pdf') return 'official_notice'
  if (ext === '.docx' || ext === '.doc') return 'attachment_guideline'
  if (ext === '.xlsx' || ext === '.xls') return 'attachment_sheet'
  if (ext === '.zip') return 'attachment_index'
  if (TEXT_EXTS.has(ext)) return 'local_text'
  return 'local_file'
}

const guessCategory = (text) => {
  const t = text.toLowerCase()
  if (/奖学金|助学金|资助/.test(text)) return 'scholarship'
  if (/转专业|选课|教务|成绩认定|学分认定|课程/.test(text)) return 'teaching'
  if (/考试|补考|重修/.test(text)) return 'exam'
  if (/图书馆|宿舍|报修|食堂|后勤/.test(text)) return 'life'
  if (/学籍|证明|请假/.test(text)) return 'student_affairs'
  if (/library|dorm|repair|canteen/.test(t)) return 'life'
  return 'general'
}

const guessAuthority = (text) => {
  if (/教务/.test(text)) return '教务相关通知'
  if (/学生工作|资助/.test(text)) return '学生工作/资助相关通知'
  if (/图书馆/.test(text)) return '图书馆'
  if (/后勤|宿舍|报修|食堂/.test(text)) return '后勤服务'
  return '本地批量入库'
}

const buildKeywords = (baseText, category) => {
  const seeds = new Set()
  const raw = String(baseText || '')

  const commonPhrases = [
    '竞赛奖学金',
    '国家奖学金',
    '国家励志奖学金',
    '奖学金',
    '助学金',
    '资助',
    '转专业',
    '补退选',
    '成绩认定',
    '学分认定',
    '教务',
    '选课',
    '课表',
    '考试',
    '补考',
    '重修',
    '图书馆',
    '宿舍',
    '报修',
    '食堂',
  ]
  for (const p of commonPhrases) {
    if (raw.includes(p)) seeds.add(p)
  }

  raw
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff]+/gu, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && x.length <= 20)
    .slice(0, 20)
    .forEach((x) => seeds.add(x))

  if (category) seeds.add(category)

  return Array.from(seeds).slice(0, 12)
}

const slugify = (text) => {
  const ascii = text
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')

  if (ascii) return ascii
  return createHash('md5').update(text).digest('hex').slice(0, 8)
}

const makeEntryId = (fileName, relPath) => {
  const base = fileName.replace(/\.[^.]+$/, '')
  const hash = createHash('md5').update(relPath).digest('hex').slice(0, 6)
  return `${slugify(base)}-${hash}`
}

const tryReadTextContent = (absPath, ext) => {
  if (!TEXT_EXTS.has(ext)) return ''

  try {
    const raw = readFileSync(absPath, 'utf8')
    if (ext === '.json') {
      const obj = JSON.parse(raw)
      return normalizeText(typeof obj === 'string' ? obj : JSON.stringify(obj))
    }
    return normalizeText(raw)
  } catch {
    return ''
  }
}

const buildContentDraft = ({ fileName, ext, fileSize, textContent }) => {
  if (textContent) return textContent.slice(0, 4000)

  const sizeKb = Math.max(1, Math.round(fileSize / 1024))
  if (ext === '.zip') {
    return `本地批量入库：已发现压缩包文件“${fileName}”（约 ${sizeKb} KB）。建议后续解压并补充其中通知正文/附件清单的结构化内容。`
  }
  if (ext === '.pdf') {
    return `本地批量入库：已发现 PDF 通知文件“${fileName}”（约 ${sizeKb} KB）。建议后续提取正文并补充时间节点、办理流程、联系方式等信息。`
  }
  if (ext === '.docx' || ext === '.doc') {
    return `本地批量入库：已发现 Word 文件“${fileName}”（约 ${sizeKb} KB）。当前仅记录文件条目与下载路径，建议后续提取正文内容。`
  }
  if (ext === '.xlsx' || ext === '.xls') {
    return `本地批量入库：已发现表格附件“${fileName}”（约 ${sizeKb} KB）。当前作为附件条目入库，建议结合对应通知正文使用。`
  }
  return `本地批量入库：已记录文件“${fileName}”（约 ${sizeKb} KB），当前未提取正文内容。`
}

const loadExistingKb = (kbPath) => {
  if (!existsSync(kbPath)) return []
  try {
    const text = readFileSync(kbPath, 'utf8')
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const inputDirs = args.inputs.map((p) => resolve(cwd, p))
  const outPath = resolve(cwd, args.out)

  const allFiles = inputDirs.flatMap((dir) => walkFiles(dir))
  const filteredFiles = allFiles.filter((p) => !/[/\\]\.(git|idea|vscode)([/\\]|$)/i.test(p))
  const limitedFiles = args.limit > 0 ? filteredFiles.slice(0, args.limit) : filteredFiles

  const existing = loadExistingKb(outPath)
  const existingByDownloadPath = new Map(
    existing.filter((x) => x?.downloadPath).map((x) => [String(x.downloadPath), x]),
  )
  const existingById = new Map(existing.filter((x) => x?.id).map((x) => [String(x.id), x]))

  const created = []
  const updated = []

  for (const absPath of limitedFiles) {
    const st = statSync(absPath)
    const relPath = relative(cwd, absPath).replace(/\\/g, '/')
    const fileName = absPath.split(/[/\\]/).pop() || relPath
    const ext = extname(fileName).toLowerCase()
    const title = fileName.replace(/\.[^.]+$/, '')
    const category = args.category || guessCategory(title)
    const sourceType = args.sourceType || fileExtToSourceType(ext)
    const authority = guessAuthority(title)
    const textContent = tryReadTextContent(absPath, ext)
    const content = buildContentDraft({
      fileName,
      ext,
      fileSize: st.size,
      textContent,
    })
    const id = makeEntryId(fileName, relPath)

    const next = {
      id,
      title,
      category,
      sourceType,
      authority,
      updatedAt: toDate(st.mtimeMs),
      keywords: buildKeywords(title, category),
      url: '',
      content,
      downloadPath: relPath,
      downloadName: fileName,
    }

    const existingSamePath = existingByDownloadPath.get(relPath)
    if (existingSamePath) {
      if (args.replace) {
        Object.assign(existingSamePath, next, { id: existingSamePath.id || next.id })
        updated.push({ id: existingSamePath.id, title: existingSamePath.title, downloadPath: relPath })
      }
      continue
    }

    if (existingById.has(id)) {
      if (args.replace) {
        Object.assign(existingById.get(id), next)
        updated.push({ id, title, downloadPath: relPath })
      }
      continue
    }

    existing.push(next)
    created.push({ id, title, category, sourceType, downloadPath: relPath })
  }

  if (!args.dryRun) {
    existing.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8')
  }

  const report = {
    inputs: args.inputs,
    out: args.out,
    dryRun: args.dryRun,
    scannedFiles: limitedFiles.length,
    created: created.length,
    updated: updated.length,
    skipped: limitedFiles.length - created.length - updated.length,
    sampleCreated: created.slice(0, 10),
    sampleUpdated: updated.slice(0, 10),
  }

  console.log(JSON.stringify(report, null, 2))
}

main()

