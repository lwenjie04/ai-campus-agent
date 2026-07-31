import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

// 前端入口文件：
// 1. 创建 Vue 应用实例
// 2. 注册 Pinia 做状态管理
// 3. 注册 Element Plus 作为 UI 组件库
// 4. 把应用挂载到 index.html 中的 #app 节点
const app = createApp(App)
app.use(createPinia())
app.use(ElementPlus)

app.mount('#app')
