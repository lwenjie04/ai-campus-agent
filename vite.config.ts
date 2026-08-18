import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import path from 'path'

const localApiTarget = process.env.VITE_LOCAL_API_TARGET || 'http://127.0.0.1:3000'
const localApiProxy = {
  '/api': localApiTarget,
  '/auth': localApiTarget,
  '/chat': localApiTarget,
  '/community': localApiTarget,
  '/tts': localApiTarget,
  '/kb': localApiTarget,
  '/lightrag': localApiTarget,
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
