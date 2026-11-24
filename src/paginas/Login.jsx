import { useEffect, useRef, useState } from 'react'
import {
  Mail, Lock, User, ArrowRight, CheckCircle2, AlertCircle, Package, ShoppingCart, BarChart3, Users, Check, X, ArrowLeft,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { bloqueioCadastro, useAuth } from '../lib/auth'
import { tema } from '../tema'
import { Campo, Botao } from '../componentes/ui'
import { Input, InputSenha } from '../componentes/Input'
import Checkbox from '../componentes/Checkbox'
import { forcaSenha, sanitizar, validacoes } from '../lib/mascaras'

const CHAVE_EMAIL = 'estoque-pdv:email'
const lerEmail = () => { try { return localStorage.getItem(CHAVE_EMAIL) || '' } catch { return '' } }

const recursos = [
  { icone: ShoppingCart, texto: 'Caixa rápido com leitor de código de barras' },
  { icone: Package, texto: 'Estoque com variações e alertas de mínimo' },
  { icone: Users, texto: 'Clientes, fiado e fornecedores' },
  { icone: BarChart3, texto: 'Relatórios de vendas e lucro em tempo real' },
]

const coresForca = ['var(--perigo)', 'var(--perigo)', 'var(--alerta)', 'var(--sucesso)', 'var(--sucesso)']

function traduzir(m = '') {
  if (/Invalid login/i.test(m)) return 'E-mail ou senha incorretos.'
  if (/already registered|already exists/i.test(m)) return 'Este e-mail já está cadastrado. Faça login.'
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.'
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  if (/Password should be/i.test(m)) return 'A senha não atende aos requisitos mínimos.'
  if (/fetch/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.'
  return m
}

export default function Login() {
  const { recuperando } = useAuth()
  const [modo, setModo] = useState(recuperando ? 'nova-senha' : 'entrar')
  const [aviso, setAviso] = useState(null)
  const [emailInicial, setEmailInicial] = useState(lerEmail)

  useEffect(() => { if (recuperando) setModo('nova-senha') }, [recuperando])

  const trocar = (m, a = null) => { setModo(m); setAviso(a) }

  return (
    <div className="auth">
      <aside className="auth-vitrine">
        <span className="auth-forma f1" /><span className="auth-forma f2" /><span className="auth-forma f3" />
        <div className="auth-marca">
          <div className="marca-icone">{tema.logo ? <img src={tema.logo} alt="" /> : <Package size={22} />}</div>
          <div><b>{tema.nomeEmpresa}</b><small>{tema.slogan}</small></div>
        </div>
        <div>
          <h2 className="auth-titulo">Sua loja organizada do estoque ao caixa.</h2>
          <p className="auth-sub">Venda, controle o estoque e acompanhe o resultado do seu negócio em um só lugar, de qualquer dispositivo.</p>
          <ul className="auth-lista">
            {recursos.map((r, i) => (
              <li key={r.texto} style={{ animationDelay: `${220 + i * 70}ms` }}><span><r.icone size={17} /></span>{r.texto}</li>
            ))}
          </ul>
        </div>
        <div className="auth-rodape">© {new Date().getFullYear()} {tema.nomeEmpresa}</div>
      </aside>

      <main className="auth-lado">
        <div className="auth-caixa">
          {modo === 'recuperar' || modo === 'nova-senha' ? (
            modo === 'recuperar'
              ? <Recuperar emailInicial={emailInicial} voltar={(a) => trocar('entrar', a)} />
              : <NovaSenha concluir={(a) => trocar('entrar', a)} />
          ) : <>
            <h1>{modo === 'entrar' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h1>
            <p>{modo === 'entrar' ? 'Entre com seu e-mail e senha para continuar.' : 'Leva menos de um minuto para começar.'}</p>
            <div className="auth-abas" role="tablist">
              <span className={'indicador' + (modo === 'cadastrar' ? ' dir' : '')} />
              <button role="tab" aria-selected={modo === 'entrar'} className={modo === 'entrar' ? 'ativa' : ''} onClick={() => trocar('entrar')}>Entrar</button>
              <button role="tab" aria-selected={modo === 'cadastrar'} className={modo === 'cadastrar' ? 'ativa' : ''} onClick={() => trocar('cadastrar')}>Criar conta</button>
            </div>
            {aviso && <Aviso {...aviso} />}
            {modo === 'entrar'
              ? <Entrar key="e" emailInicial={emailInicial} esqueci={() => trocar('recuperar')} />
              : <Cadastrar key="c" onCriado={(email, confirmar) => {
                  setEmailInicial(email)
                  trocar('entrar', {
                    tipo: 'ok',
                    texto: confirmar
                      ? `Conta criada! Enviamos um link de confirmação para ${email}. Confirme e depois faça login.`
                      : 'Conta criada com sucesso! Faça login para continuar.',
                  })
                }} />}
          </>}
        </div>
      </main>
    </div>
  )
}

function Aviso({ tipo, texto }) {
  return <div className={'auth-aviso ' + tipo} role="alert">{tipo === 'ok' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}<span>{texto}</span></div>
}

function Entrar({ emailInicial, esqueci }) {
  const [email, setEmail] = useState(emailInicial)
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(!!emailInicial)
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const tentativas = useRef({ n: 0, ate: 0 })
  const senhaRef = useRef()

  useEffect(() => { if (emailInicial) senhaRef.current?.focus() }, [])

  async function enviar(e) {
    e.preventDefault()
    const t = tentativas.current
    if (Date.now() < t.ate) return setErro(`Muitas tentativas. Aguarde ${Math.ceil((t.ate - Date.now()) / 1000)}s.`)
    setErro(null); setOcupado(true)
    const limpo = email.trim().toLowerCase()
    const { error } = await supabase.auth.signInWithPassword({ email: limpo, password: senha })
    setOcupado(false)
    if (error) {
      t.n++
      if (t.n >= 5) { t.ate = Date.now() + 30000; t.n = 0 }
      setSenha('')
      return setErro(traduzir(error.message))
    }
    try { lembrar ? localStorage.setItem(CHAVE_EMAIL, limpo) : localStorage.removeItem(CHAVE_EMAIL) } catch {}
  }

  return (
    <form className="auth-form" onSubmit={enviar} noValidate>
      {erro && <Aviso tipo="erro" texto={erro} />}
      <Campo label="E-mail"><Input icone={Mail} type="email" required autoComplete="email" placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus={!emailInicial} /></Campo>
      <Campo label="Senha"><InputSenha icone={Lock} ref={senhaRef} required autoComplete="current-password" placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} /></Campo>
      <div className="auth-linha">
        <Checkbox checked={lembrar} onChange={setLembrar}>Lembrar meu e-mail</Checkbox>
        <button type="button" className="btn btn-fantasma" style={{ height: 30, padding: '0 6px', color: 'var(--primaria)' }} onClick={esqueci}>Esqueci a senha</button>
      </div>
      <Botao type="submit" className="btn-primario btn-grande" carregando={ocupado} disabled={!email || !senha}>
        {ocupado ? 'Entrando…' : <>Entrar <ArrowRight size={18} /></>}
      </Botao>
    </form>
  )
}

const requisitos = [
  { teste: (s) => s.length >= 8, texto: '8+ caracteres' },
  { teste: (s) => /[A-Z]/.test(s) && /[a-z]/.test(s), texto: 'Maiúscula e minúscula' },
  { teste: (s) => /\d/.test(s), texto: 'Um número' },
  { teste: (s) => /[^A-Za-z0-9]/.test(s), texto: 'Um símbolo' },
]

function MedidorSenha({ senha }) {
  const f = forcaSenha(senha)
  if (!senha) return null
  return (
    <>
      <div className="forca">{[0, 1, 2, 3].map((i) => <span key={i} style={{ background: i < f.nivel ? coresForca[f.nivel] : undefined }} />)}</div>
      <div className="forca-texto">Força: <b style={{ color: coresForca[f.nivel] }}>{f.texto}</b></div>
      <ul className="requisitos">
        {requisitos.map((r) => { const ok = r.teste(senha); return <li key={r.texto} className={ok ? 'ok' : ''}>{ok ? <Check size={13} /> : <X size={13} />}{r.texto}</li> })}
      </ul>
    </>
  )
}

function Cadastrar({ onCriado }) {
  const [f, setF] = useState({ nome: '', email: '', senha: '', confirmar: '' })
  const [aceite, setAceite] = useState(false)
  const [erro, setErro] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const senhaOk = requisitos.slice(0, 3).every((r) => r.teste(f.senha))
  const confere = f.confirmar && f.senha === f.confirmar

  async function enviar(e) {
    e.preventDefault()
    const nome = sanitizar(f.nome, 80)
    const email = f.email.trim().toLowerCase()
    if (nome.length < 2) return setErro('Informe seu nome.')
    if (validacoes.email(email) !== true) return setErro('Informe um e-mail válido.')
    if (!senhaOk) return setErro('A senha precisa de 8+ caracteres, maiúscula, minúscula e número.')
    if (!confere) return setErro('As senhas não conferem.')
    setErro(null); setOcupado(true)
    bloqueioCadastro.ativo = true
    try {
      const { data, error } = await supabase.auth.signUp({ email, password: f.senha, options: { data: { nome }, emailRedirectTo: location.origin + location.pathname } })
      if (error) throw error
      // Supabase devolve identities vazio quando o e-mail já existe
      if (data.user && data.user.identities?.length === 0) throw new Error('already registered')
      if (data.session) await supabase.auth.signOut()
      onCriado(email, !data.session)
    } catch (err) {
      setErro(traduzir(err.message))
    } finally {
      bloqueioCadastro.ativo = false
      setOcupado(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={enviar} noValidate>
      {erro && <Aviso tipo="erro" texto={erro} />}
      <Campo label="Nome completo"><Input icone={User} required autoComplete="name" placeholder="Como devemos te chamar" maxLength={80} value={f.nome} onChange={set('nome')} autoFocus /></Campo>
      <Campo label="E-mail"><Input icone={Mail} type="email" required autoComplete="email" placeholder="voce@empresa.com" value={f.email} onChange={set('email')} /></Campo>
      <Campo label="Senha">
        <InputSenha icone={Lock} required autoComplete="new-password" placeholder="Crie uma senha forte" value={f.senha} onChange={set('senha')} />
        <MedidorSenha senha={f.senha} />
      </Campo>
      <Campo label="Confirmar senha">
        <InputSenha icone={Lock} required autoComplete="new-password" placeholder="Repita a senha" value={f.confirmar} onChange={set('confirmar')} />
        {f.confirmar && <span className="inp-msg" style={{ color: confere ? 'var(--sucesso)' : 'var(--perigo)' }}>{confere ? 'As senhas conferem' : 'As senhas não conferem'}</span>}
      </Campo>
      <Checkbox checked={aceite} onChange={setAceite}>Li e aceito os termos de uso e a política de privacidade</Checkbox>
      <Botao type="submit" className="btn-primario btn-grande" carregando={ocupado} disabled={!aceite || !f.nome || !f.email || !senhaOk || !confere}>
        {ocupado ? 'Criando conta…' : <>Criar conta <ArrowRight size={18} /></>}
      </Botao>
      <p className="suave" style={{ margin: 0, fontSize: 12, textAlign: 'center' }}>O primeiro cadastro vira administrador. Os próximos aguardam aprovação.</p>
    </form>
  )
}

function Recuperar({ emailInicial, voltar }) {
  const [email, setEmail] = useState(emailInicial)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(null)
  async function enviar(e) {
    e.preventDefault()
    if (validacoes.email(email.trim()) !== true) return setErro('Informe um e-mail válido.')
    setOcupado(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: location.origin + location.pathname })
    setOcupado(false)
    if (error) return setErro(traduzir(error.message))
    voltar({ tipo: 'ok', texto: `Se ${email.trim()} estiver cadastrado, você receberá um link para criar uma nova senha.` })
  }
  return (
    <>
      <button className="btn btn-fantasma" style={{ padding: '0 8px', marginLeft: -8, marginBottom: 14 }} onClick={() => voltar()}><ArrowLeft size={16} /> Voltar</button>
      <h1>Recuperar senha</h1>
      <p>Enviaremos um link para você criar uma nova senha.</p>
      <form className="auth-form" onSubmit={enviar} noValidate>
        {erro && <Aviso tipo="erro" texto={erro} />}
        <Campo label="E-mail"><Input icone={Mail} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        <Botao type="submit" className="btn-primario btn-grande" carregando={ocupado} disabled={!email}>Enviar link</Botao>
      </form>
    </>
  )
}

function NovaSenha({ concluir }) {
  const { fimRecuperacao } = useAuth()
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(null)
  const ok = requisitos.slice(0, 3).every((r) => r.teste(senha))
  async function enviar(e) {
    e.preventDefault()
    setOcupado(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setOcupado(false)
    if (error) return setErro(traduzir(error.message))
    await supabase.auth.signOut()
    fimRecuperacao()
    concluir({ tipo: 'ok', texto: 'Senha alterada! Entre com a nova senha.' })
  }
  return (
    <>
      <h1>Criar nova senha</h1>
      <p>Escolha uma senha forte que você não use em outros sites.</p>
      <form className="auth-form" onSubmit={enviar}>
        {erro && <Aviso tipo="erro" texto={erro} />}
        <Campo label="Nova senha"><InputSenha icone={Lock} autoFocus autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /><MedidorSenha senha={senha} /></Campo>
        <Botao type="submit" className="btn-primario btn-grande" carregando={ocupado} disabled={!ok}>Salvar nova senha</Botao>
      </form>
    </>
  )
}
