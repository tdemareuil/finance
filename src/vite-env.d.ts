/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_EODHD_API_KEY?: string
  readonly VITE_FINNHUB_API_KEY?: string
  readonly VITE_DEFAULT_BENCHMARK?: string
  readonly VITE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
