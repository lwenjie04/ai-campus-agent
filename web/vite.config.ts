import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import ElementPlus from 'unplugin-element-plus/vite'

// https://vite.dev/config/
export default defineConfig(() => {
  const plugins: PluginOption[] = [
    vue(),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
    ElementPlus({}),
  ]

  if (process.env.VITE_ENABLE_DEVTOOLS === 'true') {
    plugins.push(vueDevTools())
  }

  return {
    plugins,
    server: {
      host: '0.0.0.0',
    },
    preview: {
      host: '0.0.0.0',
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'element-plus': ['element-plus'],
            'vue-vendor': ['vue', 'pinia'],
          },
        },
      },
    },
  }
})
