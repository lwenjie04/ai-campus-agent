// 全局 token 持有：auth store 负责写入，http 层负责读取。
// 独立成模块是为了避免 store <-> http 之间的循环依赖。

let currentToken = ''

export const setAuthToken = (token: string) => {
  currentToken = token
}

export const getAuthToken = () => currentToken
