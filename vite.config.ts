import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import path from 'path'


// https://vite.dev/config/
export default defineConfig(() => {
  const plugins: PluginOption[] = [vue()]

  if (process.env.VITE_ENABLE_DEVTOOLS === 'true') {
    plugins.push(vueDevTools())
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  }
})
