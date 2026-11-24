import { useMemo, useRef, useState } from 'react'
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, Search, X } from 'lucide-react'
import { Popover } from './Popover'
import { paraISO } from './CampoData'
import { SkeletonLinhas } from './Skeleton'

const brData = (iso) => iso.split('-').reverse().join('/')

// chave usada para agrupar valores no filtro (datas agrupadas por dia)
function chaveFiltro(c, v) {
  if (v == null || v === '') return ''
  if (c.tipo === 'data') return paraISO(new Date(v))
  if (c.tipo === 'numero') return String(Number(v))
  return String(v)
}

// texto exibido para uma opção do filtro
function rotuloFiltro(c, k, linha) {
  if (k === '') return '(vazio)'
  if (c.rotulo) return String(c.rotulo(k))
  if (c.tipo === 'data') return brData(k)
  if (linha && c.render) {
    const r = c.render(linha)
    if (typeof r === 'string' || typeof r === 'number') return String(r)
  }
  if (c.tipo === 'numero') return Number(k).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
  return k
}

const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Tabela universal com ordenação e filtro por coluna.
 *
 * colunas: [{
 *   chave, titulo,
 *   valor?: (linha) => valor usado para ordenar/filtrar (padrão linha[chave]),
 *   render?: (linha) => conteúdo da célula,
 *   tipo?: 'texto' | 'numero' | 'data' | 'opcoes'   (padrão 'texto'),
 *   rotulo?: (valor) => texto exibido no filtro de opções,
 *   alinhar?: 'direita', ordenavel?: bool, filtravel?: bool, classe?: string, quebrar?: bool
 * }]
 * dados: array (ou null enquanto carrega)
 */
