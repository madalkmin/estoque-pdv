import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search, X } from 'lucide-react'

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Select universal.
 * options: [{ value, label, descricao? }]
 * multi: aceita vários valores (value vira array)
 * Busca aparece automaticamente com mais de 6 opções (ou force com `buscavel`).
 */
export default function Select({
  value, onChange, options = [], placeholder = 'Selecione…', multi = false, buscavel,
  disabled, style, className = '', limpar = multi, tamanho, ariaLabel, todosLabel,
}) {
  const [aberto, setAberto] = useState(false)
  const [termo, setTermo] = useState('')
  const [foco, setFoco] = useState(0)
  const [pos, setPos] = useState(null)
  const gatilho = useRef()
  const painel = useRef()
  const buscaRef = useRef()
  const listaRef = useRef()
  const id = useId()

  const selecionados = multi ? (Array.isArray(value) ? value : []) : value
  const temBusca = buscavel ?? options.length > 6
  const filtradas = useMemo(() => {
    const t = normalizar(termo)
    return t ? options.filter((o) => normalizar(o.label).includes(t) || normalizar(o.descricao).includes(t)) : options
  }, [options, termo])

  const estaSel = (v) => (multi ? selecionados.some((s) => String(s) === String(v)) : String(selecionados ?? '') === String(v ?? ''))

  function posicionar() {
    const r = gatilho.current?.getBoundingClientRect()
    if (!r) return
    const altura = Math.min(320, 52 + options.length * 40)
    const abaixo = window.innerHeight - r.bottom
    const paraCima = abaixo < altura + 12 && r.top > abaixo
    setPos({ left: r.left, width: Math.max(r.width, 200), top: paraCima ? undefined : r.bottom + 6, bottom: paraCima ? window.innerHeight - r.top + 6 : undefined, paraCima })
  }

  useLayoutEffect(() => { if (aberto) posicionar() }, [aberto])
  useEffect(() => {
    if (!aberto) return
    const fora = (e) => { if (!painel.current?.contains(e.target) && !gatilho.current?.contains(e.target)) fechar() }
    const mover = (e) => { if (!painel.current?.contains(e.target)) posicionar() }
    document.addEventListener('mousedown', fora)
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', mover, true)
    setTimeout(() => (temBusca ? buscaRef.current : listaRef.current)?.focus(), 10)
    const idx = filtradas.findIndex((o) => estaSel(o.value))
    setFoco(idx >= 0 ? idx : 0)
    return () => {
      document.removeEventListener('mousedown', fora)
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', mover, true)
    }
  }, [aberto])

  useEffect(() => { listaRef.current?.querySelector(`[data-i="${foco}"]`)?.scrollIntoView({ block: 'nearest' }) }, [foco])

  function fechar(devolverFoco) { setAberto(false); setTermo(''); if (devolverFoco) gatilho.current?.focus() }

  function escolher(o) {
    if (multi) {
      onChange(estaSel(o.value) ? selecionados.filter((s) => String(s) !== String(o.value)) : [...selecionados, o.value])
    } else {
      onChange(o.value)
      fechar(true)
    }
  }

  function tecla(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((f) => Math.min(f + 1, filtradas.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(f - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtradas[foco]) escolher(filtradas[foco]) }
    else if (e.key === 'Escape' || e.key === 'Tab') { if (e.key === 'Escape') e.stopPropagation(); fechar(e.key === 'Escape') }
    else if (e.key === 'Home') { e.preventDefault(); setFoco(0) }
    else if (e.key === 'End') { e.preventDefault(); setFoco(filtradas.length - 1) }
  }

  function teclaGatilho(e) {
    if (['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setAberto(true) }
  }

  let rotulo
  if (multi) {
    const sel = options.filter((o) => estaSel(o.value))
    rotulo = !sel.length ? (todosLabel || placeholder)
      : sel.length <= 2 ? sel.map((o) => o.label).join(', ')
      : `${sel.length} selecionados`
  } else {
    rotulo = options.find((o) => estaSel(o.value))?.label
  }
  const vazio = multi ? !selecionados.length : rotulo === undefined

  return (
    <>
      <button
        type="button" ref={gatilho} disabled={disabled} aria-label={ariaLabel}
        aria-haspopup="listbox" aria-expanded={aberto} aria-controls={id}
        className={`sel ${aberto ? 'sel-aberto' : ''} ${tamanho === 'p' ? 'sel-p' : ''} ${className}`} style={style}
        onClick={() => (aberto ? fechar() : setAberto(true))} onKeyDown={teclaGatilho}
      >
        <span className={'sel-rotulo' + (vazio ? ' sel-vazio' : '')}>{vazio && !multi ? placeholder : rotulo}</span>
        {multi && selecionados.length > 0 && <span className="sel-contador">{selecionados.length}</span>}
        {limpar && !vazio && !disabled && (
          <span className="sel-limpar" role="button" aria-label="Limpar seleção"
            onClick={(e) => { e.stopPropagation(); onChange(multi ? [] : '') }}><X size={14} /></span>
        )}
        <ChevronDown size={16} className="sel-seta" />
      </button>
      {aberto && pos && createPortal(
        <div ref={painel} className={'sel-painel' + (pos.paraCima ? ' para-cima' : '')}
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }} onKeyDown={tecla}>
          {temBusca && (
            <div className="sel-busca">
              <Search size={15} />
              <input ref={buscaRef} value={termo} placeholder="Buscar…" onChange={(e) => { setTermo(e.target.value); setFoco(0) }} aria-label="Buscar opções" />
            </div>
          )}
          <div className="sel-lista" role="listbox" id={id} aria-multiselectable={multi} tabIndex={-1} ref={listaRef}>
            {filtradas.map((o, i) => {
              const sel = estaSel(o.value)
              return (
                <div key={String(o.value)} data-i={i} role="option" aria-selected={sel}
                  className={'sel-opcao' + (i === foco ? ' foco' : '') + (sel ? ' sel-marcada' : '')}
                  style={{ animationDelay: `${Math.min(i, 8) * 18}ms` }}
                  onMouseEnter={() => setFoco(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(o)}>
                  {multi && <span className={'chk-caixa' + (sel ? ' marcado' : '')} aria-hidden><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg></span>}
                  <span className="sel-opcao-texto">{o.label}{o.descricao && <small>{o.descricao}</small>}</span>
                  {!multi && sel && <Check size={16} className="sel-check" />}
                </div>
              )
            })}
            {!filtradas.length && <div className="sel-nada">Nada encontrado</div>}
          </div>
          {multi && options.length > 1 && (
            <div className="sel-rodape">
              <button type="button" onClick={() => onChange(options.map((o) => o.value))}>Selecionar todos</button>
              <button type="button" onClick={() => onChange([])}>Limpar</button>
            </div>
          )}
        </div>, document.body)}
    </>
  )
}
