import '../env-loader.mjs'
import { queryLightRag } from '../lightrag.mjs'

const parseArgs = (argv) => {
  const args = {
    mode: '',
    onlyNeedContext: false,
    query: '',
    topK: 0,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--query' || arg === '-q') args.query = argv[++i] || args.query
    else if (arg === '--mode') args.mode = argv[++i] || args.mode
    else if (arg === '--top-k') args.topK = Number(argv[++i] || args.topK)
    else if (arg === '--context-only') args.onlyNeedContext = true
  }

  if (!args.query) args.query = argv.filter((item) => !item.startsWith('--')).join(' ').trim()
  return args
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.query) {
    throw new Error('missing query. Example: npm run lightrag:query -- --query "补考怎么报名"')
  }

  const result = await queryLightRag(args.query, {
    mode: args.mode || undefined,
    onlyNeedContext: args.onlyNeedContext,
    topK: args.topK || undefined,
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error('[query-lightrag] failed:', error?.data || error)
  process.exitCode = 1
})
