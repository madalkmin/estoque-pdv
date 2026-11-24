import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { num, dataHora, nomeVariacao } from '../lib/formato'
import { Cabecalho } from '../componentes/ui'
import { SkeletonLinhas } from '../componentes/Skeleton'
import Select from '../componentes/Select'
import Tabela from '../componentes/Tabela'

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
        <Tabela
          dados={lista}
          vazio="Nenhuma movimentação"
          ordemInicial={{ chave: 'criado_em', dir: -1 }}
          colunas={[
            { chave: 'criado_em', titulo: 'Data', tipo: 'data', classe: 'suave', render: (m) => dataHora(m.criado_em) },
            { chave: 'produto', titulo: 'Produto', valor: (m) => (m.variacoes ? nomeVariacao(m.variacoes) : '') },
            { chave: 'tipo', titulo: 'Tipo', tipo: 'opcoes', rotulo: (t) => tipos[t] || t, render: (m) => <span className="selo">{tipos[m.tipo]}</span> },
            { chave: 'quantidade', titulo: 'Qtd', tipo: 'numero', alinhar: 'direita', classe: 'num',
              render: (m) => <span style={{ color: m.quantidade < 0 ? 'var(--perigo)' : 'var(--sucesso)' }}>{m.quantidade > 0 ? '+' : ''}{num(m.quantidade)}</span> },
            { chave: 'estoque_resultante', titulo: 'Saldo', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (m) => num(m.estoque_resultante) },
            { chave: 'motivo', titulo: 'Motivo', classe: 'suave', render: (m) => m.motivo || '—' },
            { chave: 'usuario', titulo: 'Usuário', tipo: 'opcoes', classe: 'suave', valor: (m) => m.perfis?.nome || '', render: (m) => m.perfis?.nome || '—' },
          ]}
        />
        {lista?.length >= limite && <button className="btn" style={{ marginTop: 12 }} onClick={() => setLimite(limite + 100)}>Carregar mais</button>}
      </div>
    </>
  )
}
