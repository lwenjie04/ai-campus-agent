import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// 前端单元测试只跑隔离状态与路由边界；页面视觉仍以真实浏览器截图为准。
export default defineConfig({
  // 路由测试会懒加载 .vue 页面，需要 Vue 插件做 SFC 转换。
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    // 默认 forks 会为每个测试文件启动子进程，在受限环境里会因管道不可用失败；
    // 线程池足够覆盖当前的纯状态测试。
    pool: 'threads',
  },
})
