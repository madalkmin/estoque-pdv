import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, Tags } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, num, parseNum } from '../lib/formato'
import { Cabecalho, Campo, Modal, useAcao } from '../componentes/ui'

const novaVariacao = () => ({ nome: 'Padrão', sku: '', codigo_barras: '', preco_custo: '', preco_venda: '', estoque: '', estoque_minimo: '' })

export default function Produtos() {
  const { admin } = useAuth()
  const [produtos, setProdutos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState('')
  const [filtro, setFiltro] = useState('')
  const [editando, setEditando] = useState(null)
  const [ajuste, setAjuste] = useState(null)
  const [verCategorias, setVerCategorias] = useState(false)

  async function carregar() {
    const [p, c] = await Promise.all([
      supabase.from('produtos').select('*, categorias(nome), variacoes(*)').eq('ativo', true).order('nome'),
      supabase.from('categorias').select('*').order('nome'),
    ])
    setProdutos((p.data || []).map((x) => ({ ...x, variacoes: x.variacoes.filter((v) => v.ativo).sort((a, b) => a.id - b.id) })))
    setCategorias(c.data || [])
  }
  useEffect(() => { carregar() }, [])

  const lista = useMemo(() => {
    const t = busca.toLowerCase()
    return produtos.filter((p) =>
      (!cat || String(p.categoria_id) === cat) &&
      (!t || p.nome.toLowerCase().includes(t) || p.variacoes.some((v) => v.codigo_barras?.includes(t) || v.sku?.toLowerCase().includes(t))) &&
      (!filtro || p.variacoes.some((v) => filtro === 'zerado' ? v.estoque <= 0 : Number(v.estoque) <= Number(v.estoque_minimo))))
  }, [produtos, busca, cat, filtro])

  return (
    <>
      <Cabecalho titulo="Produtos" descricao={`${produtos.length} produtos cadastrados`}>
        {admin && <button className="btn" onClick={() => setVerCategorias(true)}><Tags size={16} /> Categorias</button>}
        {admin && <button className="btn btn-primario" onClick={() => setEditando({ nome: '', descricao: '', categoria_id: '', variacoes: [novaVariacao()] })}><Plus size={16} /> Novo produto</button>}
      </Cabecalho>
      <div className="card">
        <div className="linha" style={{ marginBottom: 14 }}>
          <div className="busca"><Search size={16} /><input placeholder="Buscar por nome, SKU ou código de barras" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <select style={{ width: 180 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select style={{ width: 170 }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="">Todo o estoque</option><option value="baixo">Estoque baixo</option><option value="zerado">Sem estoque</option>
          </select>
        </div>
        <div className="tabela-wrap"><table>
          <thead><tr><th>Produto</th><th>Variação</th><th>Código</th>{admin && <th className="direita">Custo</th>}<th className="direita">Preço</th><th className="direita">Estoque</th>{admin && <th />}</tr></thead>
          <tbody>
            {lista.flatMap((p) => p.variacoes.map((v, i) => (
              <tr key={v.id}>
                <td>{i === 0 && <><b>{p.nome}</b><div className="suave" style={{ fontSize: 12 }}>{p.categorias?.nome}</div></>}</td>
                <td>{v.nome}</td>
                <td className="suave num">{v.codigo_barras || v.sku || '—'}</td>
                {admin && <td className="direita num">{brl(v.preco_custo)}</td>}
                <td className="direita num">{brl(v.preco_venda)}</td>
                <td className="direita">
                  <span className={'selo ' + (v.estoque <= 0 ? 'perigo' : Number(v.estoque) <= Number(v.estoque_minimo) ? 'alerta' : 'ok')}>{num(v.estoque)}</span>
                </td>
                {admin && <td className="direita">
                  <button className="btn btn-icone btn-fantasma" title="Ajustar estoque" onClick={() => setAjuste({ v, p })}><SlidersHorizontal size={16} /></button>
                  {i === 0 && <button className="btn btn-icone btn-fantasma" title="Editar" onClick={() => setEditando(p)}><Pencil size={16} /></button>}
                </td>}
              </tr>
            )))}
            {!lista.length && <tr><td colSpan={7} className="vazio">Nenhum produto encontrado</td></tr>}
          </tbody>
        </table></div>
      </div>
      {editando && <EditarProduto produto={editando} categorias={categorias} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar() }} />}
      {ajuste && <AjustarEstoque {...ajuste} onFechar={() => setAjuste(null)} onSalvo={() => { setAjuste(null); carregar() }} />}
      {verCategorias && <Categorias categorias={categorias} onFechar={() => { setVerCategorias(false); carregar() }} />}
    </>
  )
}

function EditarProduto({ produto, categorias, onFechar, onSalvo }) {
  const novo = !produto.id
  const [p, setP] = useState({ nome: produto.nome, descricao: produto.descricao || '', categoria_id: produto.categoria_id || '' })
  const [vars, setVars] = useState(produto.variacoes.map((v) => ({ ...v })))
  const [removidas, setRemovidas] = useState([])
  const [executar, ocupado] = useAcao()

  const setV = (i, k, val) => setVars(vars.map((v, j) => (j === i ? { ...v, [k]: val } : v)))

  async function salvar() {
    if (!p.nome.trim()) throw new Error('Informe o nome do produto')
    if (!vars.length) throw new Error('O produto precisa de ao menos uma variação')
    const dados = { nome: p.nome.trim(), descricao: p.descricao || null, categoria_id: p.categoria_id || null }
    const prod = novo
      ? checar(await supabase.from('produtos').insert(dados).select().single())
      : checar(await supabase.from('produtos').update(dados).eq('id', produto.id).select().single())

    for (const v of vars) {
      const linha = {
        produto_id: prod.id, nome: v.nome?.trim() || 'Padrão', sku: v.sku || null, codigo_barras: v.codigo_barras?.trim() || null,
        preco_custo: parseNum(v.preco_custo), preco_venda: parseNum(v.preco_venda), estoque_minimo: parseNum(v.estoque_minimo),
      }
      if (v.id) checar(await supabase.from('variacoes').update(linha).eq('id', v.id))
      else {
        const nova = checar(await supabase.from('variacoes').insert(linha).select().single())
        const inicial = parseNum(v.estoque)
        if (inicial) checar(await supabase.rpc('ajustar_estoque', { p_variacao: nova.id, p_modo: 'entrada', p_quantidade: inicial, p_motivo: 'Estoque inicial' }))
      }
    }
    for (const id of removidas) checar(await supabase.from('variacoes').update({ ativo: false }).eq('id', id))
  }

  async function excluir() {
    if (!confirm('Desativar este produto? Ele some das listas, mas o histórico de vendas é mantido.')) return
    await executar(async () => checar(await supabase.from('produtos').update({ ativo: false }).eq('id', produto.id)), 'Produto desativado')
    onSalvo()
  }

  return (
    <Modal largo titulo={novo ? 'Novo produto' : 'Editar produto'} onFechar={onFechar} rodape={<>
      {!novo && <button className="btn btn-perigo" style={{ marginRight: 'auto' }} onClick={excluir}><Trash2 size={16} /> Desativar</button>}
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <button className="btn btn-primario" disabled={ocupado} onClick={() => executar(salvar, 'Produto salvo').then(onSalvo, () => {})}>Salvar</button>
    </>}>
      <div className="form">
        <Campo label="Nome"><input autoFocus value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></Campo>
        <Campo label="Categoria">
          <select value={p.categoria_id} onChange={(e) => setP({ ...p, categoria_id: e.target.value })}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Descrição" inteiro><input value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} /></Campo>
      </div>
      <div className="linha" style={{ justifyContent: 'space-between', margin: '20px 0 8px' }}>
        <h3>Variações (tamanho, cor…)</h3>
        <button className="btn" onClick={() => setVars([...vars, { ...novaVariacao(), nome: '' }])}><Plus size={16} /> Variação</button>
      </div>
      {vars.map((v, i) => (
        <div key={v.id || 'n' + i} className="card" style={{ padding: 12, marginTop: 8 }}>
          <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <Campo label="Nome"><input value={v.nome} placeholder="Ex.: M / Azul" onChange={(e) => setV(i, 'nome', e.target.value)} /></Campo>
            <Campo label="Código de barras"><input value={v.codigo_barras || ''} onChange={(e) => setV(i, 'codigo_barras', e.target.value)} /></Campo>
            <Campo label="SKU"><input value={v.sku || ''} onChange={(e) => setV(i, 'sku', e.target.value)} /></Campo>
            <Campo label="Custo (R$)"><input inputMode="decimal" value={v.preco_custo} onChange={(e) => setV(i, 'preco_custo', e.target.value)} /></Campo>
            <Campo label="Preço (R$)"><input inputMode="decimal" value={v.preco_venda} onChange={(e) => setV(i, 'preco_venda', e.target.value)} /></Campo>
            {!v.id && <Campo label="Estoque inicial"><input inputMode="decimal" value={v.estoque} onChange={(e) => setV(i, 'estoque', e.target.value)} /></Campo>}
            <Campo label="Estoque mínimo"><input inputMode="decimal" value={v.estoque_minimo} onChange={(e) => setV(i, 'estoque_minimo', e.target.value)} /></Campo>
          </div>
          {vars.length > 1 && <button className="btn btn-perigo btn-fantasma" style={{ marginTop: 6 }} onClick={() => { if (v.id) setRemovidas([...removidas, v.id]); setVars(vars.filter((_, j) => j !== i)) }}><Trash2 size={15} /> Remover variação</button>}
        </div>
      ))}
    </Modal>
  )
}

function AjustarEstoque({ v, p, onFechar, onSalvo }) {
  const [modo, setModo] = useState('entrada')
  const [qtd, setQtd] = useState('')
  const [motivo, setMotivo] = useState('')
  const [executar, ocupado] = useAcao()
  const salvar = () => executar(async () => checar(await supabase.rpc('ajustar_estoque', {
    p_variacao: v.id, p_modo: modo, p_quantidade: parseNum(qtd), p_motivo: motivo || null,
  })), 'Estoque atualizado').then(onSalvo, () => {})

  return (
    <Modal titulo="Ajustar estoque" onFechar={onFechar} rodape={<>
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <button className="btn btn-primario" disabled={ocupado || qtd === ''} onClick={salvar}>Confirmar</button>
    </>}>
      <p style={{ marginTop: 0 }}><b>{p.nome}</b> {v.nome !== 'Padrão' && `— ${v.nome}`}<br /><span className="suave">Estoque atual: {num(v.estoque)}</span></p>
      <div className="form">
        <Campo label="Tipo">
          <select value={modo} onChange={(e) => setModo(e.target.value)}>
            <option value="entrada">Entrada (+)</option><option value="saida">Saída / perda (−)</option><option value="ajuste">Definir quantidade exata</option>
          </select>
        </Campo>
        <Campo label={modo === 'ajuste' ? 'Nova quantidade' : 'Quantidade'}><input autoFocus inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} /></Campo>
        <Campo label="Motivo" inteiro><input value={motivo} placeholder="Ex.: inventário, avaria, devolução" onChange={(e) => setMotivo(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}

function Categorias({ categorias, onFechar }) {
  const [lista, setLista] = useState(categorias)
  const [nome, setNome] = useState('')
  const [executar] = useAcao()
  const recarregar = async () => setLista((await supabase.from('categorias').select('*').order('nome')).data || [])
  return (
    <Modal titulo="Categorias" onFechar={onFechar}>
      <form className="linha" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) executar(async () => { checar(await supabase.from('categorias').insert({ nome: nome.trim() })); setNome(''); await recarregar() }).catch(() => {}) }}>
        <input placeholder="Nova categoria" value={nome} onChange={(e) => setNome(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primario"><Plus size={16} /> Adicionar</button>
      </form>
      <div className="tabela-wrap" style={{ marginTop: 10 }}><table><tbody>
        {lista.map((c) => (
          <tr key={c.id}><td>{c.nome}</td><td className="direita">
            <button className="btn btn-icone btn-fantasma btn-perigo" onClick={() => confirm(`Excluir "${c.nome}"?`) && executar(async () => { checar(await supabase.from('categorias').delete().eq('id', c.id)); await recarregar() }).catch(() => {})}><Trash2 size={15} /></button>
          </td></tr>
        ))}
        {!lista.length && <tr><td className="vazio">Nenhuma categoria</td></tr>}
      </tbody></table></div>
    </Modal>
  )
}
