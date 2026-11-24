import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from '../tema'

export const supabase = createClient(supabaseConfig.url, supabaseConfig.chave)

// Lança erro com mensagem legível vinda do banco
export function checar({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}
