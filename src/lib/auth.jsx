import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(undefined)
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  async function carregarPerfil() {
    if (!sessao) { setPerfil(null); return }
    const { data } = await supabase.from('perfis').select('*').eq('id', sessao.user.id).maybeSingle()
    setPerfil(data)
  }
  useEffect(() => { carregarPerfil() }, [sessao?.user?.id])

  const valor = {
    sessao, perfil, recarregarPerfil: carregarPerfil,
    admin: perfil?.ativo && perfil?.papel === 'admin',
    carregando: sessao === undefined || (sessao && !perfil),
    sair: () => supabase.auth.signOut(),
  }
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
