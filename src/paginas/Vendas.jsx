import { useEffect, useState } from 'react'
import { Eye, Printer, Ban } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, num, dataHora, formasPagamento, inicioDoDia } from '../lib/formato'
import { imprimirCupom } from '../lib/cupom'
import { Cabecalho, Campo, Modal, useAcao } from '../componentes/ui'
import { SkeletonLinhas } from '../componentes/Skeleton'
import Select from '../componentes/Select'

const hojeISO = () => new Date().toLocaleDateString('sv-SE')

export default function Vendas() {
  const { perfil, admin } = useAuth()
  const [de, setDe] = useState(hojeISO())
  const [ate, setAte] = useState(hojeISO())
  const [lista, setLista] = useState(null)
  const [aberta, setAberta] = useState(null)
  const [formas, setFormas] = useState([])

  async function carregar() {
    const fim = new Date(ate + 'T00:00:00'); fim.setDate(fim.getDate() + 1)
    const { data } = await supabase.from('vendas')
      .select('*, clientes(nome), perfis(nome), venda_pagamentos(forma, valor)')
      .gte('criado_em', inicioDoDia(new Date(de + 'T00:00:00')).toISOString()).lt('criado_em', fim.toISOString())
      .order('criado_em', { ascending: false })
    setLista(data || [])
  }
  useEffect(() => { setLista(null); carregar() }, [de, ate])

  const visiveis = (lista || []).filter((v) => !formas.length || v.venda_pagamentos.some((p) => formas.includes(p.forma)))
  const validas = visiveis.filter((v) => v.status === 'concluida')
  const total = validas.reduce((s, v) => s + Number(v.total), 0)

  return (
    <>
      <Cabecalho titulo="Vendas" descricao={`${validas.length} vendas · ${brl(total)}`}>
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ width: 160 }} />
        <span className="suave">até</span>
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ width: 160 }} />
        <Select multi value={formas} onChange={setFormas} style={{ width: 200 }} todosLabel="Todas as formas" options={Object.entries(formasPagamento).map(([value, label]) => ({ value, label }))} />
      </Cabecalho>
      <div className="card">
        <div className="tabela-wrap"><table>
          <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th>Operador</th><th className="direita">Total</th><th /></tr></thead>
          <tbody>
            {lista === null && <SkeletonLinhas colunas={7} />}
            {visiveis.map((v) => (
              <tr key={v.id} style={{ opacity: v.status === 'cancelada' ? 0.55 : 1 }}>
                <td>#{v.id}</td>
                <td className="suave">{dataHora(v.criado_em)}</td>
                <td>{v.clientes?.nome || '—'}</td>
                <td className="suave">{[...new Set(v.venda_pagamentos.map((p) => formasPagamento[p.forma]))].join(', ')}</td>
                <td className="suave">{v.perfis?.nome || '—'}</td>
                <td className="direita num">{v.status === 'cancelada' ? <span className="selo perigo">Cancelada</span> : <b>{brl(v.total)}</b>}</td>
                <td className="direita"><button className="btn btn-icone btn-fantasma" onClick={() => setAberta(v)} aria-label="Detalhes"><Eye size={16} /></button></td>
              </tr>
            ))}
            {lista && !visiveis.length && <tr><td colSpan={7} className="vazio">Nenhuma venda no período</td></tr>}
          </tbody>
        </table></div>
      </div>
      {aberta && <DetalheVenda venda={aberta} admin={admin} operador={perfil.nome} onFechar={() => setAberta(null)} onAlterado={() => { setAberta(null); carregar() }} />}
    </>
  )
}

function DetalheVenda({ venda, admin, onFechar, onAlterado }) {
  const [itens, setItens] = useState(null)
  const [config, setConfig] = useState(null)
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [executar, ocupado] = useAcao()

  useEffect(() => {
    supabase.from('venda_itens').select('*').eq('venda_id', venda.id).then(({ data }) => setItens(data || []))
    supabase.from('configuracoes').select('*').single().then(({ data }) => setConfig(data))
  }, [venda.id])

  return (
    <Modal largo titulo={`Venda #${venda.id}`} onFechar={onFechar} rodape={<>
      {admin && venda.status === 'concluida' && <button className="btn btn-perigo" style={{ marginRight: 'auto' }} onClick={() => setCancelando(true)}><Ban size={16} /> Cancelar venda</button>}
      <button className="btn" onClick={() => imprimirCupom({ venda, itens: itens || [], pagamentos: venda.venda_pagamentos, cliente: venda.clientes, config, operador: venda.perfis?.nome })}><Printer size={16} /> Reimprimir</button>
      <button className="btn btn-primario" onClick={onFechar}>Fechar</button>
    </>}>
      <p className="suave" style={{ marginTop: 0 }}>{dataHora(venda.criado_em)} · {venda.clientes?.nome || 'Sem cliente'} · {venda.perfis?.nome}</p>
      <div className="tabela-wrap"><table>
        <thead><tr><th>Item</th><th className="direita">Qtd</th><th className="direita">Unitário</th><th className="direita">Total</th></tr></thead>
        <tbody>{itens === null && <SkeletonLinhas linhas={2} colunas={4} />}{(itens || []).map((i) => (
          <tr key={i.id}><td>{i.descricao}</td><td className="direita num">{num(i.quantidade)}</td><td className="direita num">{brl(i.preco_unitario)}</td><td className="direita num">{brl(i.quantidade * i.preco_unitario)}</td></tr>
        ))}</tbody>
      </table></div>
      <div style={{ maxWidth: 300, marginLeft: 'auto', marginTop: 12 }}>
        <div className="resumo-linha"><span className="suave">Subtotal</span><span>{brl(venda.subtotal)}</span></div>
        {Number(venda.desconto) > 0 && <div className="resumo-linha"><span className="suave">Desconto</span><span>-{brl(venda.desconto)}</span></div>}
        <div className="resumo-linha"><b>Total</b><b>{brl(venda.total)}</b></div>
        {venda.venda_pagamentos.map((p, i) => <div key={i} className="resumo-linha"><span className="suave">{formasPagamento[p.forma]}</span><span>{brl(p.valor)}</span></div>)}
        {Number(venda.troco) > 0 && <div className="resumo-linha"><span className="suave">Troco</span><span>{brl(venda.troco)}</span></div>}
      </div>
      {cancelando && <div className="card" style={{ marginTop: 14 }}>
        <Campo label="Motivo do cancelamento (os itens voltam para o estoque)"><input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <div className="linha" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => setCancelando(false)}>Voltar</button>
          <button className="btn btn-perigo" disabled={ocupado} onClick={() => executar(async () => checar(await supabase.rpc('cancelar_venda', { p_venda: venda.id, p_motivo: motivo || null })), 'Venda cancelada').then(onAlterado, () => {})}>Confirmar cancelamento</button>
        </div>
      </div>}
    </Modal>
  )
}
