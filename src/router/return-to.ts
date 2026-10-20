// 登录后回跳只允许站内绝对路径，避免被 redirect 参数带到外部站点。
// 同时拒绝浏览器会归一化成 //host 的写法（反斜杠、控制字符）。
// 控制字符（含换行）不进入路由；用码点判断，避免正则控制字符规则。
const hasControlCharacter = (value: string) => {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}

export const safeInternalPath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null

  const path = value.trim()
  if (!path) return null
  if (!path.startsWith('/')) return null
  if (path.startsWith('//')) return null
  if (path.includes('\\')) return null
  if (hasControlCharacter(path)) return null

  return path
}
