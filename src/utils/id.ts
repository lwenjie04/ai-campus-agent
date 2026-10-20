// 统一生成可持久化的稳定 ID：优先使用 crypto.randomUUID，
// 在不支持的环境（旧浏览器、部分测试环境）退化为时间戳 + 随机串。
export const createId = (prefix: string): string => {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `${prefix}_${cryptoApi.randomUUID()}`
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}
