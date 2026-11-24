import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2, X, Trash2, HelpCircle, WifiOff } from 'lucide-react'
import { registrarPonte, humanizarErro } from '../lib/notificar'

const icones = { sucesso: CheckCircle2, erro: AlertCircle, alerta: AlertTriangle, info: Info, carregando: Loader2, offline: WifiOff }
const normalizarTipo = (t) => ({ ok: 'sucesso', aviso: 'alerta', perigo: 'erro' }[t] || t || 'sucesso')
// tempo de leitura: base + por caractere; erros ficam mais
const duracaoDe = (texto, tipo) => (tipo === 'carregando' || tipo === 'offline' ? 0
  : Math.min(10000, Math.max(tipo === 'erro' ? 5500 : 3200, 1600 + String(texto).length * 60)))
const MAX = 4

const AvisoCtx = createContext(() => {})
const DialogoCtx = createContext({})

export function AvisoProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialogos, setDialogos] = useState([])
  const seq = useRef(0)

  const fechar = useCallback((id) => {
    setToasts((l) => l.map((t) => (t.id === id ? { ...t, saindo: true } : t)))
    setTimeout(() => setToasts((l) => l.filter((t) => t.id !== id)), 220)
  }, [])

  const atualizar = useCallback((id, patch) => {
    setToasts((l) => l.map((t) => (t.id === id ? { ...t, ...patch, tipo: normalizarTipo(patch.tipo ?? t.tipo), ciclo: t.ciclo + 1,
      duracao: duracaoDe(patch.texto ?? t.texto, normalizarTipo(patch.tipo ?? t.tipo)) } : t)))
  }, [])

  const avisar = useMemo(() => {
    const fn = (texto, tipo, opcoes = {}) => {
      tipo = normalizarTipo(tipo)
      const id = opcoes.id ?? ++seq.current
      setToasts((l) => {
        // mesmo aviso ainda na tela: só incrementa o contador e reinicia o tempo
        const igual = l.find((t) => !t.saindo && t.texto === texto && t.tipo === tipo)
        if (igual) return l.map((t) => (t === igual ? { ...t, vezes: t.vezes + 1, ciclo: t.ciclo + 1 } : t))
        const novo = { id, texto, tipo, titulo: opcoes.titulo, acao: opcoes.acao, vezes: 1, ciclo: 0, duracao: opcoes.duracao ?? duracaoDe(texto, tipo) }
        const ativos = l.filter((t) => !t.saindo)
        const excedentes = ativos.slice(0, Math.max(0, ativos.length - MAX + 1)).map((t) => t.id)
        excedentes.forEach((x) => setTimeout(() => fechar(x)))
        return [...l, novo]
      })
      return id
    }
    fn.fechar = fechar
    fn.atualizar = atualizar
    fn.promessa = async (p, { carregando = 'Processando…', sucesso = 'Concluído', erro = (e) => humanizarErro(e) } = {}) => {
      const id = fn(carregando, 'carregando')
      try {
        const r = await (typeof p === 'function' ? p() : p)
        atualizar(id, { texto: typeof sucesso === 'function' ? sucesso(r) : sucesso, tipo: 'sucesso' })
        return r
      } catch (e) {
        atualizar(id, { texto: typeof erro === 'function' ? erro(e) : erro, tipo: 'erro' })
        throw e
      }
    }
    return fn
  }, [fechar, atualizar])

  const abrirDialogo = useCallback((op, modo) => new Promise((resolver) => {
    const o = typeof op === 'string' ? { mensagem: op } : op || {}
    setDialogos((l) => [...l, { ...o, modo, id: ++seq.current, resolver }])
  }), [])
  const dialogo = useMemo(() => ({
    confirmar: (op) => abrirDialogo(op, 'confirmar'),
    alertar: (op) => abrirDialogo(op, 'alertar'),
  }), [abrirDialogo])

  useEffect(() => { registrarPonte({ avisar, ...dialogo }) }, [avisar, dialogo])

  // conexão: aviso fixo quando cai, some quando volta
  useEffect(() => {
    const off = () => avisar('Você está sem internet. As vendas não serão registradas até a conexão voltar.', 'offline', { id: 'offline', titulo: 'Sem conexão' })
    const on = () => { fechar('offline'); avisar('Conexão restabelecida') }
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    if (!navigator.onLine) off()
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [avisar, fechar])

  const atual = dialogos[0]
  return (
    <AvisoCtx.Provider value={avisar}>
      <DialogoCtx.Provider value={dialogo}>
        {children}
        {createPortal(
          <div className="toasts" aria-live="polite" aria-relevant="additions">
            {toasts.map((t) => <Toast key={t.id} t={t} onFechar={() => fechar(t.id)} />)}
          </div>,
          document.body
        )}
        {atual && <Dialogo key={atual.id} d={atual} onResolver={(v) => { atual.resolver(v); setDialogos((l) => l.slice(1)) }} />}
      </DialogoCtx.Provider>
    </AvisoCtx.Provider>
  )
}

