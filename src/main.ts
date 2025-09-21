import './index.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import analyticsService from './services/analyticsService'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

// Initialize analytics after app is mounted
try {
  analyticsService.init()
} catch (error) {
  console.warn('Analytics initialization failed:', error)
}
