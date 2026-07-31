// 极简内存限流器：固定窗口计数 + 定期清理过期键。
// 适用于单进程部署；多实例（pm2 cluster）时各实例独立计数，需要全局一致性时再升级 Redis。

export const createRateLimiter = ({ windowMs, max }) => {
  const buckets = new Map()

  // 定期清理过期键，避免无限增长。
  const cleanup = () => {
    const cutoff = Date.now() - windowMs
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= cutoff) {
        buckets.delete(key)
      }
    }
  }

  const timer = setInterval(cleanup, Math.max(Math.floor(windowMs / 10), 1000))
  if (typeof timer.unref === 'function') timer.unref()

  return {
    // 每次调用计数 +1；未超限返回 allowed: true，超限返回 allowed: false + 剩余等待毫秒数。
    check(key) {
      const current = Date.now()
      const bucket = buckets.get(key)
      if (!bucket || bucket.resetAt <= current) {
        buckets.set(key, { count: 1, resetAt: current + windowMs })
        return { allowed: true, count: 1, retryAfterMs: 0 }
      }
      if (bucket.count >= max) {
        return { allowed: false, count: bucket.count, retryAfterMs: bucket.resetAt - current }
      }
      bucket.count += 1
      return { allowed: true, count: bucket.count, retryAfterMs: 0 }
    },

    // 清除某个 key 的计数（如登录成功后清零失败计数）。
    reset(key) {
      buckets.delete(key)
    },

    // 仅供诊断/测试。
    size: () => buckets.size,
  }
}
