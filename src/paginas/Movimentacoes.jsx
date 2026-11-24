import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { num, dataHora, nomeVariacao } from '../lib/formato'
import { Cabecalho } from '../componentes/ui'
import { SkeletonLinhas } from '../componentes/Skeleton'
import Select from '../componentes/Select'

const tipos = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste', venda: 'Venda', compra: 'Compra', cancelamento: 'Cancelamento' }

export default function Movimentacoes() {
  const [lista, setLista] = useState(null)
  const [tipo, setTipo] = useState([])
  const [limite, setLimite] = useState(100)

  useEffect(() => {
    let q = supabase.from('movimentacoes')
      .select('*, variacoes(nome, produtos(nome)), perfis(nome)')
      .order('criado_em', { ascending: false }).limit(limite)
    if (tipo.length) q = q.in('tipo', tipo)
    q.then(({ data }) => setLista(data || []))
  }, [tipo.join(), limite])

  return (
    <>
      <Cabecalho titulo="Movimentações de estoque" descricao="Histórico de todas as entradas e saídas">
        <Select multi value={tipo} onChange={setTipo} style={{ width: 220 }} todosLabel="Todos os tipos" options={Object.entries(tipos).map(([value, label]) => ({ value, label }))} />
      </Cabecalho>
      <div className="card">
        <div className="tabela-wrap"><table>
          <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th className="direita">Qtd</th><th className="direita">Saldo</th><th>Motivo</th><th>Usuário</th></tr></thead>
          <tbody>
            {lista === null && <SkeletonLinhas colunas={7} />}
            {(lista || []).map((m) => (
              <tr key={m.id}>
                <td className="suave">{dataHora(m.criado_em)}</td>
                <td>{m.variacoes ? nomeVariacao(m.variacoes) : '—'}</td>
                <td><span className="selo">{tipos[m.tipo]}</span></td>
                <td className="direita num" style={{ color: m.quantidade < 0 ? 'var(--perigo)' : 'var(--sucesso)' }}>{m.quantidade > 0 ? '+' : ''}{num(m.quantidade)}</td>
                <td className="direita num">{num(m.estoque_resultante)}</td>
                <td className="suave">{m.motivo || '—'}</td>
                <td className="suave">{m.perfis?.nome || '—'}</td>
              </tr>
            ))}
            {lista && !lista.length && <tr><td colSpan={7} className="vazio">Nenhuma movimentação</td></tr>}
          </tbody>
        </table></div>
        {lista?.length >= limite && <button className="btn" style={{ marginTop: 12 }} onClick={() => setLimite(limite + 100)}>Carregar mais</button>}
      </div>
    </>
  )
}
