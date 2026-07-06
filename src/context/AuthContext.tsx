import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'
import { setDataMode } from '../services/dataMode'
import { DEMO_USER_ID, hasDemoData, seedDemoData } from '../services/localStore'

export interface AppUser {
  id: string
  email: string | null
  isDemo: boolean
}

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  supabaseEnabled: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  enterDemoMode: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const DEMO_FLAG_KEY = 'patrimoine-demo-session'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function init() {
      // Session démo persistée ?
      if (localStorage.getItem(DEMO_FLAG_KEY) === '1') {
        setDataMode('DEMO')
        if (!hasDemoData()) seedDemoData(DEMO_USER_ID)
        if (active) {
          setUser({ id: DEMO_USER_ID, email: 'demo@exemple.fr', isDemo: true })
          setLoading(false)
        }
        return
      }

      if (!isSupabaseConfigured || !supabase) {
        if (active) setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (active) {
        const s = data.session
        setUser(s ? { id: s.user.id, email: s.user.email ?? null, isDemo: false } : null)
        setLoading(false)
      }
    }

    init()

    const sub = supabase?.auth.onAuthStateChange((_event, session) => {
      // On ignore les événements auth si on est en session démo.
      if (localStorage.getItem(DEMO_FLAG_KEY) === '1') return
      setUser(session ? { id: session.user.id, email: session.user.email ?? null, isDemo: false } : null)
    })

    return () => {
      active = false
      sub?.data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    return {
      user,
      loading,
      supabaseEnabled: isSupabaseConfigured,

      async signIn(email, password) {
        if (!supabase) throw new Error('Supabase non configuré.')
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setDataMode('SUPABASE')
        localStorage.removeItem(DEMO_FLAG_KEY)
      },

      async signUp(email, password) {
        if (!supabase) throw new Error('Supabase non configuré.')
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setDataMode('SUPABASE')
        localStorage.removeItem(DEMO_FLAG_KEY)
        // Si la confirmation email est activée, il n'y a pas de session immédiate.
        return { needsConfirmation: !data.session }
      },

      async signOut() {
        if (localStorage.getItem(DEMO_FLAG_KEY) === '1') {
          localStorage.removeItem(DEMO_FLAG_KEY)
          setUser(null)
          setDataMode(isSupabaseConfigured ? 'SUPABASE' : 'DEMO')
          return
        }
        if (supabase) await supabase.auth.signOut()
        setUser(null)
      },

      enterDemoMode() {
        setDataMode('DEMO')
        localStorage.setItem(DEMO_FLAG_KEY, '1')
        if (!hasDemoData()) seedDemoData(DEMO_USER_ID)
        setUser({ id: DEMO_USER_ID, email: 'demo@exemple.fr', isDemo: true })
      },
    }
  }, [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>.')
  return ctx
}
