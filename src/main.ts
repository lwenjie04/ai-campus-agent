import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import './assets/tokens.css' // 设计 Token
import './assets/motion.css' // 全局动效

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