export default function Tabela({ colunas, dados, chave = (l) => l.id, vazio = 'Nenhum registro', acoes, linhaProps, ordemInicial, rodape }) {
  const [ordem, setOrdem] = useState(ordemInicial || null) // { chave, dir: 1 | -1 }
  const [filtros, setFiltros] = useState({})
  const [aberto, setAberto] = useState(null)

  const valorDe = (c, l) => (c.valor ? c.valor(l) : l[c.chave])

  const visiveis = useMemo(() => {
    if (!dados) return null
    let r = dados.filter((l) => colunas.every((c) => {
      const f = filtros[c.chave]
      if (f == null) return true
      return f.includes(chaveFiltro(c, valorDe(c, l)))
    }))
    if (ordem) {
      const c = colunas.find((x) => x.chave === ordem.chave)
      if (c) {
        r = [...r].sort((a, b) => {
          const va = valorDe(c, a), vb = valorDe(c, b)
          if (va == null || va === '') return 1
          if (vb == null || vb === '') return -1
          if (c.tipo === 'numero') return (Number(va) - Number(vb)) * ordem.dir
          if (c.tipo === 'data') return (new Date(va) - new Date(vb)) * ordem.dir
          return String(c.rotulo ? c.rotulo(va) : va).localeCompare(String(c.rotulo ? c.rotulo(vb) : vb), 'pt-BR', { numeric: true, sensitivity: 'base' }) * ordem.dir
        })
      }
    }
    return r
  }, [dados, filtros, ordem, colunas])

  const ordenar = (c) => {
    if (c.ordenavel === false) return
    setOrdem((o) => (!o || o.chave !== c.chave ? { chave: c.chave, dir: 1 } : o.dir === 1 ? { chave: c.chave, dir: -1 } : null))
  }
  const setFiltro = (k, v) => setFiltros((f) => { const n = { ...f }; if (v == null) delete n[k]; else n[k] = v; return n })
  const qtdFiltros = Object.keys(filtros).length
  const ncol = colunas.length + (acoes ? 1 : 0)

  return (
    <>
      {qtdFiltros > 0 && (
        <div className="tab-filtros">
          <span className="suave">Filtros:</span>
          {Object.entries(filtros).map(([k, f]) => {
            const c = colunas.find((x) => x.chave === k)
            return (
              <span key={k} className="tab-chip">
                <b>{c.titulo}</b> {descreverFiltro(c, f)}
                <button onClick={() => setFiltro(k, null)} aria-label={`Remover filtro ${c.titulo}`}><X size={12} /></button>
              </span>
            )
          })}
          <button className="tab-limpar" onClick={() => setFiltros({})}>Limpar todos</button>
        </div>
      )}
      <div className="tabela-wrap"><table className="tab">
        <thead><tr>
          {colunas.map((c) => {
            const ativo = ordem?.chave === c.chave
            const temFiltro = filtros[c.chave] != null
            return (
              <th key={c.chave} className={(c.alinhar === 'direita' ? 'direita ' : '') + (ativo ? 'ordenada' : '')}
                aria-sort={ativo ? (ordem.dir === 1 ? 'ascending' : 'descending') : undefined}>
                <div className="th">
                  <button type="button" className="th-titulo" onClick={() => ordenar(c)} disabled={c.ordenavel === false}>
                    {c.titulo}
                    {c.ordenavel !== false && (
                      <span className="th-ordem">{ativo ? (ordem.dir === 1 ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUpDown size={13} />}</span>
                    )}
                  </button>
                  {c.filtravel !== false && dados && (
                    <FiltroColuna coluna={c} dados={dados} valorDe={(l) => valorDe(c, l)} valor={filtros[c.chave]}
                      aberto={aberto === c.chave} setAberto={(v) => setAberto(v ? c.chave : null)}
                      onAplicar={(v) => setFiltro(c.chave, v)} ativo={temFiltro} />
                  )}
                </div>
              </th>
            )
          })}
          {acoes && <th />}
        </tr></thead>
        <tbody>
          {visiveis === null && <SkeletonLinhas colunas={ncol} />}
          {visiveis?.map((l, i) => {
            const extra = linhaProps?.(l) || {}
            return (
              <tr key={chave(l, i)} {...extra}>
                {colunas.map((c) => (
                  <td key={c.chave} className={(c.alinhar === 'direita' ? 'direita ' : '') + (c.classe || '')} style={c.quebrar ? { whiteSpace: 'normal' } : undefined}>
                    {c.render ? c.render(l) : (valorDe(c, l) ?? '—')}
                  </td>
                ))}
                {acoes && <td className="direita tab-acoes">{acoes(l)}</td>}
              </tr>
            )
          })}
          {visiveis && !visiveis.length && (
            <tr><td colSpan={ncol} className="vazio">{dados.length && qtdFiltros ? 'Nenhum registro corresponde aos filtros' : vazio}</td></tr>
          )}
        </tbody>
      </table></div>
      {visiveis && dados.length > 0 && (
        <div className="tab-rodape">
          <span>{visiveis.length === dados.length ? `${dados.length} registro${dados.length > 1 ? 's' : ''}` : `${visiveis.length} de ${dados.length} registros`}</span>
          {rodape?.(visiveis)}
        </div>
      )}
    </>
  )
}

function descreverFiltro(c, f) {
  return f.length === 1 ? rotuloFiltro(c, f[0]) : `${f.length} selecionados`
}

function FiltroColuna({ coluna: c, dados, valorDe, valor, aberto, setAberto, onAplicar, ativo }) {
  const ancora = useRef()
  return (
    <>
      <button type="button" ref={ancora} className={'th-filtro' + (ativo ? ' ativo' : '') + (aberto ? ' aberto' : '')}
        onClick={() => setAberto(!aberto)} aria-label={`Filtrar ${c.titulo}`} title={`Filtrar ${c.titulo}`}>
        <Filter size={12} />
      </button>
      <Popover ancora={ancora} aberto={aberto} onFechar={() => setAberto(false)} largura={260} alinhar={c.alinhar === 'direita' ? 'fim' : 'inicio'} className="filtro-pop">
        <PainelFiltro c={c} dados={dados} valorDe={valorDe} valor={valor}
          aplicar={(v) => { onAplicar(v); setAberto(false) }} fechar={() => setAberto(false)} />
      </Popover>
    </>
  )
}

function PainelFiltro({ c, dados, valorDe, valor, aplicar }) {
  const opcoes = useMemo(() => {
    const mapa = new Map()
    dados.forEach((l) => {
      const k = chaveFiltro(c, valorDe(l))
      const o = mapa.get(k)
      if (o) o.n++
      else mapa.set(k, { v: k, n: 1, r: rotuloFiltro(c, k, l) })
    })
    const lista = [...mapa.values()]
    if (c.tipo === 'numero') return lista.sort((a, b) => (a.v === '') - (b.v === '') || Number(a.v) - Number(b.v))
    if (c.tipo === 'data') return lista.sort((a, b) => (a.v === '') - (b.v === '') || b.v.localeCompare(a.v))
    return lista.sort((a, b) => a.r.localeCompare(b.r, 'pt-BR', { numeric: true, sensitivity: 'base' }))
  }, [dados])
  const [marcados, setMarcados] = useState(() => new Set(valor || opcoes.map((o) => o.v)))
  const [busca, setBusca] = useState('')

  function confirmar(e) {
    e?.preventDefault()
    aplicar(marcados.size === opcoes.length ? null : [...marcados])
  }

  const filtradas = opcoes.filter((o) => normalizar(o.r).includes(normalizar(busca)))
  const todosVis = filtradas.length > 0 && filtradas.every((o) => marcados.has(o.v))
  const alternar = (v) => setMarcados((m) => { const n = new Set(m); n.has(v) ? n.delete(v) : n.add(v); return n })

  return (
    <form className="filtro" onSubmit={confirmar}>
      <div className="filtro-titulo"><Filter size={13} /> Filtrar “{c.titulo}”</div>
      {opcoes.length > 6 && <div className="filtro-busca"><Search size={14} /><input autoFocus placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>}
        <div className="filtro-lista">
          <label className="filtro-op filtro-todos">
            <input type="checkbox" checked={todosVis} onChange={(e) => setMarcados((m) => { const n = new Set(m); filtradas.forEach((o) => (e.target.checked ? n.add(o.v) : n.delete(o.v))); return n })} />
            <span className={'chk-caixa' + (todosVis ? ' marcado' : '')}><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg></span>
            <span>{busca ? '(Selecionar resultados)' : '(Selecionar todos)'}</span>
          </label>
          {filtradas.map((o) => (
            <label key={o.v} className="filtro-op">
              <input type="checkbox" checked={marcados.has(o.v)} onChange={() => alternar(o.v)} />
              <span className={'chk-caixa' + (marcados.has(o.v) ? ' marcado' : '')}><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg></span>
              <span className="filtro-op-r">{o.r}</span><small>{o.n}</small>
            </label>
          ))}
          {!filtradas.length && <div className="sel-nada">Nada encontrado</div>}
        </div>
      <div className="filtro-acoes">
        <button type="button" className="btn btn-fantasma" onClick={() => aplicar(null)}>Limpar</button>
        <button type="submit" className="btn btn-primario" disabled={!marcados.size}>Aplicar</button>
      </div>
    </form>
  )
}
