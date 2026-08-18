import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const cwd = process.cwd()

const DEFAULT_INPUT_DIR = '_ingest/student-handbook'
const DEFAULT_OUTPUT = 'server/data/student-handbook.json'

const COVER_ARTIFACT_RE = /^(?:为|进|人|德|表|业|目\s*录)$/
const PAGE_ARTIFACT_RE = /^2025年学生手册.*(?:\d+\/304|\d+\s*\/\s*304)$/
const PAGE_NUMBER_RE = /^\d+(?:\/304)?$/
const PART_RE = /^第[一二三四五六七八九十]+部分\s+.+$/
const TITLE_SUFFIX_RE = /(办法|规定|条例|章程|规则|细则|指引|制度|规范|准则|选编)(?:[（(].*[）)])?$/
const TITLE_EXACT = new Set([
  '普通高等学校学生管理规定(中华人民共和国教育部第41号)',
  '高等学校学生行为准则',
  '学校结核病防控工作规范(2017版)',
])
const TITLE_REPLACEMENTS = new Map([
  ['管理规定(2018年修订)', '广东第二师范学院普通本科生转专业管理规定(2018年修订)'],
  ['实施办法(试行)', '广东第二师范学院学生竞赛奖励实施办法(试行)'],
  ['测评办法(试行)', '广东第二师范学院学生综合素质测评办法(试行)'],
  ['处理办法(试行)', '广东第二师范学院学生违规违纪处理办法(试行)'],
  ['认定办法(试行)', '广东第二师范学院家庭经济困难学生认定办法(试行)'],
  ['奖学金管理办法(试行)', '广东第二师范学院优秀学生海外研学奖学金管理办法(试行)'],
])

const parseArgs = (argv) => {
  const args = {
    input: DEFAULT_INPUT_DIR,
    output: DEFAULT_OUTPUT,
    docx: '',
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--input' || arg === '-i') args.input = argv[++i] || args.input
    else if (arg === '--output' || arg === '-o') args.output = argv[++i] || args.output
    else if (arg === '--docx') args.docx = argv[++i] || args.docx
    else if (arg === '--dry-run') args.dryRun = true
  }

  return args
}

const collapseChineseSpacing = (text) =>
  String(text || '')
    .replace(/(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '')
    .replace(/(?<=[\u4e00-\u9fff])\s+(?=[（(])/g, '')
    .replace(/(?<=[）)])\s+(?=[\u4e00-\u9fff])/g, '')

const normalizeLine = (value) =>
  collapseChineseSpacing(
    String(value || '')
      .replaceAll('\u0000', '')
      .replace(/\s+/g, ' ')
      .trim(),
  )

const findDocxFile = (input, explicitDocx) => {
  if (explicitDocx) {
    const full = resolve(cwd, explicitDocx)
    if (!existsSync(full)) throw new Error(`DOCX_NOT_FOUND:${explicitDocx}`)
    return full
  }

  const inputPath = resolve(cwd, input)
  if (!existsSync(inputPath)) throw new Error(`INPUT_DIR_NOT_FOUND:${input}`)

  const docxFiles = readdirSync(inputPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.docx$/i.test(entry.name))
    .map((entry) => resolve(inputPath, entry.name))
    .sort()

  if (docxFiles.length === 0) throw new Error(`DOCX_NOT_FOUND_IN_DIR:${input}`)
  return docxFiles[0]
}

const extractParagraphs = (docxPath) => {
  const helperPath = resolve(cwd, 'server/scripts/extract-docx-paragraphs.ps1')
  const command = process.platform === 'win32' ? 'powershell' : 'pwsh'
  const result = spawnSync(
    command,
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      helperPath,
      '-InputPath',
      docxPath,
    ],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16,
    },
  )

  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || 'DOCX_EXTRACT_FAILED')
  }

  const payload = JSON.parse(result.stdout || '{}')
  return Array.isArray(payload.paragraphs) ? payload.paragraphs.map(normalizeLine).filter(Boolean) : []
}

const isArtifactLine = (line) => {
  if (!line) return true
  if (COVER_ARTIFACT_RE.test(line)) return true
  if (PAGE_ARTIFACT_RE.test(line)) return true
  if (PAGE_NUMBER_RE.test(line)) return true
  if (/^\d+\.\s*$/.test(line)) return true
  return false
}

