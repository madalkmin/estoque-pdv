import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Campo, Marca, useAviso } from '../componentes/ui'

export default function Login() {
  const [modo, setModo] = useState('entrar')
  const [f, setF] = useState({ nome: '', email: '', senha: '' })
  const [ocupado, setOcupado] = useState(false)
  const avisar = useAviso()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function enviar(e) {
    e.preventDefault()
    setOcupado(true)
    const r = modo === 'entrar'
      ? await supabase.auth.signInWithPassword({ email: f.email, password: f.senha })
      : await supabase.auth.signUp({ email: f.email, password: f.senha, options: { data: { nome: f.nome } } })
    setOcupado(false)
    if (r.error) return avisar(traduzir(r.error.message), 'erro')
    if (modo === 'cadastrar' && !r.data.session) avisar('Conta criada! Confirme pelo link enviado ao seu e-mail.')
  }

  return (
    <div className="login">
      <form className="card" onSubmit={enviar}>
        <Marca />
        <div style={{ display: 'grid', gap: 12 }}>
          {modo === 'cadastrar' && <Campo label="Nome"><input required value={f.nome} onChange={set('nome')} /></Campo>}
          <Campo label="E-mail"><input type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Campo>
          <Campo label="Senha"><input type="password" required minLength={6} autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} value={f.senha} onChange={set('senha')} /></Campo>
          <button className="btn btn-primario btn-grande" disabled={ocupado}>{modo === 'entrar' ? 'Entrar' : 'Criar conta'}</button>
          <button type="button" className="btn btn-fantasma" onClick={() => setModo(modo === 'entrar' ? 'cadastrar' : 'entrar')}>
            {modo === 'entrar' ? 'Não tem conta? Cadastre-se' : 'Já tenho conta'}
          </button>
          {modo === 'cadastrar' && <p className="suave" style={{ margin: 0, fontSize: 12 }}>O primeiro cadastro vira administrador. Os próximos precisam ser aprovados por ele.</p>}
        </div>
      </form>
    </div>
  )
}

function traduzir(m) {
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/already registered/i.test(m)) return 'Este e-mail já está cadastrado.'
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar.'
  return m
}