export const useAviso = () => useContext(AvisoCtx)
export const useDialogo = () => useContext(DialogoCtx)

function Toast({ t, onFechar }) {
  const Icone = icones[t.tipo] || Info
  const [arraste, setArraste] = useState(0)
  const inicio = useRef(null)

  const down = (e) => { if (e.target.closest('button')) return; inicio.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId) }
  const move = (e) => { if (inicio.current != null) setArraste(Math.max(-40, e.clientX - inicio.current)) }
  const up = () => { if (inicio.current == null) return; inicio.current = null; if (arraste > 90) onFechar(); else setArraste(0) }

  return (
    <div className={`toast ${t.tipo}${t.saindo ? ' saindo' : ''}`} role={t.tipo === 'erro' ? 'alert' : 'status'}
      style={arraste ? { transform: `translateX(${arraste}px)`, opacity: 1 - Math.min(arraste, 200) / 260, transition: 'none' } : undefined}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <span className="toast-icone"><Icone size={18} className={t.tipo === 'carregando' ? 'giro' : ''} /></span>
      <div className="toast-corpo">
        {t.titulo && <b>{t.titulo}</b>}
        <span>{t.texto}</span>
        {t.acao && <button className="toast-acao" onClick={() => { t.acao.onClick?.(); onFechar() }}>{t.acao.rotulo}</button>}
      </div>
      {t.vezes > 1 && <span className="toast-vezes" key={t.vezes}>×{t.vezes}</span>}
      {t.tipo !== 'carregando' && <button className="toast-x" onClick={onFechar} aria-label="Fechar aviso"><X size={14} /></button>}
      {t.duracao > 0 && !t.saindo && (
        <span key={t.ciclo} className="toast-barra" style={{ animationDuration: t.duracao + 'ms' }} onAnimationEnd={onFechar} />
      )}
    </div>
  )
}

const iconesDialogo = { perigo: Trash2, alerta: AlertTriangle, info: Info, sucesso: CheckCircle2, pergunta: HelpCircle, erro: AlertCircle }

function Dialogo({ d, onResolver }) {
  const [saindo, setSaindo] = useState(false)
  const confirmar = d.modo === 'confirmar'
  const tipo = d.tipo || (confirmar ? 'pergunta' : 'info')
  const perigo = tipo === 'perigo' || tipo === 'erro'
  const Icone = d.icone || iconesDialogo[tipo] || Info
  const resolver = useRef(onResolver)
  resolver.current = onResolver
  const fechar = useCallback((v) => { setSaindo(true); setTimeout(() => resolver.current(v), 160) }, [])

  useEffect(() => {
    // captura antes do Modal de baixo, para o Esc fechar só o diálogo
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fechar(confirmar ? false : undefined) } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [fechar, confirmar])

  return createPortal(
    <div className={'dlg-fundo' + (saindo ? ' saindo' : '')} onMouseDown={(e) => e.target === e.currentTarget && fechar(confirmar ? false : undefined)}>
      <div className={'dlg ' + tipo} role="alertdialog" aria-modal="true" aria-labelledby="dlg-titulo" aria-describedby="dlg-msg">
        <div className="dlg-icone"><Icone size={24} /></div>
        <h2 id="dlg-titulo">{d.titulo || (confirmar ? 'Confirmar ação' : 'Aviso')}</h2>
        {d.mensagem && <p id="dlg-msg">{d.mensagem}</p>}
        <div className="dlg-acoes">
          {confirmar && <button className="btn" autoFocus={perigo} onClick={() => fechar(false)}>{d.cancelar || 'Cancelar'}</button>}
          <button className={'btn ' + (perigo ? 'btn-perigo-cheio' : 'btn-primario')} autoFocus={!perigo} onClick={() => fechar(confirmar ? true : undefined)}>
            {d.confirmar || (confirmar ? 'Confirmar' : 'Entendi')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
