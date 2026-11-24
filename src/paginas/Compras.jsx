import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Eye } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { brl, num, dataHora, parseNum, nomeVariacao } from '../lib/formato'
import { Cabecalho, Campo, Modal, useAcao, Botao } from '../componentes/ui'
import { mascaras, sanitizar } from '../lib/mascaras'
import { SkeletonLinhas } from '../componentes/Skeleton'
import Select from '../componentes/Select'
import Checkbox from '../componentes/Checkbox'
import { Input } from '../componentes/Input'
import Tabela from '../componentes/Tabela'

export default function Compras() {
  const [lista, setLista] = useState(null)
  const [nova, setNova] = useState(false)
  const [vendo, setVendo] = useState(null)
  const carregar = () => supabase.from('compras').select('*, fornecedores(nome), perfis(nome)').order('criado_em', { ascending: false }).limit(200).then(({ data }) => setLista(data || []))
  useEffect(() => { carregar() }, [])

  return (
    <>
      <Cabecalho titulo="Compras" descricao="Entrada de mercadorias de fornecedores">
        <button className="btn btn-primario" onClick={() => setNova(true)}><Plus size={16} /> Nova compra</button>
      </Cabecalho>
      <div className="card">
        <Tabela
          dados={lista}
          vazio="Nenhuma compra registrada"
          ordemInicial={{ chave: 'criado_em', dir: -1 }}
          colunas={[
            { chave: 'id', titulo: '#', tipo: 'numero', render: (c) => `#${c.id}` },
            { chave: 'criado_em', titulo: 'Data', tipo: 'data', classe: 'suave', render: (c) => dataHora(c.criado_em) },
            { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'opcoes', valor: (c) => c.fornecedores?.nome || '', render: (c) => c.fornecedores?.nome || '—' },
            { chave: 'observacoes', titulo: 'Observações', classe: 'suave', render: (c) => c.observacoes || '—' },
            { chave: 'usuario', titulo: 'Usuário', tipo: 'opcoes', classe: 'suave', valor: (c) => c.perfis?.nome || '', render: (c) => c.perfis?.nome || '—' },
            { chave: 'total', titulo: 'Total', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (c) => <b>{brl(c.total)}</b> },
          ]}
          rodape={(l) => <span>Total: <b>{brl(l.reduce((s, c) => s + Number(c.total), 0))}</b></span>}
          acoes={(c) => <button className="btn btn-icone btn-fantasma" onClick={() => setVendo(c)} aria-label="Detalhes"><Eye size={16} /></button>}
        />
      </div>
      {nova && <NovaCompra onFechar={() => setNova(false)} onSalvo={() => { setNova(false); carregar() }} />}
      {vendo && <DetalheCompra compra={vendo} onFechar={() => setVendo(null)} />}
    </>
  )
}

