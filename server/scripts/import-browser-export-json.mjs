import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

const cwd = process.cwd()

const parseArgs = (argv) => {
  const args = {
    input: 'src/project-text',
    out: 'server/data/knowledge-base.json',
    dryRun: false,
    replace: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--input' || a === '-i') args.input = argv[++i] || args.input
    else if (a === '--out' || a === '-o') args.out = argv[++i] || args.out
    else if (a === '--dry-run') args.dryRun = true
    else if (a === '--replace') args.replace = true
  }

  return args
}

const walkFiles = (dir) => {
  const out = []
  if (!existsSync(dir)) return out
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const abs = resolve(cur, entry.name)
      if (entry.isDirectory()) stack.push(abs)
      else if (entry.isFile()) out.push(abs)
    }
  }
  return out
}

const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim()

const loadJson = (p) => {
  try {
    const raw = readFileSync(p, 'utf8').replace(/^\uFEFF/, '')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const loadKb = (p) => {
  if (!existsSync(p)) return []
  const parsed = loadJson(p)
  return Array.isArray(parsed) ? parsed : []
}

const hash6 = (v) => createHash('md5').update(v).digest('hex').slice(0, 6)

const slugify = (s) => {
  const ascii = String(s || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
  return ascii || hash6(String(s || 'untitled'))
}

const guessCategory = (titleAndContent) => {
  const t = String(titleAndContent || '')
  if (/奖学金|助学金|资助/.test(t)) return 'scholarship'
  if (/教务|选课|转专业|成绩认定|学分认定|课程/.test(t)) return 'teaching'
  if (/考试|补考|重修/.test(t)) return 'exam'
  if (/图书馆|宿舍|食堂|报修|后勤/.test(t)) return 'life'
  return 'general'
}

const guessAuthority = (titleAndContent) => {
  const t = String(titleAndContent || '')
  if (/教务/.test(t)) return '教务相关通知'
  if (/学生工作|资助|奖学金/.test(t)) return '学生工作/资助相关通知'
  if (/图书馆/.test(t)) return '图书馆'
  if (/后勤|宿舍|报修|食堂/.test(t)) return '后勤服务'
  return '官网通知导出'
}

const pickKeywords = (title, content) => {
  const seeds = new Set()
  const text = `${title} ${content || ''}`
  ;[
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
    '补考',
    '重修',
    '考试',
  ].forEach((x) => text.includes(x) && seeds.add(x))
  return Array.from(seeds).slice(0, 12)
}

const toDateString = (dateText, fallbackMs) => {
  const raw = String(dateText || '').trim()
  if (raw) {
    const norm = raw
      .replace(/年/g, '-')
      .replace(/月/g, '-')
      .replace(/日/g, '')
      .replace(/\//g, '-')
    const d = new Date(norm)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  return new Date(fallbackMs).toISOString().slice(0, 10)
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const inputDir = resolve(cwd, args.input)
  const outPath = resolve(cwd, args.out)

  const files = walkFiles(inputDir).filter((p) => extname(p).toLowerCase() === '.json')
  const kb = loadKb(outPath)
  const byId = new Map(kb.map((x) => [String(x.id), x]))
  const byUrl = new Map(kb.filter((x) => x?.url).map((x) => [String(x.url), x]))

  let created = 0
  let updated = 0
  const sample = []

  for (const abs of files) {
    const parsed = loadJson(abs)
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.notice) continue

    const st = statSync(abs)
    const notice = parsed.notice || {}
    const source = parsed.source || {}
    const title = normalize(notice.title)
    const content = normalize(notice.content)
    if (!title || !content) continue

    const category = guessCategory(`${title} ${content}`)
    const id = `${slugify(title)}-${hash6(source.pageUrl || abs)}`
    const entry = {
      id,
      title,
      category,
      sourceType: 'official_notice',
      authority: guessAuthority(`${title} ${content}`),
      updatedAt: toDateString(notice.publishedAt, st.mtimeMs),
      keywords: pickKeywords(title, content),
      url: source.pageUrl || '',
      content: content.slice(0, 12000),
      attachments: Array.isArray(notice.attachments)
        ? notice.attachments.map((a) => ({
            name: normalize(a?.name),
            url: normalize(a?.url),
          }))
        : [],
      importedFrom: abs.replace(/\\/g, '/'),
    }

    const existing = byUrl.get(entry.url) || byId.get(entry.id)
    if (existing) {
      if (args.replace) {
        Object.assign(existing, entry, { id: existing.id || entry.id })
        updated += 1
        sample.push({ action: 'updated', id: existing.id, title: existing.title })
      }
      continue
    }

    kb.push(entry)
    byId.set(entry.id, entry)
    if (entry.url) byUrl.set(entry.url, entry)
    created += 1
    sample.push({ action: 'created', id: entry.id, title: entry.title })
  }

  if (!args.dryRun) {
    kb.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    writeFileSync(outPath, `${JSON.stringify(kb, null, 2)}\n`, 'utf8')
  }

  console.log(
    JSON.stringify(
      {
        input: args.input,
        out: args.out,
        dryRun: args.dryRun,
        scannedJsonFiles: files.length,
        created,
        updated,
        sample: sample.slice(0, 10),
      },
      null,
      2,
    ),
  )
}

main()
