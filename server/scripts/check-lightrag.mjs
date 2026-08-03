import '../env-loader.mjs'
import { LIGHTRAG_CONFIG, checkLightRagHealth } from '../lightrag.mjs'

const main = async () => {
  console.log(
    JSON.stringify(
      {
        baseUrl: LIGHTRAG_CONFIG.baseUrl,
        insertEndpoint: LIGHTRAG_CONFIG.insertEndpoint,
        queryEndpoint: LIGHTRAG_CONFIG.queryEndpoint,
        queryMode: LIGHTRAG_CONFIG.queryMode,
      },
      null,
      2,
    ),
  )

  const result = await checkLightRagHealth()
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error('[check-lightrag] failed:', error?.data || error)
  process.exitCode = 1
})
