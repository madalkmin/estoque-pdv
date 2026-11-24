import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, Receipt, TrendingUp, AlertTriangle, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, num, inicioDoDia, nomeVariacao, dataHora } from '../lib/formato'
import { Cabecalho } from '../componentes/ui'
import { SkeletonKpis, SkeletonCard } from '../componentes/Skeleton'

export default function Dashboard() {
  const { perfil, admin } = useAuth()
  const [d, setD] = useState(null)

  useEffect(() => {
    (async () => {
      const hoje = inicioDoDia().toISOString()
      const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0)
      const [vHoje, vMes, varis, ultimas] = await Promise.all([
        supabase.from('vendas').select('total, venda_itens(quantidade, custo_unitario)').eq('status', 'concluida').gte('criado_em', hoje),
        supabase.from('vendas').select('total').eq('status', 'concluida').gte('criado_em', mes.toISOString()),
        supabase.from('variacoes').select('id, nome, estoque, estoque_minimo, produtos!inner(nome, ativo)').eq('ativo', true).eq('produtos.ativo', true),
        supabase.from('vendas').select('id, total, status, criado_em, clientes(nome)').order('criado_em', { ascending: false }).limit(6),
      ])
      const hojeLista = vHoje.data || []
      const fat = hojeLista.reduce((s, v) => s + Number(v.total), 0)
      const custo = hojeLista.reduce((s, v) => s + v.venda_itens.reduce((a, i) => a + i.quantidade * i.custo_unitario, 0), 0)
      setD({
        fatHoje: fat, qtdHoje: hojeLista.length, lucroHoje: fat - custo,
        fatMes: (vMes.data || []).reduce((s, v) => s + Number(v.total), 0),
        baixo: (varis.data || []).filter((v) => Number(v.estoque) <= Number(v.estoque_minimo)).sort((a, b) => a.estoque - b.estoque),
        ultimas: ultimas.data || [],
      })
    })()
  }, [])

  return (
    <>
      <Cabecalho titulo={`Olá, ${perfil.nome.split(' ')[0]}`} descricao="Resumo do movimento da loja">
        <Link className="btn btn-primario" to="/caixa"><ShoppingCart size={16} /> Abrir caixa</Link>
      </Cabecalho>
      {!d ? <><SkeletonKpis n={admin ? 4 : 2} /><div className="grade grade-2" style={{ marginTop: 16 }}><SkeletonCard /><SkeletonCard /></div></> : <>
        <div className="grade grade-4">
          <div className="card kpi"><small><DollarSign size={15} /> Vendido hoje</small><b>{brl(d.fatHoje)}</b></div>
          <div className="card kpi"><small><Receipt size={15} /> Vendas hoje</small><b>{d.qtdHoje}</b></div>
          {admin && <div className="card kpi"><small><TrendingUp size={15} /> Lucro bruto hoje</small><b>{brl(d.lucroHoje)}</b></div>}
          {admin && <div className="card kpi"><small><DollarSign size={15} /> Vendido no mês</small><b>{brl(d.fatMes)}</b></div>}
        </div>
        <div className="grade grade-2" style={{ marginTop: 16 }}>
          <div className="card">
            <div className="linha" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h2><AlertTriangle size={17} style={{ verticalAlign: -3, color: 'var(--alerta)' }} /> Estoque baixo</h2>
              <Link to="/produtos">Ver produtos</Link>
            </div>
            <div className="tabela-wrap"><table>
              <thead><tr><th>Produto</th><th className="direita">Atual</th><th className="direita">Mínimo</th></tr></thead>
              <tbody>
                {d.baixo.slice(0, 8).map((v) => (
                  <tr key={v.id}><td>{nomeVariacao(v)}</td>
                    <td className="direita"><span className={'selo ' + (v.estoque <= 0 ? 'perigo' : 'alerta')}>{num(v.estoque)}</span></td>
                    <td className="direita num">{num(v.estoque_minimo)}</td></tr>
                ))}
                {!d.baixo.length && <tr><td colSpan={3} className="vazio">Nenhum produto abaixo do mínimo</td></tr>}
              </tbody>
            </table></div>
          </div>
          <div className="card">
            <div className="linha" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h2>Últimas vendas</h2><Link to="/vendas">Ver todas</Link>
            </div>
            <div className="tabela-wrap"><table>
              <tbody>
                {d.ultimas.map((v) => (
                  <tr key={v.id}><td>#{v.id}</td><td className="suave">{dataHora(v.criado_em)}</td><td>{v.clientes?.nome || '—'}</td>
                    <td className="direita num">{v.status === 'cancelada' ? <span className="selo perigo">Cancelada</span> : brl(v.total)}</td></tr>
                ))}
                {!d.ultimas.length && <tr><td className="vazio">Nenhuma venda ainda</td></tr>}
              </tbody>
            </table></div>
          </div>
        </div>
      </>}
    </>
  )
}
