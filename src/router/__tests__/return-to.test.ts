import { describe, expect, it } from 'vitest'
import { safeInternalPath } from '@/router/return-to'

describe('登录回跳路径校验', () => {
  it('接受站内绝对路径', () => {
    expect(safeInternalPath('/')).toBe('/')
    expect(safeInternalPath('/community')).toBe('/community')
    expect(safeInternalPath('/chat/abc?tab=1')).toBe('/chat/abc?tab=1')
  })

  it('拒绝外部地址与协议相对地址', () => {
    expect(safeInternalPath('https://evil.example')).toBeNull()
    expect(safeInternalPath('//evil.example')).toBeNull()
    expect(safeInternalPath('javascript:alert(1)')).toBeNull()
    expect(safeInternalPath('community')).toBeNull()
  })

  it('拒绝反斜杠、控制字符与空白值', () => {
    expect(safeInternalPath('/\\evil.example')).toBeNull()
    expect(safeInternalPath('/a\nb')).toBeNull()
    expect(safeInternalPath('   ')).toBeNull()
    expect(safeInternalPath('')).toBeNull()
  })

  it('非字符串一律拒绝', () => {
    expect(safeInternalPath(null)).toBeNull()
    expect(safeInternalPath(undefined)).toBeNull()
    expect(safeInternalPath(42)).toBeNull()
    expect(safeInternalPath(['/community'])).toBeNull()
  })
})
