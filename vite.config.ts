import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages sert le site depuis /<nom-du-repo>/.
// On peut surcharger via la variable d'env VITE_BASE (utile en local ou custom domain).
// eslint-disable-next-line no-undef
const base = process.env.VITE_BASE ?? '/finance/'

export default defineConfig({
  base,
  plugins: [react()],
})
