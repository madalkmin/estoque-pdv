import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, HandCoins, History } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, dataHora, parseNum, formasPagamento } from '../lib/formato'
import { Cabecalho, Campo, Modal, useAcao } from '../componentes/ui'
import { FormCadastro } from '../componentes/Cadastro'
import { SkeletonLinhas } from '../componentes/Skeleton'
import Select from '../componentes/Select'
import Checkbox from '../componentes/Checkbox'
import { Input } from '../componentes/Input'

const campos = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'telefone', rotulo: 'Telefone', mascara: 'telefone' },
  { chave: 'documento', rotulo: 'CPF/CNPJ', mascara: 'cpfCnpj' },
  { chave: 'email', rotulo: 'E-mail', tipo: 'email' },
  { chave: 'limite_fiado', rotulo: 'Limite de fiado (R$, 0 = sem limite)', numero: true },
  { chave: 'observacoes', rotulo: 'Observações', texto: true, inteiro: true },
]

export default function Clientes() {
  const { admin } = useAuth()
  const [lista, setLista] = useState(null)
  const [busca, setBusca] = useState('')
  const [soDevedores, setSoDevedores] = useState(false)
  const [editando, setEditando] = useState(null)
  const [recebendo, setRecebendo] = useState(null)
  const [historico, setHistorico] = useState(null)

  async function carregar() {
    const [c, s] = await Promise.all([
      supabase.from('clientes').select('*').eq('ativo', true).order('nome'),
      supabase.from('saldo_clientes').select('*'),
    ])
    const saldos = Object.fromEntries((s.data || []).map((x) => [x.cliente_id, Number(x.saldo)]))
    setLista((c.data || []).map((x) => ({ ...x, saldo: saldos[x.id] || 0 })))
  }
  useEffect(() => { carregar() }, [])

  const filtrada = useMemo(() => (lista || []).filter((c) =>
    (!soDevedores || c.saldo > 0) &&
    (c.nome.toLowerCase().includes(busca.toLowerCase()) || (!!busca.replace(/\D/g, '') && (c.telefone?.replace(/\D/g, '').includes(busca.replace(/\D/g, '')) || c.documento?.replace(/\D/g, '').includes(busca.replace(/\D/g, '')))))), [lista, busca, soDevedores])
  const totalAReceber = (lista || []).reduce((s, c) => s + Math.max(0, c.saldo), 0)

  return (
    <>
      <Cabecalho titulo="Clientes e fiado" descricao={`Total a receber: ${brl(totalAReceber)}`}>
        <button className="btn btn-primario" onClick={() => setEditando({})}><Plus size={16} /> Novo cliente</button>
      </Cabecalho>
      <div className="card">
        <div className="linha" style={{ marginBottom: 14 }}>
          <div className="busca"><Search size={16} /><input placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
          <Checkbox interruptor checked={soDevedores} onChange={setSoDevedores}>Só com fiado em aberto</Checkbox>
        </div>
        <div className="tabela-wrap"><table>
          <thead><tr><th>Nome</th><th>Telefone</th><th>Documento</th><th className="direita">Limite</th><th className="direita">Saldo devedor</th><th /></tr></thead>
          <tbody>
            {lista === null && <SkeletonLinhas colunas={6} />}
            {filtrada.map((c) => (
              <tr key={c.id}>
                <td><b>{c.nome}</b></td>
                <td className="suave">{c.telefone || '—'}</td>
                <td className="suave">{c.documento || '—'}</td>
                <td className="direita num suave">{Number(c.limite_fiado) ? brl(c.limite_fiado) : 'Sem limite'}</td>
                <td className="direita">{c.saldo > 0 ? <span className="selo alerta">{brl(c.saldo)}</span> : <span className="selo ok">Em dia</span>}</td>
                <td className="direita">
                  {c.saldo > 0 && <button className="btn btn-icone btn-fantasma" title="Receber" onClick={() => setRecebendo(c)}><HandCoins size={16} /></button>}
                  <button className="btn btn-icone btn-fantasma" title="Histórico" onClick={() => setHistorico(c)}><History size={16} /></button>
                  <button className="btn btn-icone btn-fantasma" title="Editar" onClick={() => setEditando(c)}><Pencil size={16} /></button>
                </td>
              </tr>
            ))}
            {lista && !filtrada.length && <tr><td colSpan={6} className="vazio">Nenhum cliente</td></tr>}
          </tbody>
        </table></div>
      </div>
      {editando && <FormCadastro tabela="clientes" titulo={editando.id ? 'Editar cliente' : 'Novo cliente'} registro={editando} campos={campos} podeExcluir={admin}
        onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar() }} />}
      {recebendo && <Receber cliente={recebendo} onFechar={() => setRecebendo(null)} onSalvo={() => { setRecebendo(null); carregar() }} />}
      {historico && <Historico cliente={historico} onFechar={() => setHistorico(null)} />}
    </>
  )
}

