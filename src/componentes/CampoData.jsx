import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Popover } from './Popover'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const pad = (n) => String(n).padStart(2, '0')
export const paraISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const deISO = (s) => { if (!s) return null; const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d) }
const paraBR = (s) => { const d = deISO(s); return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '' }
const mascara = (v) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2})\/(\d{2})(\d)/, '$1/$2/$3')
function brParaISO(s) {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const d = new Date(+m[3], +m[2] - 1, +m[1])
  return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 && +m[3] > 1900 ? paraISO(d) : null
}

/**
 * Campo de data universal: digitação com máscara dd/mm/aaaa + calendário.
 * value/onChange usam ISO (aaaa-mm-dd). min/max opcionais em ISO.
 */
export default function CampoData({ value, onChange, min, max, placeholder = 'dd/mm/aaaa', style, limpar = false, disabled, ariaLabel }) {
  const [texto, setTexto] = useState(paraBR(value))
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState(false)
  const ancora = useRef()
  const input = useRef()

  useEffect(() => { setTexto(paraBR(value)); setErro(false) }, [value])

  const foraDoLimite = (iso) => (min && iso < min) || (max && iso > max)

  function digitar(e) {
    const t = mascara(e.target.value)
    setTexto(t)
    setErro(false)
    if (t.length === 10) {
      const iso = brParaISO(t)
      if (iso && !foraDoLimite(iso)) onChange(iso)
      else setErro(true)
    } else if (!t && limpar) onChange('')
  }

  function sair() {
    if (texto && texto.length < 10) { setErro(true) }
    if (!texto && !limpar) setTexto(paraBR(value))
  }

  return (
    <div className={'data' + (erro ? ' data-erro' : '') + (aberto ? ' data-aberta' : '')} ref={ancora} style={style}>
      <input ref={input} value={texto} onChange={digitar} onBlur={sair} placeholder={placeholder} inputMode="numeric"
        disabled={disabled} aria-label={ariaLabel} aria-invalid={erro}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && e.altKey) setAberto(true) }} />
      {limpar && value && !disabled && <button type="button" className="data-btn data-limpar" onClick={() => onChange('')} aria-label="Limpar data"><X size={14} /></button>}
      <button type="button" className="data-btn" disabled={disabled} onClick={() => setAberto(!aberto)} aria-label="Abrir calendário"><CalendarDays size={16} /></button>
      <Popover ancora={ancora} aberto={aberto} onFechar={() => setAberto(false)} largura={292} className="cal-pop">
        <Calendario value={value} min={min} max={max} onEscolher={(iso) => { onChange(iso); setAberto(false); input.current?.focus() }} />
      </Popover>
    </div>
  )
}

