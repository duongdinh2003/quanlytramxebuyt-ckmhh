import { createPinia } from 'pinia'
import piniaPluginPersistedState from 'pinia-plugin-persistedstate'

export default ({ app }) => {
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedState)
  app.use(pinia)
}
