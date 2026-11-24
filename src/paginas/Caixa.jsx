import { useEffect, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Eye, LockKeyhole, Printer, Unlock, Wallet } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, dataHora } from '../lib/formato'
import { imprimirFechamento } from '../lib/cupom'
import { Cabecalho, Modal } from '../componentes/ui'
import Tabela from '../componentes/Tabela'
import { SkeletonCard } from '../componentes/Skeleton'
import { useCaixaAberto, AbrirCaixa, MovimentoCaixa, FecharCaixa, ResumoCaixa, Diferenca } from '../componentes/CaixaModais'

export default function Caixa() {
  const { admin } = useAuth()
  const [caixa, recarregarCaixa] = useCaixaAberto()
  const [resumo, setResumo] = useState(null)
  const [movs, setMovs] = useState(null)
  const [historico, setHistorico] = useState(null)
  const [config, setConfig] = useState(null)
  const [modal, setModal] = useState(null) // 'abrir' | 'sangria' | 'suprimento' | {fechar: caixa} | {ver: id}

  async function carregarAtual(c = caixa) {
    if (!c) { setResumo(null); setMovs(null); return }
    const [r, m] = await Promise.all([
      supabase.rpc('resumo_caixa', { p_caixa: c.id }),
      supabase.from('caixa_movimentos').select('*').eq('caixa_id', c.id).order('criado_em', { ascending: false }),
    ])
    setResumo(checar(r)); setMovs(checar(m))
  }
  async function carregarHistorico() {
    const { data } = await supabase.from('caixas')
      .select('*, operador:perfis!caixas_usuario_id_fkey(nome)').order('aberto_em', { ascending: false }).limit(200)
    setHistorico(data || [])
  }
  useEffect(() => { carregarHistorico(); supabase.from('configuracoes').select('*').single().then(({ data }) => setConfig(data)) }, [])
  useEffect(() => { if (caixa !== undefined) carregarAtual().catch(() => {}) }, [caixa])

  const atualizarTudo = async () => { setModal(null); await recarregarCaixa(); carregarHistorico() }

  return (
    <>
      <Cabecalho titulo="Controle de caixa" descricao="Abertura, sangria, suprimento e fechamento" />

      {caixa === undefined ? <SkeletonCard altura={120} /> : !caixa ? (
        <div className="card caixa-vazio">
          <div className="caixa-vazio-icone"><Wallet size={26} /></div>
          <h2>Seu caixa está fechado</h2>
          <p>Abra o caixa informando o fundo de troco para começar a vender.</p>
          <button className="btn btn-primario btn-grande" onClick={() => setModal('abrir')}><Unlock size={18} /> Abrir caixa</button>
        </div>
      ) : (
        <>
          <div className="card caixa-status">
            <div className="caixa-status-info">
              <span className="caixa-pulso" />
              <div><b>Caixa #{caixa.id} aberto</b><div className="suave" style={{ fontSize: 13 }}>desde {dataHora(caixa.aberto_em)}</div></div>
            </div>
            <div className="linha">
              <button className="btn" onClick={() => setModal('suprimento')}><ArrowDownCircle size={16} /> Suprimento</button>
              <button className="btn" onClick={() => setModal('sangria')}><ArrowUpCircle size={16} /> Sangria</button>
              <button className="btn btn-primario" onClick={() => setModal({ fechar: caixa })}><LockKeyhole size={16} /> Fechar caixa</button>
            </div>
          </div>
          <div className="grade grade-2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Resumo</h3>
              {resumo ? <ResumoCaixa r={resumo} /> : <SkeletonCard altura={220} />}
            </div>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Sangrias e suprimentos</h3>
              <Tabela dados={movs} vazio="Nenhuma movimentação neste caixa" ordemInicial={{ chave: 'criado_em', dir: -1 }} colunas={[
                { chave: 'criado_em', titulo: 'Hora', tipo: 'data', classe: 'suave', render: (m) => dataHora(m.criado_em) },
                { chave: 'tipo', titulo: 'Tipo', tipo: 'opcoes', rotulo: (v) => (v === 'sangria' ? 'Sangria' : 'Suprimento'),
                  render: (m) => <span className={'selo ' + (m.tipo === 'sangria' ? 'perigo' : 'ok')}>{m.tipo === 'sangria' ? 'Sangria' : 'Suprimento'}</span> },
                { chave: 'motivo', titulo: 'Motivo', quebrar: true, render: (m) => m.motivo || '—' },
                { chave: 'valor', titulo: 'Valor', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (m) => brl(m.valor) },
              ]} />
            </div>
          </div>
        </>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Histórico de caixas</h3>
        <Tabela dados={historico} vazio="Nenhum caixa ainda" ordemInicial={{ chave: 'aberto_em', dir: -1 }}
          acoes={(c) => (
            <div className="linha" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
              {c.status === 'aberto' && admin && c.id !== caixa?.id && (
                <button className="btn" onClick={() => setModal({ fechar: c })}><LockKeyhole size={14} /> Fechar</button>
              )}
              <button className="btn btn-icone btn-fantasma" onClick={() => setModal({ ver: c.id })} aria-label="Ver detalhes"><Eye size={16} /></button>
            </div>
          )}
          colunas={[
            { chave: 'id', titulo: 'Nº', tipo: 'numero', render: (c) => '#' + c.id },
            ...(admin ? [{ chave: 'operador', titulo: 'Operador', tipo: 'opcoes', valor: (c) => c.operador?.nome || '' }] : []),
            { chave: 'aberto_em', titulo: 'Abertura', tipo: 'data', render: (c) => dataHora(c.aberto_em) },
            { chave: 'fechado_em', titulo: 'Fechamento', tipo: 'data', render: (c) => (c.fechado_em ? dataHora(c.fechado_em) : '—') },
            { chave: 'valor_esperado', titulo: 'Esperado', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (c) => (c.valor_esperado != null ? brl(c.valor_esperado) : '—') },
            { chave: 'valor_contado', titulo: 'Contado', tipo: 'numero', alinhar: 'direita', classe: 'num', render: (c) => (c.valor_contado != null ? brl(c.valor_contado) : '—') },
            { chave: 'diferenca', titulo: 'Diferença', tipo: 'numero', alinhar: 'direita', render: (c) => (c.diferenca != null ? <Diferenca valor={c.diferenca} /> : '—') },
            { chave: 'status', titulo: 'Status', tipo: 'opcoes', rotulo: (v) => (v === 'aberto' ? 'Aberto' : 'Fechado'),
              render: (c) => <span className={'selo ' + (c.status === 'aberto' ? 'ok' : '')}>{c.status === 'aberto' ? 'Aberto' : 'Fechado'}</span> },
          ]} />
      </div>

      {modal === 'abrir' && <AbrirCaixa onFechar={() => setModal(null)} onAberto={atualizarTudo} />}
      {(modal === 'sangria' || modal === 'suprimento') && (
        <MovimentoCaixa tipo={modal} onFechar={() => setModal(null)} onSalvo={() => { setModal(null); carregarAtual() }} />
      )}
      {modal?.fechar && <FecharCaixa caixa={modal.fechar} config={config} onFechar={() => setModal(null)} onFechado={atualizarTudo} />}
      {modal?.ver && <VerCaixa id={modal.ver} config={config} onFechar={() => setModal(null)} />}
    </>
  )
}

function VerCaixa({ id, config, onFechar }) {
  const [r, setR] = useState(null)
  useEffect(() => { supabase.rpc('resumo_caixa', { p_caixa: id }).then((x) => setR(checar(x))).catch(() => {}) }, [id])
  return (
    <Modal titulo={`Caixa #${id}`} onFechar={onFechar} rodape={<>
      <button className="btn" disabled={!r} onClick={() => imprimirFechamento(r, config)}><Printer size={16} /> Imprimir</button>
      <button className="btn btn-primario" onClick={onFechar}>Fechar</button>
    </>}>
      {!r ? <SkeletonCard altura={260} /> : <>
        <p className="suave" style={{ marginTop: 0 }}>
          {r.caixa.operador} · aberto em {dataHora(r.caixa.aberto_em)}
          {r.caixa.fechado_em && <> · fechado em {dataHora(r.caixa.fechado_em)}{r.caixa.fechado_por_nome && r.caixa.fechado_por_nome !== r.caixa.operador ? ` por ${r.caixa.fechado_por_nome}` : ''}</>}
        </p>
        <ResumoCaixa r={r} />
      </>}
    </Modal>
  )
}