function Receber({ cliente, onFechar, onSalvo }) {
  const [valor, setValor] = useState(cliente.saldo.toFixed(2).replace('.', ','))
  const [forma, setForma] = useState('dinheiro')
  const [obs, setObs] = useState('')
  const [executar, ocupado] = useAcao()
  return (
    <Modal titulo={`Receber de ${cliente.nome}`} onFechar={onFechar} rodape={<>
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <button className="btn btn-primario" disabled={ocupado} onClick={() => executar(async () => {
        const v = parseNum(valor)
        if (v <= 0) throw new Error('Valor inválido')
        if (v > cliente.saldo + 0.001) throw new Error('Valor maior que o saldo devedor')
        checar(await supabase.rpc('receber_fiado', { p_cliente: cliente.id, p_valor: v, p_forma: forma, p_obs: obs || null }))
      }, 'Pagamento registrado').then(onSalvo, () => {})}>Registrar pagamento</button>
    </>}>
      <p className="suave" style={{ marginTop: 0 }}>Saldo devedor: <b>{brl(cliente.saldo)}</b></p>
      <div className="form">
        <Campo label="Valor (R$)"><Input autoFocus mascara="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo label="Forma">
          <Select value={forma} onChange={setForma} options={Object.entries(formasPagamento).filter(([k]) => k !== 'fiado').map(([value, label]) => ({ value, label }))} />
        </Campo>
        <Campo label="Observação" inteiro><input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
    </Modal>
  )
}

function Historico({ cliente, onFechar }) {
  const [linhas, setLinhas] = useState(null)
  useEffect(() => {
    Promise.all([
      supabase.from('vendas').select('id, total, status, criado_em, venda_pagamentos(forma, valor)').eq('cliente_id', cliente.id).order('criado_em', { ascending: false }).limit(100),
      supabase.from('recebimentos_fiado').select('*').eq('cliente_id', cliente.id).order('criado_em', { ascending: false }).limit(100),
    ]).then(([v, r]) => {
      const a = (v.data || []).map((x) => ({
        data: x.criado_em, desc: `Compra #${x.id}` + (x.status === 'cancelada' ? ' (cancelada)' : ''), valor: x.total,
        fiado: x.status === 'concluida' ? x.venda_pagamentos.filter((p) => p.forma === 'fiado').reduce((s, p) => s + Number(p.valor), 0) : 0,
      }))
      const b = (r.data || []).map((x) => ({ data: x.criado_em, desc: `Pagamento de fiado (${formasPagamento[x.forma]})`, valor: x.valor, recebido: true }))
      setLinhas([...a, ...b].sort((x, y) => new Date(y.data) - new Date(x.data)))
    })
  }, [cliente.id])

  return (
    <Modal largo titulo={`Histórico — ${cliente.nome}`} onFechar={onFechar}>
      {!linhas ? <table><tbody><SkeletonLinhas linhas={5} colunas={4} /></tbody></table> : <div className="tabela-wrap"><table>
        <thead><tr><th>Data</th><th>Descrição</th><th className="direita">Valor</th><th className="direita">Fiado</th></tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}><td className="suave">{dataHora(l.data)}</td><td>{l.desc}</td>
              <td className="direita num" style={{ color: l.recebido ? 'var(--sucesso)' : undefined }}>{l.recebido ? '−' : ''}{brl(l.valor)}</td>
              <td className="direita num">{l.fiado ? brl(l.fiado) : ''}</td></tr>
          ))}
          {!linhas.length && <tr><td colSpan={4} className="vazio">Sem movimentações</td></tr>}
        </tbody>
      </table></div>}
    </Modal>
  )
}
