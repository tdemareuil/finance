import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le harness d'aperçu assigne un port libre via la variable PORT (Vite ne la lit
// pas par défaut). On l'honore pour éviter les conflits avec un serveur déjà lancé.
// eslint-disable-next-line no-undef
const port = process.env.PORT ? Number(process.env.PORT) : undefined

export default defineConfig(({ command }) => ({
  // En dev (serve) : base '/' (plus simple, compatible aperçu).
  // En build : '/finance/' pour GitHub Pages, surchargeable via VITE_BASE.
  // eslint-disable-next-line no-undef
  base: command === 'serve' ? '/' : process.env.VITE_BASE ?? '/finance/',
  plugins: [react()],
  server: { port },
}))
