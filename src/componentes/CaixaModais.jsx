import { useEffect, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, LockKeyhole, Unlock, Printer } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { brl, dataHora, parseNum, formasPagamento } from '../lib/formato'
import { sanitizar } from '../lib/mascaras'
import { imprimirFechamento } from '../lib/cupom'
import { Modal, Campo, Botao, useAcao } from './ui'
import { Input } from './Input'
import { SkeletonLinhas } from './Skeleton'
import { confirmar, toast } from '../lib/notificar'

/* Busca o caixa aberto do usuário logado: undefined = carregando, null = fechado */
export function useCaixaAberto() {
  const [caixa, setCaixa] = useState(undefined)
  async function recarregar() {
    const id = checar(await supabase.rpc('caixa_aberto_id'))
    if (!id) return setCaixa(null)
    setCaixa(checar(await supabase.from('caixas').select('*').eq('id', id).single()))
  }
  useEffect(() => { recarregar().catch(() => setCaixa(null)) }, [])
  return [caixa, recarregar]
}

export function AbrirCaixa({ onFechar, onAberto }) {
  const [valor, setValor] = useState('')
  const [executar, ocupado] = useAcao()
  const abrir = (e) => {
    e?.preventDefault()
    executar(async () => checar(await supabase.rpc('abrir_caixa', { p_valor: parseNum(valor) })), 'Caixa aberto').then(onAberto, () => {})
  }
  return (
    <Modal titulo="Abrir caixa" onFechar={onFechar} rodape={<>
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <Botao className="btn-primario" carregando={ocupado} onClick={abrir}><Unlock size={16} /> Abrir caixa</Botao>
    </>}>
      <form onSubmit={abrir}>
        <p className="suave" style={{ marginTop: 0 }}>Informe o dinheiro que já está na gaveta para troco (fundo de caixa).</p>
        <Campo label="Valor inicial em dinheiro">
          <Input autoFocus mascara="moeda" className="inp-grande" style={{ height: 46, fontSize: 18 }} value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
      </form>
    </Modal>
  )
}

export function MovimentoCaixa({ tipo, onFechar, onSalvo }) {
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [executar, ocupado] = useAcao()
  const sangria = tipo === 'sangria'
  const salvar = (e) => {
    e?.preventDefault()
    executar(async () => {
      const v = parseNum(valor)
      if (v <= 0) throw new Error('Informe um valor maior que zero')
      checar(await supabase.rpc('movimentar_caixa', { p_tipo: tipo, p_valor: v, p_motivo: sanitizar(motivo, 200) || null }))
    }, sangria ? 'Sangria registrada' : 'Suprimento registrado').then(onSalvo, () => {})
  }
  return (
    <Modal titulo={sangria ? 'Sangria (retirada)' : 'Suprimento (reforço)'} onFechar={onFechar} rodape={<>
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <Botao className={sangria ? 'btn-perigo-cheio' : 'btn-primario'} carregando={ocupado} onClick={salvar}>
        {sangria ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />} Registrar
      </Botao>
    </>}>
      <form className="form" onSubmit={salvar}>
        <p className="suave inteiro" style={{ margin: 0 }}>
          {sangria ? 'Dinheiro retirado da gaveta (ex.: levar ao cofre, pagar uma despesa).' : 'Dinheiro colocado na gaveta (ex.: reforço de troco).'}
        </p>
        <Campo label="Valor" inteiro>
          <Input autoFocus mascara="moeda" className="inp-grande" style={{ height: 46, fontSize: 18 }} value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
        <Campo label="Motivo" inteiro><input maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={sangria ? 'Ex.: depósito no cofre' : 'Ex.: troco'} /></Campo>
      </form>
    </Modal>
  )
}

