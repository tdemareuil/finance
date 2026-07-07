/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_TWELVE_DATA_API_KEY?: string
  readonly VITE_FINNHUB_API_KEY?: string
  readonly VITE_FMP_API_KEY?: string
  readonly VITE_LOGIN_EMAIL?: string
  readonly VITE_DEFAULT_BENCHMARK?: string
  readonly VITE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
