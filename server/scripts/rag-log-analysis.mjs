import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEFAULT_LOG = resolve(import.meta.dirname, '..', 'logs', 'rag-search.log.ndjson')

const parseArgs = (argv) => {
  const args = { top: 10, json: false, log: DEFAULT_LOG }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--top') args.top = Number(argv[++i]) || 10
    else if (arg === '--json') args.json = true
    else if (arg === '--log') args.log = argv[++i]
  }
  return args
}

const loadEntries = (logPath) => {
  if (!existsSync(logPath)) return null
  const entries = []
  for (const line of readFileSync(logPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      entries.push(JSON.parse(trimmed))
    } catch {
      // 跳过坏行，不阻塞分析
    }
  }
  return entries
}

const analyze = (entries) => {
  const total = entries.length
  const withHits = entries.filter((e) => Array.isArray(e.hits) && e.hits.length > 0)
  const hitRate = total ? (withHits.length / total) * 100 : 0
  const avgHits = withHits.length ? withHits.reduce((s, e) => s + e.hits.length, 0) / withHits.length : 0
  const topScores = withHits.map((e) => e.hits[0].score || 0)
  const avgTopScore = topScores.length ? topScores.reduce((a, b) => a + b, 0) / topScores.length : 0

  const noHitQueries = entries
    .filter((e) => !Array.isArray(e.hits) || e.hits.length === 0)
    .map((e) => e.query || '')

  const categoryCount = {}
  for (const e of entries) {
    for (const c of Array.isArray(e.preferredCategories) ? e.preferredCategories : []) {
      categoryCount[c] = (categoryCount[c] || 0) + 1
    }
  }

  const routeCount = {}
  for (const e of entries) {
    const r = e.routeMode || 'unknown'
    routeCount[r] = (routeCount[r] || 0) + 1
  }

  const titleCount = {}
  for (const e of withHits) {
    for (const h of e.hits) {
      if (h.title) titleCount[h.title] = (titleCount[h.title] || 0) + 1
    }
  }
  const topTitles = Object.entries(titleCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, count]) => ({ title, count }))

  return {
    total,
    withHits: withHits.length,
    hitRate: Number(hitRate.toFixed(1)),
    avgHits: Number(avgHits.toFixed(2)),
    avgTopScore: Number(avgTopScore.toFixed(2)),
    noHitQueries,
    categoryDistribution: Object.fromEntries(Object.entries(categoryCount).sort((a, b) => b[1] - a[1])),
    routeDistribution: Object.fromEntries(Object.entries(routeCount).sort((a, b) => b[1] - a[1])),
    topTitles,
  }
}

const formatText = (r, top) => {
  const lines = []
  lines.push('RAG 检索日志分析')
  lines.push(
    `总查询: ${r.total} | 有命中: ${r.withHits} | 命中率: ${r.hitRate}% | 平均命中: ${r.avgHits} 条 | 平均最高分: ${r.avgTopScore}`,
  )
  lines.push('')
  lines.push(`无命中查询 TOP ${top}（知识库缺口）:`)
  if (r.noHitQueries.length === 0) lines.push('  (无)')
  else r.noHitQueries.slice(0, top).forEach((q, i) => lines.push(`  ${i + 1}. ${q}`))
  lines.push('')
  lines.push('查询分类分布:')
  const cats = Object.entries(r.categoryDistribution)
  if (cats.length === 0) lines.push('  (无分类)')
  else cats.forEach(([c, n]) => lines.push(`  ${c}: ${n}`))
  lines.push('')
  lines.push('路由模式分布:')
  Object.entries(r.routeDistribution).forEach(([m, n]) => lines.push(`  ${m}: ${n}`))
  lines.push('')
  lines.push('被引用最多的命中 TOP 5:')
  if (r.topTitles.length === 0) lines.push('  (无)')
  else r.topTitles.forEach(({ title, count }, i) => lines.push(`  ${i + 1}. [${count}] ${title}`))
  return lines.join('\n')
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const entries = loadEntries(args.log)
  if (!entries) {
    console.error(`日志文件不存在: ${args.log}`)
    console.error('请先运行后端产生检索日志（RAG_LOG_ENABLED=true 时每次检索写一行）。')
    process.exit(1)
  }
  if (entries.length === 0) {
    console.error(`日志文件为空: ${args.log}`)
    process.exit(1)
  }
  const result = analyze(entries)
  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(formatText(result, args.top))
  }
}

main()
