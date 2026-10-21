import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// MySQL entry point for community, feedback, and receipt persistence.
// Ignored env files fill only process values that were not supplied by the
// caller; the mysql2/promise pool is created lazily on the first query.

const loadEnvFile = (filePath) => {
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

let mysqlModulePromise = null
let poolPromise = null

export const getMySqlConfig = () => ({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'ai_campus_agent',
})

// 是否已经准备好真实数据库连接信息。
// 后续社区模块可以用这个标记决定：走 MySQL 还是继续走 mock。
export const isMySqlConfigured = () => {
  const config = getMySqlConfig()
  return Boolean(config.host && config.user && config.database)
}

// 动态尝试加载 mysql2/promise。
// 这样即使本地暂时没有安装依赖，项目也不会在启动阶段直接崩掉。
export const isMySqlDriverAvailable = async () => {
  try {
    if (!mysqlModulePromise) {
      mysqlModulePromise = import('mysql2/promise')
    }
    await mysqlModulePromise
    return true
  } catch {
    return false
  }
}

const getPool = async () => {
  if (poolPromise) return poolPromise

  if (!(await isMySqlDriverAvailable())) {
    const err = new Error('MYSQL_DRIVER_MISSING')
    err.code = 'MYSQL_DRIVER_MISSING'
    throw err
  }

  const mysql = await mysqlModulePromise
  const config = getMySqlConfig()

  poolPromise = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    charset: 'utf8mb4',
    connectionLimit: 10,
    namedPlaceholders: true,
  })

  return poolPromise
}

// 统一查询入口。
// 社区模块后续只需要调用这个 query，而不用关心连接池的细节。
export const query = async (sql, params = []) => {
  const pool = await getPool()
  // 这里统一使用 query 而不是 execute。
  // 原因是当前社区模块里有分页、动态条件和 JSON 字段等场景，
  // 在部分 MySQL / mysql2 组合下，prepared statement 的 execute
  // 对 LIMIT / OFFSET 等参数会出现 ER_WRONG_ARGUMENTS。
  // 改用 query 后更稳，也更适合现阶段这套轻量后端。
  const [rows] = await pool.query(sql, params)
  return rows
}

export const withMySqlTransaction = async (operation) => {
  const pool = await getPool()
  const connection = await pool.getConnection()
  let transactionStarted = false

  try {
    await connection.beginTransaction()
    transactionStarted = true

    const transactionQuery = async (sql, params = []) => {
      const [rows] = await connection.query(sql, params)
      return rows
    }

    const result = await operation(transactionQuery)
    await connection.commit()
    return result
  } catch (error) {
    if (transactionStarted) {
      await connection.rollback().catch(() => {})
    }
    throw error
  } finally {
    connection.release()
  }
}

// Close the lazily-created pool after an isolated database integration test.
export const closeMySqlPool = async () => {
  const currentPoolPromise = poolPromise
  poolPromise = null
  if (!currentPoolPromise) return

  const pool = await currentPoolPromise
  await pool.end()
}