export function Calendario({ value, min, max, onEscolher, inicio, fim }) {
  const sel = deISO(value)
  const [ref, setRef] = useState(() => { const d = sel || new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [visao, setVisao] = useState('dias')
  const [dir, setDir] = useState(0)
  const hoje = paraISO(new Date())

  const dias = useMemo(() => {
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1)
    const comeco = new Date(primeiro); comeco.setDate(1 - primeiro.getDay())
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(comeco); d.setDate(comeco.getDate() + i); return d })
  }, [ref])

  const mudarMes = (n) => { setDir(n); setRef(new Date(ref.getFullYear(), ref.getMonth() + n, 1)) }
  const bloqueado = (iso) => (min && iso < min) || (max && iso > max)
  const anoBase = Math.floor(ref.getFullYear() / 12) * 12

  return (
    <div className="cal">
      <div className="cal-topo">
        <button type="button" className="cal-nav" onClick={() => (visao === 'dias' ? mudarMes(-1) : setRef(new Date(ref.getFullYear() - (visao === 'anos' ? 12 : 1), ref.getMonth(), 1)))} aria-label="Anterior"><ChevronLeft size={16} /></button>
        <button type="button" className="cal-titulo" onClick={() => setVisao(visao === 'dias' ? 'meses' : visao === 'meses' ? 'anos' : 'dias')}>
          {visao === 'dias' && <>{MESES[ref.getMonth()]} <span>{ref.getFullYear()}</span></>}
          {visao === 'meses' && ref.getFullYear()}
          {visao === 'anos' && `${anoBase} – ${anoBase + 11}`}
        </button>
        <button type="button" className="cal-nav" onClick={() => (visao === 'dias' ? mudarMes(1) : setRef(new Date(ref.getFullYear() + (visao === 'anos' ? 12 : 1), ref.getMonth(), 1)))} aria-label="Próximo"><ChevronRight size={16} /></button>
      </div>

      {visao === 'dias' && <>
        <div className="cal-semana">{SEMANA.map((s, i) => <span key={i}>{s}</span>)}</div>
        <div className={'cal-dias' + (dir > 0 ? ' prox' : dir < 0 ? ' ant' : '')} key={ref.getTime()}>
          {dias.map((d) => {
            const iso = paraISO(d)
            const outro = d.getMonth() !== ref.getMonth()
            const noIntervalo = inicio && fim && iso > inicio && iso < fim
            return (
              <button type="button" key={iso} disabled={bloqueado(iso)} onClick={() => onEscolher(iso)}
                className={'cal-dia' + (outro ? ' outro' : '') + (iso === hoje ? ' hoje' : '') + (iso === value || iso === inicio || iso === fim ? ' sel' : '') + (noIntervalo ? ' faixa' : '')}>
                {d.getDate()}
              </button>
            )
          })}
        </div>
      </>}

      {visao === 'meses' && (
        <div className="cal-grade">
          {MESES.map((m, i) => (
            <button type="button" key={m} className={'cal-cel' + (sel && sel.getMonth() === i && sel.getFullYear() === ref.getFullYear() ? ' sel' : '')}
              onClick={() => { setRef(new Date(ref.getFullYear(), i, 1)); setVisao('dias') }}>{m.slice(0, 3)}</button>
          ))}
        </div>
      )}
      {visao === 'anos' && (
        <div className="cal-grade">
          {Array.from({ length: 12 }, (_, i) => anoBase + i).map((a) => (
            <button type="button" key={a} className={'cal-cel' + (sel?.getFullYear() === a ? ' sel' : '')}
              onClick={() => { setRef(new Date(a, ref.getMonth(), 1)); setVisao('meses') }}>{a}</button>
          ))}
        </div>
      )}

      <div className="cal-rodape">
        <button type="button" disabled={bloqueado(hoje)} onClick={() => onEscolher(hoje)}>Hoje</button>
        {value && <span className="suave">{paraBR(value)}</span>}
      </div>
    </div>
  )
}

/* Período com atalhos (Hoje, 7 dias, Este mês, Mês passado) */
export function Periodo({ de, ate, onChange }) {
  const hoje = new Date()
  const atalhos = [
    ['Hoje', paraISO(hoje), paraISO(hoje)],
    ['7 dias', paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6)), paraISO(hoje)],
    ['Este mês', paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), paraISO(hoje)],
    ['Mês passado', paraISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)), paraISO(new Date(hoje.getFullYear(), hoje.getMonth(), 0))],
  ]
  return (
    <div className="periodo">
      <div className="periodo-atalhos">
        {atalhos.map(([r, a, b]) => (
          <button type="button" key={r} className={de === a && ate === b ? 'ativo' : ''} onClick={() => onChange(a, b)}>{r}</button>
        ))}
      </div>
      <CampoData value={de} max={ate} onChange={(v) => v && onChange(v, ate)} style={{ width: 150 }} ariaLabel="Data inicial" />
      <span className="suave">até</span>
      <CampoData value={ate} min={de} onChange={(v) => v && onChange(de, v)} style={{ width: 150 }} ariaLabel="Data final" />
    </div>
  )
}
