import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X, Package, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { tema } from '../tema'

/* ---------- Avisos (toasts) ---------- */
const AvisoCtx = createContext(() => {})
export function AvisoProvider({ children }) {
  const [lista, setLista] = useState([])
  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random()
    setLista((l) => [...l.slice(-3), { id, texto, tipo }])
    setTimeout(() => setLista((l) => l.map((a) => (a.id === id ? { ...a, saindo: true } : a))), 3600)
    setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), 3900)
  }, [])
  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      <div className="aviso" role="status" aria-live="polite">
        {lista.map((a) => (
          <div key={a.id} className={a.tipo + (a.saindo ? ' saindo' : '')}>
            {a.tipo === 'erro' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{a.texto}
          </div>
        ))}
      </div>
    </AvisoCtx.Provider>
  )
}
export const useAviso = () => useContext(AvisoCtx)

/* ---------- Efeito de onda nos botões (global) ---------- */
export function useOndaBotoes() {
  useEffect(() => {
    const f = (e) => {
      const b = e.target.closest?.('.btn')
      if (!b || b.disabled) return
      const r = b.getBoundingClientRect()
      const s = Math.max(r.width, r.height)
      const o = document.createElement('span')
      o.className = 'onda'
      o.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`
      b.appendChild(o)
      setTimeout(() => o.remove(), 600)
    }
    document.addEventListener('pointerdown', f)
    return () => document.removeEventListener('pointerdown', f)
  }, [])
}

/* ---------- Modal com animação de entrada e saída ---------- */
export function Modal({ titulo, onFechar, children, rodape, largo }) {
  const [saindo, setSaindo] = useState(false)
  const fecharRef = useRef(onFechar)
  fecharRef.current = onFechar
  const fechar = useCallback(() => { setSaindo(true); setTimeout(() => fecharRef.current(), 170) }, [])

  useEffect(() => {
    const k = (e) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', k)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = overflow }
  }, [fechar])

  return (
    <div className={'modal-fundo' + (saindo ? ' saindo' : '')} onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className={'modal' + (largo ? ' largo' : '')} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button className="btn btn-icone btn-fantasma" onClick={fechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  )
}

export function Campo({ label, children, inteiro }) {
  return <div className={'campo' + (inteiro ? ' inteiro' : '')}><label>{label}</label>{children}</div>
}

export function Cabecalho({ titulo, descricao, children }) {
  return (
    <div className="cabecalho">
      <div><h1>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>
      {children && <div className="linha">{children}</div>}
    </div>
  )
}

export function Marca() {
  return (
    <div className="marca">
      <div className="marca-icone">{tema.logo ? <img src={tema.logo} alt="" /> : <Package size={20} />}</div>
      <div><b>{tema.nomeEmpresa}</b><small>{tema.slogan}</small></div>
    </div>
  )
}

export function TelaCarregando() {
  return (
    <div className="carregando-tela" aria-busy="true" aria-label="Carregando">
      <div className="marca-icone">{tema.logo ? <img src={tema.logo} alt="" /> : <Package size={24} />}</div>
    </div>
  )
}

/* Botão que mostra spinner enquanto `carregando` */
export function Botao({ carregando, children, className = '', ...resto }) {
  return (
    <button {...resto} className={'btn ' + className} disabled={carregando || resto.disabled}>
      {carregando && <Loader2 size={16} className="giro" />}{children}
    </button>
  )
}

/* Executa uma ação assíncrona mostrando erro amigável */
export function useAcao() {
  const avisar = useAviso()
  const [ocupado, setOcupado] = useState(false)
  const executar = async (fn, msgOk) => {
    setOcupado(true)
    try {
      const r = await fn()
      if (msgOk) avisar(msgOk)
      return r
    } catch (e) {
      avisar(e.message || 'Erro inesperado', 'erro')
      throw e
    } finally {
      setOcupado(false)
    }
  }
  return [executar, ocupado]
}
