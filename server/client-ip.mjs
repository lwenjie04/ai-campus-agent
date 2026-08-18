import './env-loader.mjs'
import { isIP } from 'node:net'

const normalizeIp = (value) => {
  let ip = String(value || '').trim()
  if (!ip) return ''

  if (ip.startsWith('[')) {
    const closingBracket = ip.indexOf(']')
    if (closingBracket > 0) ip = ip.slice(1, closingBracket)
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(':'))
  }

  if (ip.startsWith('::ffff:')) ip = ip.slice(7)
  return isIP(ip) ? ip.toLowerCase() : ''
}

const trustedProxyIps = new Set(
  String(process.env.TRUSTED_PROXY_IPS || '127.0.0.1,::1')
    .split(',')
    .map(normalizeIp)
    .filter(Boolean),
)

const isTrustedProxy = (ip) => trustedProxyIps.has(normalizeIp(ip))

export const readRequestClientIp = (req, { trustProxy = false } = {}) => {
  const peerIp = normalizeIp(req?.socket?.remoteAddress || req?.connection?.remoteAddress)
  if (!trustProxy || !peerIp || !isTrustedProxy(peerIp)) return peerIp

  const forwardedChain = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map(normalizeIp)
    .filter(Boolean)

  if (forwardedChain.length === 0) return peerIp

  // 从最靠近应用的代理开始向左剥离可信节点；第一个不可信节点即客户端地址。
  const chain = [...forwardedChain, peerIp]
  while (chain.length > 1 && isTrustedProxy(chain.at(-1))) chain.pop()
  return chain.at(-1) || peerIp
}

export const clientIpConfig = {
  trustedProxyIps: [...trustedProxyIps],
}