/* Bloco com os números do caixa */
export function ResumoCaixa({ r }) {
  const formas = Object.entries(r.por_forma || {})
  const fiado = Object.entries(r.fiado_recebido || {})
  return (
    <div className="caixa-resumo">
      <div className="resumo-linha"><span className="suave">Fundo de abertura</span><span className="num">{brl(r.caixa.valor_abertura)}</span></div>
      <div className="resumo-linha"><span className="suave">Vendas ({r.vendas_qtd})</span><b className="num">{brl(r.vendas_total)}</b></div>
      {formas.map(([f, v]) => <div key={f} className="resumo-linha sub"><span>{formasPagamento[f] || f}</span><span className="num">{brl(v)}</span></div>)}
      {fiado.length > 0 && <div className="resumo-linha"><span className="suave">Fiado recebido</span><span /></div>}
      {fiado.map(([f, v]) => <div key={f} className="resumo-linha sub"><span>{formasPagamento[f] || f}</span><span className="num">{brl(v)}</span></div>)}
      <div className="resumo-linha"><span className="suave">Suprimentos</span><span className="num" style={{ color: 'var(--sucesso)' }}>+ {brl(r.suprimentos)}</span></div>
      <div className="resumo-linha"><span className="suave">Sangrias</span><span className="num" style={{ color: 'var(--perigo)' }}>− {brl(r.sangrias)}</span></div>
      {r.canceladas_qtd > 0 && <div className="resumo-linha"><span className="suave">Canceladas ({r.canceladas_qtd})</span><span className="num suave">{brl(r.canceladas_total)}</span></div>}
      <div className="resumo-linha destaque"><span>Dinheiro esperado na gaveta</span><b className="num">{brl(r.dinheiro_esperado)}</b></div>
      {r.caixa.status === 'fechado' && <>
        <div className="resumo-linha"><span className="suave">Contado no fechamento</span><b className="num">{brl(r.caixa.valor_contado)}</b></div>
        <div className="resumo-linha"><span className="suave">Diferença</span><Diferenca valor={r.caixa.diferenca} /></div>
        {r.caixa.observacoes && <p className="suave" style={{ margin: '8px 0 0' }}>Obs.: {r.caixa.observacoes}</p>}
      </>}
    </div>
  )
}

export function Diferenca({ valor }) {
  const v = Number(valor || 0)
  const cls = Math.abs(v) < 0.005 ? 'ok' : v > 0 ? 'alerta' : 'perigo'
  return <span className={'selo ' + cls}>{Math.abs(v) < 0.005 ? 'Sem diferença' : (v > 0 ? 'Sobra ' : 'Falta ') + brl(Math.abs(v))}</span>
}

export function FecharCaixa({ caixa, config, onFechar, onFechado }) {
  const [r, setR] = useState(null)
  const [contado, setContado] = useState('')
  const [obs, setObs] = useState('')
  const [final, setFinal] = useState(null)
  const [executar, ocupado] = useAcao()

  useEffect(() => { supabase.rpc('resumo_caixa', { p_caixa: caixa.id }).then((x) => setR(checar(x))).catch(() => {}) }, [caixa.id])

  const dif = contado === '' || !r ? null : Math.round((parseNum(contado) - Number(r.dinheiro_esperado)) * 100) / 100
  const fechar = () => executar(async () => {
    if (contado === '') throw new Error('Conte o dinheiro da gaveta e informe o valor')
    if (dif !== 0 && !(await confirmar({ titulo: dif > 0 ? 'Sobra no caixa' : 'Falta no caixa', mensagem: `O valor contado está ${brl(Math.abs(dif))} ${dif > 0 ? 'acima' : 'abaixo'} do esperado. Deseja fechar mesmo assim?`, tipo: 'alerta', confirmar: 'Fechar caixa', cancelar: 'Recontar' }))) return null
    return checar(await supabase.rpc('fechar_caixa', { p_valor_contado: parseNum(contado), p_obs: sanitizar(obs, 500) || null, p_caixa: caixa.id }))
  }).then((res) => { if (res) { setFinal(res); toast('Caixa fechado') } }, () => {})

  if (final) return (
    <Modal titulo={`Caixa #${final.caixa.id} fechado`} onFechar={onFechado} rodape={<>
      <button className="btn" onClick={() => imprimirFechamento(final, config)}><Printer size={16} /> Imprimir</button>
      <button className="btn btn-primario" onClick={onFechado}>Concluir</button>
    </>}>
      <ResumoCaixa r={final} />
    </Modal>
  )

  return (
    <Modal titulo={`Fechar caixa #${caixa.id}`} onFechar={onFechar} rodape={<>
      <button className="btn" onClick={onFechar}>Voltar</button>
      <Botao className="btn-primario" carregando={ocupado} disabled={!r} onClick={fechar}><LockKeyhole size={16} /> Fechar caixa</Botao>
    </>}>
      {!r ? <table><tbody><SkeletonLinhas linhas={6} colunas={2} /></tbody></table> : <>
        <p className="suave" style={{ marginTop: 0 }}>Aberto em {dataHora(r.caixa.aberto_em)}{r.caixa.operador ? ` por ${r.caixa.operador}` : ''}.</p>
        <ResumoCaixa r={r} />
        <div className="form" style={{ marginTop: 16 }}>
          <Campo label="Dinheiro contado na gaveta" inteiro>
            <Input autoFocus mascara="moeda" className="inp-grande" style={{ height: 46, fontSize: 18 }} value={contado} onChange={(e) => setContado(e.target.value)} />
          </Campo>
          {dif !== null && <div className="inteiro linha" style={{ justifyContent: 'space-between' }}><span className="suave">Diferença</span><Diferenca valor={dif} /></div>}
          <Campo label="Observações" inteiro><input maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></Campo>
        </div>
      </>}
    </Modal>
  )
}