function NovaCompra({ onFechar, onSalvo }) {
  const [fornecedores, setFornecedores] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [fornecedor, setFornecedor] = useState('')
  const [obs, setObs] = useState('')
  const [atualizarCusto, setAtualizarCusto] = useState(true)
  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [executar, ocupado] = useAcao()

  useEffect(() => {
    supabase.from('fornecedores').select('id, nome').eq('ativo', true).order('nome').then(({ data }) => setFornecedores(data || []))
    supabase.from('variacoes').select('id, nome, codigo_barras, preco_custo, estoque, produtos!inner(nome, ativo)').eq('ativo', true).eq('produtos.ativo', true)
      .then(({ data }) => setCatalogo((data || []).map((v) => ({ ...v, rotulo: nomeVariacao(v) })).sort((a, b) => a.rotulo.localeCompare(b.rotulo))))
  }, [])

  const sugestoes = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return t ? catalogo.filter((v) => v.rotulo.toLowerCase().includes(t) || v.codigo_barras === t).slice(0, 8) : []
  }, [busca, catalogo])

  const add = (v) => {
    if (!itens.find((i) => i.id === v.id)) setItens([...itens, { id: v.id, rotulo: v.rotulo, quantidade: '1', custo: mascaras.decimal(Number(v.preco_custo).toFixed(2).replace('.', ',')) }])
    setBusca('')
  }
  const setI = (id, k, val) => setItens(itens.map((i) => (i.id === id ? { ...i, [k]: val } : i)))
  const total = itens.reduce((s, i) => s + parseNum(i.quantidade) * parseNum(i.custo), 0)

  return (
    <Modal largo titulo="Nova compra" onFechar={onFechar} rodape={<>
      <span style={{ marginRight: 'auto', fontWeight: 700 }}>Total: {brl(total)}</span>
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <Botao className="btn-primario" carregando={ocupado} disabled={!itens.length} onClick={() => executar(async () => checar(await supabase.rpc('registrar_compra', { p: {
        fornecedor_id: fornecedor || null, observacoes: sanitizar(obs) || null, atualizar_custo: atualizarCusto,
        itens: itens.map((i) => ({ variacao_id: i.id, quantidade: parseNum(i.quantidade), custo_unitario: parseNum(i.custo) })),
      } })), 'Compra registrada e estoque atualizado').then(onSalvo, () => {})}>Registrar compra</Botao>
    </>}>
      <div className="form">
        <Campo label="Fornecedor">
          <Select value={fornecedor} onChange={setFornecedor} limpar placeholder="Sem fornecedor" options={fornecedores.map((f) => ({ value: f.id, label: f.nome }))} />
        </Campo>
        <Campo label="Observações (nº da nota, etc.)"><Input maxLength={200} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
      <div style={{ margin: '14px 0' }}><Checkbox checked={atualizarCusto} onChange={setAtualizarCusto} descricao="O custo informado aqui passa a ser o custo cadastrado do produto">Atualizar o preço de custo dos produtos</Checkbox></div>
      <div style={{ position: 'relative' }}>
        <input placeholder="Adicionar produto (nome ou código de barras)" value={busca} onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (sugestoes[0]) add(sugestoes[0]) } }} />
        {sugestoes.length > 0 && <div className="sugestoes" style={{ top: 42 }}>
          {sugestoes.map((v) => <button key={v.id} onClick={() => add(v)}><span>{v.rotulo}</span><small className="suave">estoque {num(v.estoque)}</small></button>)}
        </div>}
      </div>
      <div className="tabela-wrap" style={{ marginTop: 10 }}><table>
        <thead><tr><th>Produto</th><th>Qtd</th><th>Custo unit. (R$)</th><th className="direita">Subtotal</th><th /></tr></thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.id}><td style={{ whiteSpace: 'normal' }}>{i.rotulo}</td>
              <td><Input style={{ width: 80 }} mascara="quantidade" value={i.quantidade} onChange={(e) => setI(i.id, 'quantidade', e.target.value)} /></td>
              <td><Input style={{ width: 110 }} mascara="decimal" value={i.custo} onChange={(e) => setI(i.id, 'custo', e.target.value)} /></td>
              <td className="direita num">{brl(parseNum(i.quantidade) * parseNum(i.custo))}</td>
              <td className="direita"><button className="btn btn-icone btn-fantasma btn-perigo" onClick={() => setItens(itens.filter((x) => x.id !== i.id))}><Trash2 size={15} /></button></td></tr>
          ))}
          {!itens.length && <tr><td colSpan={5} className="vazio">Adicione os produtos recebidos</td></tr>}
        </tbody>
      </table></div>
    </Modal>
  )
}

function DetalheCompra({ compra, onFechar }) {
  const [itens, setItens] = useState(null)
  useEffect(() => {
    supabase.from('compra_itens').select('*, variacoes(nome, produtos(nome))').eq('compra_id', compra.id).then(({ data }) => setItens(data || []))
  }, [compra.id])
  return (
    <Modal largo titulo={`Compra #${compra.id}`} onFechar={onFechar}>
      <p className="suave" style={{ marginTop: 0 }}>{dataHora(compra.criado_em)} · {compra.fornecedores?.nome || 'Sem fornecedor'}</p>
      <Tabela dados={itens} colunas={[
        { chave: 'produto', titulo: 'Produto', valor: (i) => nomeVariacao(i.variacoes), quebrar: true },
        { chave: 'quantidade', titulo: 'Qtd', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (i) => num(i.quantidade) },
        { chave: 'custo_unitario', titulo: 'Custo', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (i) => brl(i.custo_unitario) },
        { chave: 'subtotal', titulo: 'Subtotal', tipo: 'numero', alinhar: 'direita', classe: 'num', valor: (i) => i.quantidade * i.custo_unitario, render: (i) => brl(i.quantidade * i.custo_unitario) },
      ]} />
      <p style={{ textAlign: 'right', fontWeight: 700 }}>Total: {brl(compra.total)}</p>
    </Modal>
  )
}
