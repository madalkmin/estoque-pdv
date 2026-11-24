import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Eye } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { brl, num, dataHora, parseNum, nomeVariacao } from '../lib/formato'
import { Cabecalho, Campo, Modal, useAcao } from '../componentes/ui'

export default function Compras() {
  const [lista, setLista] = useState([])
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
        <div className="tabela-wrap"><table>
          <thead><tr><th>#</th><th>Data</th><th>Fornecedor</th><th>Observações</th><th>Usuário</th><th className="direita">Total</th><th /></tr></thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}><td>#{c.id}</td><td className="suave">{dataHora(c.criado_em)}</td><td>{c.fornecedores?.nome || '—'}</td>
                <td className="suave">{c.observacoes || '—'}</td><td className="suave">{c.perfis?.nome || '—'}</td>
                <td className="direita num"><b>{brl(c.total)}</b></td>
                <td className="direita"><button className="btn btn-icone btn-fantasma" onClick={() => setVendo(c)} aria-label="Detalhes"><Eye size={16} /></button></td></tr>
            ))}
            {!lista.length && <tr><td colSpan={7} className="vazio">Nenhuma compra registrada</td></tr>}
          </tbody>
        </table></div>
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
    if (!itens.find((i) => i.id === v.id)) setItens([...itens, { id: v.id, rotulo: v.rotulo, quantidade: '1', custo: String(v.preco_custo).replace('.', ',') }])
    setBusca('')
  }
  const setI = (id, k, val) => setItens(itens.map((i) => (i.id === id ? { ...i, [k]: val } : i)))
  const total = itens.reduce((s, i) => s + parseNum(i.quantidade) * parseNum(i.custo), 0)

  return (
    <Modal largo titulo="Nova compra" onFechar={onFechar} rodape={<>
      <span style={{ marginRight: 'auto', fontWeight: 700 }}>Total: {brl(total)}</span>
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <button className="btn btn-primario" disabled={ocupado || !itens.length} onClick={() => executar(async () => checar(await supabase.rpc('registrar_compra', { p: {
        fornecedor_id: fornecedor || null, observacoes: obs || null, atualizar_custo: atualizarCusto,
        itens: itens.map((i) => ({ variacao_id: i.id, quantidade: parseNum(i.quantidade), custo_unitario: parseNum(i.custo) })),
      } })), 'Compra registrada e estoque atualizado').then(onSalvo, () => {})}>Registrar compra</button>
    </>}>
      <div className="form">
        <Campo label="Fornecedor">
          <select value={fornecedor} onChange={(e) => setFornecedor(e.target.value)}>
            <option value="">Sem fornecedor</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Observações (nº da nota, etc.)"><input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
      <label className="linha" style={{ margin: '10px 0', cursor: 'pointer' }}>
        <input type="checkbox" style={{ width: 16, height: 16 }} checked={atualizarCusto} onChange={(e) => setAtualizarCusto(e.target.checked)} /> Atualizar o preço de custo dos produtos
      </label>
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
              <td><input style={{ width: 80 }} inputMode="decimal" value={i.quantidade} onChange={(e) => setI(i.id, 'quantidade', e.target.value)} /></td>
              <td><input style={{ width: 110 }} inputMode="decimal" value={i.custo} onChange={(e) => setI(i.id, 'custo', e.target.value)} /></td>
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
  const [itens, setItens] = useState([])
  useEffect(() => {
    supabase.from('compra_itens').select('*, variacoes(nome, produtos(nome))').eq('compra_id', compra.id).then(({ data }) => setItens(data || []))
  }, [compra.id])
  return (
    <Modal largo titulo={`Compra #${compra.id}`} onFechar={onFechar}>
      <p className="suave" style={{ marginTop: 0 }}>{dataHora(compra.criado_em)} · {compra.fornecedores?.nome || 'Sem fornecedor'}</p>
      <div className="tabela-wrap"><table>
        <thead><tr><th>Produto</th><th className="direita">Qtd</th><th className="direita">Custo</th><th className="direita">Subtotal</th></tr></thead>
        <tbody>{itens.map((i) => (
          <tr key={i.id}><td>{nomeVariacao(i.variacoes)}</td><td className="direita num">{num(i.quantidade)}</td><td className="direita num">{brl(i.custo_unitario)}</td><td className="direita num">{brl(i.quantidade * i.custo_unitario)}</td></tr>
        ))}</tbody>
      </table></div>
      <p style={{ textAlign: 'right', fontWeight: 700 }}>Total: {brl(compra.total)}</p>
    </Modal>
  )
}
