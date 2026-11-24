import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, SlidersHorizontal, Tags } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, num, parseNum } from '../lib/formato'
import { mascaras, sanitizar } from '../lib/mascaras'
import { Cabecalho, Campo, Modal, useAcao, Botao } from '../componentes/ui'
import { SkeletonLinhas } from '../componentes/Skeleton'
import Select from '../componentes/Select'
import Checkbox from '../componentes/Checkbox'
import { Input } from '../componentes/Input'
import Tabela from '../componentes/Tabela'
import { confirmar } from '../lib/notificar'

const novaVariacao = () => ({ nome: 'Padrão', sku: '', codigo_barras: '', preco_custo: '', preco_venda: '', estoque: '', estoque_minimo: '' })

export default function Produtos() {
  const { admin } = useAuth()
  const [produtos, setProdutos] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [busca, setBusca] = useState('')
  const [cat, setCat] = useState([])
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
    return (produtos || []).filter((p) =>
      (!cat.length || cat.includes(p.categoria_id ?? 0)) &&
      (!t || p.nome.toLowerCase().includes(t) || p.variacoes.some((v) => v.codigo_barras?.includes(t) || v.sku?.toLowerCase().includes(t))) &&
      (!filtro || p.variacoes.some((v) => filtro === 'zerado' ? v.estoque <= 0 : Number(v.estoque) <= Number(v.estoque_minimo))))
  }, [produtos, busca, cat, filtro])

  return (
    <>
      <Cabecalho titulo="Produtos" descricao={produtos ? `${produtos.length} produtos cadastrados` : ' '}>
        {admin && <button className="btn" onClick={() => setVerCategorias(true)}><Tags size={16} /> Categorias</button>}
        {admin && <button className="btn btn-primario" onClick={() => setEditando({ nome: '', descricao: '', categoria_id: '', variacoes: [novaVariacao()] })}><Plus size={16} /> Novo produto</button>}
      </Cabecalho>
      <div className="card">
        <div className="linha" style={{ marginBottom: 14 }}>
          <div className="busca"><Search size={16} /><input placeholder="Buscar por nome, SKU ou código de barras" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <Select multi style={{ width: 210 }} value={cat} onChange={setCat} todosLabel="Todas as categorias"
            options={[...categorias.map((c) => ({ value: c.id, label: c.nome })), { value: 0, label: 'Sem categoria' }]} />
          <Select style={{ width: 180 }} value={filtro} onChange={setFiltro} limpar={false}
            options={[{ value: '', label: 'Todo o estoque' }, { value: 'baixo', label: 'Estoque baixo', descricao: 'No mínimo ou abaixo' }, { value: 'zerado', label: 'Sem estoque' }]} />
        </div>
        <Tabela
          dados={produtos === null ? null : lista.flatMap((p) => p.variacoes.map((v) => ({ ...v, p })))}
          vazio="Nenhum produto encontrado"
          ordemInicial={{ chave: 'produto', dir: 1 }}
          colunas={[
            { chave: 'produto', titulo: 'Produto', valor: (v) => v.p.nome, render: (v) => <b>{v.p.nome}</b> },
            { chave: 'categoria', titulo: 'Categoria', tipo: 'opcoes', valor: (v) => v.p.categorias?.nome || '', classe: 'suave', render: (v) => v.p.categorias?.nome || '—' },
            { chave: 'nome', titulo: 'Variação', tipo: 'opcoes' },
            { chave: 'codigo', titulo: 'Código', valor: (v) => v.codigo_barras || v.sku || '', classe: 'suave num', render: (v) => v.codigo_barras || v.sku || '—' },
            ...(admin ? [{ chave: 'preco_custo', titulo: 'Custo', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (v) => brl(v.preco_custo) }] : []),
            { chave: 'preco_venda', titulo: 'Preço', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (v) => brl(v.preco_venda) },
            { chave: 'estoque', titulo: 'Estoque', tipo: 'numero', alinhar: 'direita',
              render: (v) => <span className={'selo ' + (v.estoque <= 0 ? 'perigo' : Number(v.estoque) <= Number(v.estoque_minimo) ? 'alerta' : 'ok')}>{num(v.estoque)}</span> },
          ]}
          acoes={admin ? (v) => <>
            <button className="btn btn-icone btn-fantasma" title="Ajustar estoque" onClick={() => setAjuste({ v, p: v.p })}><SlidersHorizontal size={16} /></button>
            <button className="btn btn-icone btn-fantasma" title="Editar produto" onClick={() => setEditando(v.p)}><Pencil size={16} /></button>
          </> : undefined}
        />
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
  const dec = (n) => mascaras.moedaDe(n)
  const [vars, setVars] = useState(produto.variacoes.map((v) => ({ ...v, preco_custo: dec(v.preco_custo), preco_venda: dec(v.preco_venda), estoque_minimo: v.estoque_minimo ? String(Number(v.estoque_minimo)).replace('.', ',') : '' })))
  const [removidas, setRemovidas] = useState([])
  const [executar, ocupado] = useAcao()

  const setV = (i, k, val) => setVars(vars.map((v, j) => (j === i ? { ...v, [k]: val } : v)))

  async function salvar() {
    if (!p.nome.trim()) throw new Error('Informe o nome do produto')
    if (!vars.length) throw new Error('O produto precisa de ao menos uma variação')
    const dados = { nome: sanitizar(p.nome, 120), descricao: sanitizar(p.descricao, 500) || null, categoria_id: p.categoria_id || null }
    const prod = novo
      ? checar(await supabase.from('produtos').insert(dados).select().single())
      : checar(await supabase.from('produtos').update(dados).eq('id', produto.id).select().single())

    for (const v of vars) {
      const linha = {
        produto_id: prod.id, nome: sanitizar(v.nome, 60) || 'Padrão', sku: sanitizar(v.sku, 40) || null, codigo_barras: sanitizar(v.codigo_barras, 50).replace(/\s/g, '') || null,
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
    if (!(await confirmar({ titulo: 'Desativar produto?', mensagem: 'Ele some das listas e do caixa, mas o histórico de vendas é mantido.', tipo: 'perigo', confirmar: 'Desativar' }))) return
    await executar(async () => checar(await supabase.from('produtos').update({ ativo: false }).eq('id', produto.id)), 'Produto desativado')
    onSalvo()
  }

  return (
    <Modal largo titulo={novo ? 'Novo produto' : 'Editar produto'} onFechar={onFechar} rodape={<>
      {!novo && <button className="btn btn-perigo" style={{ marginRight: 'auto' }} onClick={excluir}><Trash2 size={16} /> Desativar</button>}
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <Botao className="btn-primario" carregando={ocupado} onClick={() => executar(salvar, 'Produto salvo').then(onSalvo, () => {})}>Salvar</Botao>
    </>}>
      <div className="form">
        <Campo label="Nome"><Input autoFocus maxLength={120} value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></Campo>
        <Campo label="Categoria">
          <Select value={p.categoria_id} onChange={(v) => setP({ ...p, categoria_id: v })} limpar placeholder="Sem categoria"
            options={categorias.map((c) => ({ value: c.id, label: c.nome }))} />
        </Campo>
        <Campo label="Descrição" inteiro><Input maxLength={500} value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} /></Campo>
      </div>
      <div className="linha" style={{ justifyContent: 'space-between', margin: '20px 0 8px' }}>
        <h3>Variações (tamanho, cor…)</h3>
        <button className="btn" onClick={() => setVars([...vars, { ...novaVariacao(), nome: '' }])}><Plus size={16} /> Variação</button>
      </div>
      {vars.map((v, i) => (
        <div key={v.id || 'n' + i} className="card" style={{ padding: 12, marginTop: 8 }}>
          <div className="form" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <Campo label="Nome"><Input maxLength={60} value={v.nome} placeholder="Ex.: M / Azul" onChange={(e) => setV(i, 'nome', e.target.value)} /></Campo>
            <Campo label="Código de barras"><Input maxLength={50} value={v.codigo_barras || ''} placeholder="Bipe ou digite" onChange={(e) => setV(i, 'codigo_barras', e.target.value)} /></Campo>
            <Campo label="SKU"><Input maxLength={40} value={v.sku || ''} onChange={(e) => setV(i, 'sku', e.target.value)} /></Campo>
            <Campo label="Custo (R$)"><Input mascara="moeda" value={v.preco_custo} onChange={(e) => setV(i, 'preco_custo', e.target.value)} /></Campo>
            <Campo label="Preço (R$)"><Input mascara="moeda" value={v.preco_venda} onChange={(e) => setV(i, 'preco_venda', e.target.value)} /></Campo>
            {!v.id && <Campo label="Estoque inicial"><Input mascara="quantidade" placeholder="0" value={v.estoque} onChange={(e) => setV(i, 'estoque', e.target.value)} /></Campo>}
            <Campo label="Estoque mínimo"><Input mascara="quantidade" placeholder="0" value={v.estoque_minimo} onChange={(e) => setV(i, 'estoque_minimo', e.target.value)} /></Campo>
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
    p_variacao: v.id, p_modo: modo, p_quantidade: parseNum(qtd), p_motivo: sanitizar(motivo) || null,
  })), 'Estoque atualizado').then(onSalvo, () => {})

  return (
    <Modal titulo="Ajustar estoque" onFechar={onFechar} rodape={<>
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <Botao className="btn-primario" carregando={ocupado} disabled={qtd === ''} onClick={salvar}>Confirmar</Botao>
    </>}>
      <p style={{ marginTop: 0 }}><b>{p.nome}</b> {v.nome !== 'Padrão' && `— ${v.nome}`}<br /><span className="suave">Estoque atual: {num(v.estoque)}</span></p>
      <div className="form">
        <Campo label="Tipo">
          <Select value={modo} onChange={setModo} options={[
            { value: 'entrada', label: 'Entrada (+)', descricao: 'Soma ao estoque atual' },
            { value: 'saida', label: 'Saída / perda (−)', descricao: 'Subtrai do estoque atual' },
            { value: 'ajuste', label: 'Definir quantidade exata', descricao: 'Ex.: após inventário' },
          ]} />
        </Campo>
        <Campo label={modo === 'ajuste' ? 'Nova quantidade' : 'Quantidade'}><Input autoFocus mascara="quantidade" value={qtd} onChange={(e) => setQtd(e.target.value)} /></Campo>
        <Campo label="Motivo" inteiro><Input maxLength={200} value={motivo} placeholder="Ex.: inventário, avaria, devolução" onChange={(e) => setMotivo(e.target.value)} /></Campo>
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
      <form className="linha" onSubmit={(e) => { e.preventDefault(); if (sanitizar(nome)) executar(async () => { checar(await supabase.from('categorias').insert({ nome: sanitizar(nome, 60) })); setNome(''); await recarregar() }).catch(() => {}) }}>
        <input placeholder="Nova categoria" value={nome} onChange={(e) => setNome(e.target.value)} style={{ flex: 1 }} />
        <button className="btn btn-primario"><Plus size={16} /> Adicionar</button>
      </form>
      <div className="tabela-wrap" style={{ marginTop: 10 }}><table><tbody>
        {lista.map((c) => (
          <tr key={c.id}><td>{c.nome}</td><td className="direita">
            <button className="btn btn-icone btn-fantasma btn-perigo" onClick={async () => (await confirmar({ titulo: 'Excluir categoria?', mensagem: `"${c.nome}" será excluída. Produtos dela ficam sem categoria.`, tipo: 'perigo', confirmar: 'Excluir' })) && executar(async () => { checar(await supabase.from('categorias').delete().eq('id', c.id)); await recarregar() }).catch(() => {})}><Trash2 size={15} /></button>
          </td></tr>
        ))}
        {!lista.length && <tr><td className="vazio">Nenhuma categoria</td></tr>}
      </tbody></table></div>
    </Modal>
  )
}
