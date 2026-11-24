import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { brl, num, formasPagamento, nomeVariacao } from '../lib/formato'
import { Cabecalho } from '../componentes/ui'
import { SkeletonKpis, SkeletonCard } from '../componentes/Skeleton'

const iso = (d) => d.toLocaleDateString('sv-SE')

export default function Relatorios() {
  const hoje = new Date()
  const [de, setDe] = useState(iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)))
  const [ate, setAte] = useState(iso(hoje))
  const [vendas, setVendas] = useState(null)
  const [estoque, setEstoque] = useState([])

  useEffect(() => {
    const fim = new Date(ate + 'T00:00:00'); fim.setDate(fim.getDate() + 1)
    supabase.from('vendas').select('id, total, desconto, criado_em, venda_itens(variacao_id, descricao, quantidade, preco_unitario, custo_unitario), venda_pagamentos(forma, valor)')
      .eq('status', 'concluida').order('criado_em').gte('criado_em', new Date(de + 'T00:00:00').toISOString()).lt('criado_em', fim.toISOString()).limit(10000)
      .then(({ data }) => setVendas(data || []))
  }, [de, ate])

  useEffect(() => {
    supabase.from('variacoes').select('id, nome, estoque, preco_custo, preco_venda, produtos!inner(nome, ativo)').eq('ativo', true).eq('produtos.ativo', true)
      .then(({ data }) => setEstoque(data || []))
  }, [])

  const r = useMemo(() => {
    if (!vendas) return null
    let fat = 0, custo = 0, desc = 0
    const porDia = {}, porProduto = {}, porForma = {}
    for (const v of vendas) {
      fat += Number(v.total); desc += Number(v.desconto)
      const dia = new Date(v.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      porDia[dia] = (porDia[dia] || 0) + Number(v.total)
      for (const i of v.venda_itens) {
        custo += i.quantidade * i.custo_unitario
        const p = (porProduto[i.variacao_id] ||= { nome: i.descricao, qtd: 0, receita: 0, lucro: 0 })
        p.qtd += Number(i.quantidade); p.receita += i.quantidade * i.preco_unitario; p.lucro += i.quantidade * (i.preco_unitario - i.custo_unitario)
      }
      for (const p of v.venda_pagamentos) porForma[p.forma] = (porForma[p.forma] || 0) + Number(p.valor)
    }
    return {
      fat, custo, lucro: fat - custo, desc, qtd: vendas.length, ticket: vendas.length ? fat / vendas.length : 0,
      dias: Object.entries(porDia).map(([dia, total]) => ({ dia, total })),
      produtos: Object.values(porProduto).sort((a, b) => b.receita - a.receita),
      formas: Object.entries(porForma).sort((a, b) => b[1] - a[1]),
    }
  }, [vendas])

  const valorEstoque = estoque.reduce((s, v) => s + Math.max(0, v.estoque) * v.preco_custo, 0)
  const valorVendaEstoque = estoque.reduce((s, v) => s + Math.max(0, v.estoque) * v.preco_venda, 0)

  function exportarCSV() {
    const linhas = [['Produto', 'Quantidade', 'Receita', 'Lucro bruto'], ...r.produtos.map((p) => [p.nome, p.qtd, p.receita.toFixed(2), p.lucro.toFixed(2)])]
    const csv = '﻿' + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `vendas-por-produto_${de}_${ate}.csv`
    a.click()
  }

  return (
    <>
      <Cabecalho titulo="Relatórios" descricao="Desempenho de vendas e valor em estoque">
        <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ width: 160 }} />
        <span className="suave">até</span>
        <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ width: 160 }} />
        {r && <button className="btn" onClick={exportarCSV}>Exportar CSV</button>}
      </Cabecalho>
      {!r ? <><SkeletonKpis /><div style={{ marginTop: 16 }}><SkeletonCard altura={240} /></div></> : <>
        <div className="grade grade-4">
          <div className="card kpi"><small>Faturamento</small><b>{brl(r.fat)}</b></div>
          <div className="card kpi"><small>Lucro bruto</small><b>{brl(r.lucro)}</b><small>{r.fat ? ((r.lucro / r.fat) * 100).toFixed(1) : 0}% de margem</small></div>
          <div className="card kpi"><small>Vendas</small><b>{r.qtd}</b><small>Ticket médio {brl(r.ticket)}</small></div>
          <div className="card kpi"><small>Descontos concedidos</small><b>{brl(r.desc)}</b></div>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginBottom: 12 }}>Vendas por dia</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={r.dias}>
                <CartesianGrid vertical={false} stroke="var(--borda)" />
                <XAxis dataKey="dia" tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--texto-suave)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => 'R$ ' + num(v)} width={80} />
                <Tooltip formatter={(v) => brl(v)} cursor={{ fill: 'var(--fundo)' }} contentStyle={{ background: 'var(--superficie)', border: '1px solid var(--borda)', borderRadius: 8 }} />
                <Bar dataKey="total" name="Total" fill="var(--primaria)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="grade grade-2" style={{ marginTop: 16 }}>
          <div className="card">
            <h2 style={{ marginBottom: 10 }}>Produtos mais vendidos</h2>
            <div className="tabela-wrap"><table>
              <thead><tr><th>Produto</th><th className="direita">Qtd</th><th className="direita">Receita</th><th className="direita">Lucro</th></tr></thead>
              <tbody>
                {r.produtos.slice(0, 15).map((p, i) => <tr key={i}><td>{p.nome}</td><td className="direita num">{num(p.qtd)}</td><td className="direita num">{brl(p.receita)}</td><td className="direita num">{brl(p.lucro)}</td></tr>)}
                {!r.produtos.length && <tr><td colSpan={4} className="vazio">Sem vendas no período</td></tr>}
              </tbody>
            </table></div>
          </div>
          <div>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>Por forma de pagamento</h2>
              {r.formas.map(([f, v]) => (
                <div key={f} style={{ marginBottom: 10 }}>
                  <div className="resumo-linha" style={{ padding: '2px 0' }}><span>{formasPagamento[f]}</span><b className="num">{brl(v)}</b></div>
                  <div style={{ height: 6, borderRadius: 9, background: 'var(--fundo)' }}><div style={{ height: '100%', width: `${(v / r.fat) * 100}%`, background: 'var(--primaria)', borderRadius: 9 }} /></div>
                </div>
              ))}
              {!r.formas.length && <p className="suave">Sem dados</p>}
            </div>
            <div className="card">
              <h2 style={{ marginBottom: 10 }}>Valor em estoque</h2>
              <div className="resumo-linha"><span className="suave">A preço de custo</span><b className="num">{brl(valorEstoque)}</b></div>
              <div className="resumo-linha"><span className="suave">A preço de venda</span><b className="num">{brl(valorVendaEstoque)}</b></div>
              <div className="resumo-linha"><span className="suave">Itens cadastrados</span><b className="num">{estoque.length}</b></div>
              <div className="resumo-linha"><span className="suave">Sem estoque</span><b className="num">{estoque.filter((v) => v.estoque <= 0).length}</b></div>
            </div>
          </div>
        </div>
      </>}
    </>
  )
}
