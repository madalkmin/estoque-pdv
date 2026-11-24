import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { X, Package } from 'lucide-react'
import { tema } from '../tema'

/* ---------- Avisos (toasts) ---------- */
const AvisoCtx = createContext(() => {})
export function AvisoProvider({ children }) {
  const [lista, setLista] = useState([])
  const avisar = useCallback((texto, tipo = 'ok') => {
    const id = Math.random()
    setLista((l) => [...l, { id, texto, tipo }])
    setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), 3800)
  }, [])
  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      <div className="aviso">{lista.map((a) => <div key={a.id} className={a.tipo}>{a.texto}</div>)}</div>
    </AvisoCtx.Provider>
  )
}
export const useAviso = () => useContext(AvisoCtx)

/* ---------- Modal ---------- */
export function Modal({ titulo, onFechar, children, rodape, largo }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onFechar()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onFechar])
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className={'modal' + (largo ? ' largo' : '')} role="dialog" aria-label={titulo}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button className="btn btn-icone btn-fantasma" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
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
