import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

// Enquanto ativo, ignora sessões criadas pelo cadastro (o usuário volta para o login)
export const bloqueioCadastro = { ativo: false }

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(undefined)
  const [perfil, setPerfil] = useState(null)
  const [recuperando, setRecuperando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      if (bloqueioCadastro.ativo && s) return
      setSessao(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function carregarPerfil() {
    if (!sessao) { setPerfil(null); return }
    const { data } = await supabase.from('perfis').select('*').eq('id', sessao.user.id).maybeSingle()
    setPerfil(data || { id: sessao.user.id, email: sessao.user.email, ativo: false, nome: '' })
  }
  useEffect(() => { carregarPerfil() }, [sessao?.user?.id])

  const valor = {
    sessao, perfil, recarregarPerfil: carregarPerfil, recuperando, fimRecuperacao: () => setRecuperando(false),
    admin: perfil?.ativo && perfil?.papel === 'admin',
    carregando: sessao === undefined || (sessao && !perfil),
    sair: () => supabase.auth.signOut(),
  }
  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)
