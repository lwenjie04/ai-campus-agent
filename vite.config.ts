import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import path from 'path'

const localApiTarget = process.env.VITE_LOCAL_API_TARGET || 'http://127.0.0.1:3000'
// 页面路由（/chat、/community…）必须由前端接管，dev/preview 只代理 /api。
const localApiProxy = {
  '/api': localApiTarget,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src')
  }
},
server: {
  proxy: localApiProxy,
},
preview: {
  proxy: localApiProxy,
},
})