const detectBodyStartIndex = (lines) => {
  const partIndexes = []
  lines.forEach((line, index) => {
    if (line === '第一部分 学校规章制度选编') partIndexes.push(index)
  })

  if (partIndexes.length >= 2) return partIndexes[1]
  if (partIndexes.length === 1) return partIndexes[0]
  return 0
}

const extractTocTitles = (paragraphs) => {
  const tocIndex = paragraphs.findIndex((line) => line === '目 录')
  const bodyStart = detectBodyStartIndex(paragraphs)
  if (tocIndex < 0 || bodyStart <= tocIndex) return []

  const lines = paragraphs
    .slice(tocIndex + 1, bodyStart)
    .map(normalizeLine)
    .filter((line) => !isArtifactLine(line))

  const titles = []
  let pending = ''

  const flushPending = () => {
    const cleaned = normalizeLine(pending)
      .replace(/^\d+[.、]\s*/, '')
      .replace(/\s*\d+\s*$/, '')
      .trim()
    if (cleaned) titles.push(cleaned)
    pending = ''
  }

  for (const line of lines) {
    if (PART_RE.test(line)) continue

    if (/^\d+[.、]/.test(line)) {
      if (pending) flushPending()
      pending = line.replace(/^\d+[.、]\s*/, '').replace(/\s+\d+\s*$/, '').trim()
      if (/\d+\s*$/.test(line) && !TITLE_SUFFIX_RE.test(pending)) {
        flushPending()
      }
      continue
    }

    if (PAGE_NUMBER_RE.test(line)) {
      if (pending) flushPending()
      continue
    }

    if (!pending) {
      pending = line.replace(/\s+\d+\s*$/, '').trim()
      if (/\s+\d+\s*$/.test(line)) flushPending()
      continue
    }

    pending = `${pending}${line}`.replace(/\s+\d+\s*$/, '').trim()
    if (/\s+\d+\s*$/.test(line)) flushPending()
  }

  if (pending) flushPending()
  return titles
}

const isTitleLine = (line) => {
  if (!line) return false
  if (PART_RE.test(line)) return false
  if (/^第[一二三四五六七八九十百千万0-9]+条/.test(line)) return false
  if (/^[（(]?[一二三四五六七八九十0-9]+[)）]/.test(line)) return false
  if (TITLE_EXACT.has(line)) return true
  if (line.length > 56) return false
  return TITLE_SUFFIX_RE.test(line)
}

const shouldMergeTitleLine = (current, nextTitleLine) => {
  if (!current?.title) return false
  if (current.lines.length > 0) return false

  const currentTitle = normalizeLine(current.title)
  const nextLine = normalizeLine(nextTitleLine)
  if (!nextLine) return false

  const currentLooksComplete = TITLE_SUFFIX_RE.test(currentTitle) || TITLE_EXACT.has(currentTitle)
  if (!currentLooksComplete) return true

  if (currentTitle.length <= 28 && nextLine.length <= 24) return true
  return false
}

const compactTitle = (title) =>
  title
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .trim()

const finalizeEntry = (entries, current, fileMeta) => {
  if (!current?.title) return

  const content = current.lines
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .join('\n')
    .trim()

  if (content.length < 60) return

  const title = normalizeLine(current.title)
  const compact = compactTitle(title)
  const hash = createHash('md5').update(`${compact}|${current.part}`).digest('hex').slice(0, 8)
  const lower = compact.toLowerCase()

  let category = 'general'
  if (/奖学金|助学金|资助|困难补助|勤工助学/.test(compact)) category = 'scholarship'
  else if (/学籍|转专业|成绩|学分|选修课|学位|考试|考勤|请假|学业预警/.test(compact)) category = 'teaching'
  else if (/违规|违纪|处分|申诉/.test(compact)) category = 'student_affairs'
  else if (/宿舍|医疗保险|就医|传染病|结核病|图书馆/.test(compact)) category = 'life'
  else if (/行为准则/.test(compact)) category = 'student_affairs'
  else if (lower.includes('就业')) category = 'career'

  const keywordSeeds = [
    '学籍',
    '转专业',
    '成绩',
    '学分',
    '考试',
    '请假',
    '奖学金',
    '助学金',
    '资助',
    '宿舍',
    '医保',
    '图书馆',
    '违纪',
    '处分',
    '申诉',
    '就业',
  ]
  const keywords = Array.from(
    new Set(keywordSeeds.filter((item) => content.includes(item) || compact.includes(item))),
  ).slice(0, 12)

  entries.push({
    id: `student_handbook_${hash}`,
    title,
    category,
    sourceType: 'student_handbook',
    authority: '2025年学生手册',
    updatedAt: fileMeta.updatedAt,
    keywords,
    url: '',
    content,
    handbookPart: current.part || '',
    importedFrom: fileMeta.importedFrom,
    downloadPath: fileMeta.downloadPath,
    downloadName: fileMeta.downloadName,
  })
}

