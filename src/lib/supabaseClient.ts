import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env['VITE_SUPABASE_URL'] as string) || ''
const supabaseAnonKey = (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string) || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Variáveis de ambiente não configuradas. Sync cloud desativado.')
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