const buildEntries = (paragraphs, fileMeta) => {
  const tocTitles = extractTocTitles(paragraphs)
  const tocIndex = paragraphs.findIndex((line) => normalizeLine(line) === '目录')
  const bodyStartByTitle = (() => {
    if (tocTitles.length === 0) return -1
    const target = compactTitle(tocTitles[0])
    const indexes = paragraphs
      .map((line, index) => ({ line: compactTitle(normalizeLine(line)), index }))
      .filter((item) => item.index > tocIndex && item.line === target)
      .map((item) => item.index)

    if (indexes.length >= 2) return indexes[1]
    if (indexes.length >= 1) return indexes[0]
    return -1
  })()
  const bodyStart = bodyStartByTitle >= 0 ? bodyStartByTitle : detectBodyStartIndex(paragraphs)
  const lines = paragraphs
    .slice(bodyStart)
    .map(normalizeLine)
    .filter((line) => !isArtifactLine(line))

  const entries = []
  let currentPart = ''
  let current = null

  for (const line of lines) {
    if (PART_RE.test(line)) {
      currentPart = line
      continue
    }

    if (isTitleLine(line)) {
      if (shouldMergeTitleLine(current, line)) {
        current.title = normalizeLine(`${current.title}${line}`)
        continue
      }

      finalizeEntry(entries, current, fileMeta)
      current = {
        title: line,
        part: currentPart,
        lines: [],
      }
      continue
    }

    if (!current) continue

    if (line === current.title) continue
    current.lines.push(line)
  }

  finalizeEntry(entries, current, fileMeta)

  const cleanedEntries = entries.filter((entry) => !/^\d+[.、]\s*/.test(entry.title))

  for (let i = 0; i < Math.min(cleanedEntries.length, tocTitles.length); i += 1) {
    const entryTitle = compactTitle(cleanedEntries[i].title)
    const tocTitle = normalizeLine(tocTitles[i])
    const tocCompact = compactTitle(tocTitle)
    const titleLooksIncomplete =
      entryTitle.length < tocCompact.length * 0.72 ||
      (!entryTitle.includes('广东第二师范学院') && tocCompact.includes('广东第二师范学院')) ||
      /^(管理规定|实施办法|测评办法|处理办法|认定办法|奖学金管理办法)/.test(entryTitle)

    if (titleLooksIncomplete) {
      cleanedEntries[i].title = tocTitle
    }
  }

  for (const entry of cleanedEntries) {
    if (TITLE_REPLACEMENTS.has(entry.title)) {
      entry.title = TITLE_REPLACEMENTS.get(entry.title)
    }
  }

  return cleanedEntries
}

const ensureOutputDir = (outputPath) => {
  const dir = dirname(outputPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const docxPath = findDocxFile(args.input, args.docx)
  const outputPath = resolve(cwd, args.output)
  const stats = statSync(docxPath)
  const paragraphs = extractParagraphs(docxPath)
  const fileMeta = {
    updatedAt: new Date(stats.mtimeMs).toISOString().slice(0, 10),
    importedFrom: docxPath.replace(/\\/g, '/'),
    downloadPath: docxPath.replace(/\\/g, '/').replace(`${cwd.replace(/\\/g, '/')}/`, ''),
    downloadName: docxPath.split(/[/\\]/).pop() || '',
  }

  const entries = buildEntries(paragraphs, fileMeta)

  if (!args.dryRun) {
    ensureOutputDir(outputPath)
    writeFileSync(outputPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')
  }

  console.log(
    JSON.stringify(
      {
        input: docxPath,
        output: args.output,
        dryRun: args.dryRun,
        extractedParagraphs: paragraphs.length,
        entries: entries.length,
        sampleTitles: entries.slice(0, 12).map((item) => item.title),
      },
      null,
      2,
    ),
  )
}

main()
