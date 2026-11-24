import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Search, Trash2, Minus, Plus, UserPlus, X, Printer, Check, Banknote, QrCode, CreditCard, Wallet, NotebookPen } from 'lucide-react'
import { supabase, checar } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { brl, num, parseNum, formasPagamento, nomeVariacao } from '../lib/formato'
import { gerarPix } from '../lib/pix'
import { imprimirCupom } from '../lib/cupom'
import { Modal, Campo, useAcao, useAviso, Botao } from '../componentes/ui'
import { Input } from '../componentes/Input'
import { sanitizar, validacoes, mascaras } from '../lib/mascaras'

const iconesForma = { dinheiro: Banknote, pix: QrCode, credito: CreditCard, debito: Wallet, fiado: NotebookPen }

export default function PDV() {
  const { admin, perfil } = useAuth()
  const avisar = useAviso()
  const [catalogo, setCatalogo] = useState([])
  const [clientes, setClientes] = useState([])
  const [config, setConfig] = useState(null)
  const [busca, setBusca] = useState('')
  const [foco, setFoco] = useState(0)
  const [carrinho, setCarrinho] = useState([])
  const [cliente, setCliente] = useState(null)
  const [desconto, setDesconto] = useState('')
  const [pagando, setPagando] = useState(false)
  const [escolherCliente, setEscolherCliente] = useState(false)
  const [concluida, setConcluida] = useState(null)
  const [ultimo, setUltimo] = useState(null)
  const buscaRef = useRef()

  async function carregar() {
    const [v, c, cfg] = await Promise.all([
      supabase.from('variacoes').select('id, nome, sku, codigo_barras, preco_venda, estoque, produtos!inner(nome, ativo)').eq('ativo', true).eq('produtos.ativo', true),
      supabase.from('clientes').select('*').eq('ativo', true).order('nome'),
      supabase.from('configuracoes').select('*').single(),
    ])
    const saldos = Object.fromEntries(((await supabase.from('saldo_clientes').select('*')).data || []).map((x) => [x.cliente_id, Number(x.saldo)]))
    setCatalogo((v.data || []).map((x) => ({ ...x, rotulo: nomeVariacao(x) })))
    setClientes((c.data || []).map((x) => ({ ...x, saldo: saldos[x.id] || 0 })))
    setConfig(cfg.data)
  }
  useEffect(() => { carregar(); buscaRef.current?.focus() }, [])

  const sugestoes = useMemo(() => {
    const t = busca.trim().toLowerCase()
    if (!t) return []
    return catalogo.filter((v) => v.rotulo.toLowerCase().includes(t) || v.codigo_barras === t || v.sku?.toLowerCase() === t).slice(0, 12)
  }, [busca, catalogo])

  const subtotal = carrinho.reduce((s, i) => s + i.quantidade * i.preco, 0)
  const desc = Math.min(parseNum(desconto), subtotal)
  const total = Math.max(0, Math.round((subtotal - desc) * 100) / 100)

  function adicionar(v, qtd = 1) {
    setCarrinho((c) => {
      const existe = c.find((i) => i.id === v.id)
      if (existe) return c.map((i) => (i.id === v.id ? { ...i, quantidade: i.quantidade + qtd } : i))
      return [...c, { id: v.id, rotulo: v.rotulo, preco: Number(v.preco_venda), estoque: Number(v.estoque), quantidade: qtd }]
    })
    setUltimo({ id: v.id, t: Date.now() })
    if (Number(v.estoque) < qtd) avisar(`Atenção: "${v.rotulo}" está com estoque ${num(v.estoque)}`, 'erro')
    setBusca(''); setFoco(0)
    buscaRef.current?.focus()
  }

  function teclaBusca(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFoco((f) => Math.min(f + 1, sugestoes.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco((f) => Math.max(f - 1, 0)) }
    else if (e.key === 'Escape') setBusca('')
    else if (e.key === 'Enter') {
      e.preventDefault()
      // "3*789..." adiciona 3 unidades
      const m = busca.trim().match(/^(\d+(?:[.,]\d+)?)\*(.+)$/)
      const qtd = m ? parseNum(m[1]) : 1
      const termo = (m ? m[2] : busca).trim()
      const exato = catalogo.find((v) => v.codigo_barras === termo || (v.sku && v.sku.toLowerCase() === termo.toLowerCase()))
      if (exato) return adicionar(exato, qtd)
      if (sugestoes[foco]) return adicionar(sugestoes[foco], qtd)
      if (termo) avisar('Produto não encontrado', 'erro')
    }
  }

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'F2' && carrinho.length && !pagando) { e.preventDefault(); setPagando(true) }
      if (e.key === 'F4') { e.preventDefault(); setEscolherCliente(true) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [carrinho.length, pagando])

  const setQtd = (id, q) => setCarrinho((c) => c.map((i) => (i.id === id ? { ...i, quantidade: Math.max(0.001, q) } : i)))
  const setPreco = (id, p) => setCarrinho((c) => c.map((i) => (i.id === id ? { ...i, preco: p } : i)))

  function limpar() { setCarrinho([]); setCliente(null); setDesconto(''); buscaRef.current?.focus() }

  return (
    <div className="pdv">
      <div>
        <div className="card">
          <div className="busca pdv-busca" style={{ position: 'relative' }}>
            <Search size={20} />
            <input ref={buscaRef} placeholder="Bipe o código de barras ou digite o nome do produto" value={busca}
              onChange={(e) => { setBusca(e.target.value); setFoco(0) }} onKeyDown={teclaBusca} />
            {sugestoes.length > 0 && (
              <div className="sugestoes">
                {sugestoes.map((v, i) => (
                  <button key={v.id} className={i === foco ? 'foco' : ''} onMouseEnter={() => setFoco(i)} onClick={() => adicionar(v)}>
                    <span>{v.rotulo}<br /><small className="suave">{v.codigo_barras || v.sku || ''} · estoque {num(v.estoque)}</small></span>
                    <b className="num">{brl(v.preco_venda)}</b>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="atalhos">
            <span><kbd>Enter</kbd> adicionar</span><span><kbd>3*código</kbd> quantidade</span><span><kbd>F2</kbd> finalizar</span><span><kbd>F4</kbd> cliente</span>
          </div>
        </div>

        <div className="card">
          <div className="tabela-wrap"><table>
            <thead><tr><th>Item</th><th>Qtd</th><th className="direita">Unitário</th><th className="direita">Total</th><th /></tr></thead>
            <tbody>
              {carrinho.map((i) => (
                <tr key={i.id + (ultimo?.id === i.id ? '-' + ultimo.t : '')} className={ultimo?.id === i.id ? 'nova' : ''}>
                  <td style={{ whiteSpace: 'normal' }}>{i.rotulo}</td>
                  <td><div className="qtd">
                    <button className="btn btn-icone" onClick={() => setQtd(i.id, i.quantidade - 1)} disabled={i.quantidade <= 1}><Minus size={14} /></button>
                    <input value={i.quantidade} inputMode="decimal" onChange={(e) => setQtd(i.id, parseNum(e.target.value))} />
                    <button className="btn btn-icone" onClick={() => setQtd(i.id, i.quantidade + 1)}><Plus size={14} /></button>
                  </div></td>
                  <td className="direita num">
                    {admin
                      ? <input className="inp-moeda" inputMode="numeric" value={mascaras.moedaDe(i.preco)}
                          onChange={(e) => setPreco(i.id, Number(e.target.value.replace(/\D/g, '').slice(0, 13) || 0) / 100)}
                          onFocus={(e) => { const el = e.target; requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length)) }}
                          title="Preço editável pelo administrador" />
                      : brl(i.preco)}
                  </td>
                  <td className="direita num"><b>{brl(i.quantidade * i.preco)}</b></td>
                  <td className="direita"><button className="btn btn-icone btn-fantasma btn-perigo" onClick={() => setCarrinho(carrinho.filter((x) => x.id !== i.id))} aria-label="Remover"><Trash2 size={16} /></button></td>
                </tr>
              ))}
              {!carrinho.length && <tr><td colSpan={5} className="vazio">Carrinho vazio. Bipe ou busque um produto para começar.</td></tr>}
            </tbody>
          </table></div>
        </div>
      </div>

      <div className="card" style={{ position: 'sticky', top: 16 }}>
        <div className="linha" style={{ justifyContent: 'space-between' }}>
          <span className="suave">Cliente</span>
          {cliente
            ? <span className="linha"><b>{cliente.nome}</b><button className="btn btn-icone btn-fantasma" onClick={() => setCliente(null)}><X size={15} /></button></span>
            : <button className="btn" onClick={() => setEscolherCliente(true)}><UserPlus size={16} /> Selecionar</button>}
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--borda)', margin: '14px 0' }} />
        <div className="resumo-linha"><span className="suave">Itens</span><span className="num">{num(carrinho.reduce((s, i) => s + i.quantidade, 0))}</span></div>
        <div className="resumo-linha"><span className="suave">Subtotal</span><span className="num">{brl(subtotal)}</span></div>
        <div className="resumo-linha" style={{ alignItems: 'center' }}>
          <span className="suave">Desconto (R$)</span>
          <Input style={{ width: 130, textAlign: 'right' }} mascara="moeda" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
        </div>
        <div style={{ margin: '14px 0' }}><div className="suave">Total</div><div className="resumo-total mudou" key={total}>{brl(total)}</div></div>
        <button className="btn btn-primario btn-grande" style={{ width: '100%' }} disabled={!carrinho.length} onClick={() => setPagando(true)}>Finalizar venda <kbd className="kbd-btn">F2</kbd></button>
        <button className="btn btn-fantasma" style={{ width: '100%', marginTop: 8 }} disabled={!carrinho.length} onClick={() => confirm('Cancelar esta venda?') && limpar()}>Cancelar venda</button>
      </div>

      {escolherCliente && <SelecionarCliente clientes={clientes} onFechar={() => setEscolherCliente(false)}
        onEscolher={(c) => { setCliente(c); setEscolherCliente(false) }} onCriado={carregar} />}

      {pagando && <Pagamento total={total} cliente={cliente} config={config} onFechar={() => setPagando(false)}
        onConfirmar={async (pagamentos) => {
          const id = checar(await supabase.rpc('registrar_venda', { p: {
            cliente_id: cliente?.id || null, desconto: desc,
            itens: carrinho.map((i) => ({ variacao_id: i.id, quantidade: i.quantidade, ...(admin ? { preco_unitario: i.preco } : {}) })),
            pagamentos,
          } }))
          const [v, it, pg] = await Promise.all([
            supabase.from('vendas').select('*').eq('id', id).single(),
            supabase.from('venda_itens').select('*').eq('venda_id', id),
            supabase.from('venda_pagamentos').select('*').eq('venda_id', id),
          ])
          setConcluida({ venda: v.data, itens: it.data, pagamentos: pg.data, cliente, config, operador: perfil.nome })
          setPagando(false); limpar(); carregar()
        }} />}

      {concluida && (
        <Modal titulo={`Venda #${concluida.venda.id} concluída`} onFechar={() => { setConcluida(null); buscaRef.current?.focus() }} rodape={<>
          <button className="btn" onClick={() => imprimirCupom(concluida)}><Printer size={16} /> Imprimir cupom</button>
          <button className="btn btn-primario" autoFocus onClick={() => { setConcluida(null); buscaRef.current?.focus() }}>Nova venda</button>
        </>}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 99, background: 'var(--sucesso)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}><Check size={30} /></div>
            <div className="resumo-total">{brl(concluida.venda.total)}</div>
            {Number(concluida.venda.troco) > 0 && <p style={{ fontSize: 18 }}>Troco: <b>{brl(concluida.venda.troco)}</b></p>}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Pagamento({ total, cliente, config, onFechar, onConfirmar }) {
  const [pags, setPags] = useState([])
  const [forma, setForma] = useState('dinheiro')
  const [valor, setValor] = useState('')
  const [qr, setQr] = useState(null)
  const [executar, ocupado] = useAcao()
  const valorRef = useRef()

  const pago = pags.reduce((s, p) => s + p.valor, 0)
  const falta = Math.max(0, Math.round((total - pago) * 100) / 100)
  const troco = Math.max(0, Math.round((pago - total) * 100) / 100)

  useEffect(() => { setValor(falta ? mascaras.moedaDe(falta) : ''); valorRef.current?.select() }, [falta, forma])

  useEffect(() => {
    const pix = pags.filter((p) => p.forma === 'pix').reduce((s, p) => s + p.valor, 0)
    if (pix > 0 && config?.chave_pix) {
      QRCode.toDataURL(gerarPix({ chave: config.chave_pix, nome: config.nome_pix || config.nome_loja, cidade: config.cidade_pix, valor: pix }), { margin: 1, width: 400 }).then(setQr)
    } else setQr(null)
  }, [pags, config])

  function adicionar(e) {
    e?.preventDefault()
    const v = parseNum(valor)
    if (v <= 0) return
    if (forma !== 'dinheiro' && v > falta + 0.001) return alert('Somente dinheiro pode ultrapassar o valor (para troco).')
    if (forma === 'fiado' && !cliente) return alert('Selecione um cliente para vender fiado.')
    setPags([...pags, { forma, valor: v }])
  }

  return (
    <Modal titulo="Pagamento" onFechar={onFechar} rodape={<>
      <button className="btn" onClick={onFechar}>Voltar</button>
      <Botao className="btn-sucesso btn-grande" carregando={ocupado} disabled={falta > 0} onClick={() => executar(() => onConfirmar(pags)).catch(() => {})}>{!ocupado && <Check size={18} />} Concluir venda</Botao>
    </>}>
      <div className="linha" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div><div className="suave">Total</div><div className="resumo-total">{brl(total)}</div></div>
        <div style={{ textAlign: 'right' }}>
          {falta > 0 ? <><div className="suave">Falta</div><div className="resumo-total" style={{ color: 'var(--perigo)' }}>{brl(falta)}</div></>
            : <><div className="suave">Troco</div><div className="resumo-total" style={{ color: 'var(--sucesso)' }}>{brl(troco)}</div></>}
        </div>
      </div>
      {falta > 0 && <form onSubmit={adicionar}>
        <div className="formas">
          {Object.entries(formasPagamento).map(([k, nome]) => {
            const I = iconesForma[k]
            return <button type="button" key={k} className={'btn' + (forma === k ? ' ativa' : '')} onClick={() => setForma(k)}><I size={16} />{nome}</button>
          })}
        </div>
        <div className="linha" style={{ marginTop: 12 }}>
          <Input ref={valorRef} autoFocus mascara="moeda" className="inp-grande" style={{ height: 46, fontSize: 18 }} value={valor} onChange={(e) => setValor(e.target.value)} />
          <button className="btn btn-primario" style={{ height: 46 }}>Adicionar</button>
        </div>
        {forma === 'fiado' && cliente && <p className="suave">Saldo devedor atual de {cliente.nome}: {brl(cliente.saldo || 0)}</p>}
        {forma === 'pix' && !config?.chave_pix && <p className="suave">Cadastre a chave Pix em Configurações para gerar o QR Code.</p>}
      </form>}
      {pags.length > 0 && <div className="tabela-wrap" style={{ marginTop: 12 }}><table><tbody>
        {pags.map((p, i) => (
          <tr key={i}><td>{formasPagamento[p.forma]}</td><td className="direita num">{brl(p.valor)}</td>
            <td className="direita"><button className="btn btn-icone btn-fantasma" onClick={() => setPags(pags.filter((_, j) => j !== i))}><X size={15} /></button></td></tr>
        ))}
      </tbody></table></div>}
      {qr && <div className="qr"><img src={qr} alt="QR Code Pix" /><span className="suave">Peça para o cliente escanear e confirme o recebimento antes de concluir.</span></div>}
    </Modal>
  )
}

function SelecionarCliente({ clientes, onFechar, onEscolher, onCriado }) {
  const [t, setT] = useState('')
  const [novo, setNovo] = useState(null)
  const [executar, ocupado] = useAcao()
  const dig = t.replace(/\D/g, '')
  const lista = clientes.filter((c) => c.nome.toLowerCase().includes(t.toLowerCase()) || (dig && (c.telefone?.replace(/\D/g, '').includes(dig) || c.documento?.replace(/\D/g, '').includes(dig)))).slice(0, 30)

  if (novo) return (
    <Modal titulo="Novo cliente" onFechar={() => setNovo(null)} rodape={<>
      <button className="btn" onClick={() => setNovo(null)}>Voltar</button>
      <Botao className="btn-primario" carregando={ocupado} disabled={!novo.nome.trim()} onClick={() => executar(async () => {
        const tel = validacoes.telefone(novo.telefone); if (tel !== true) throw new Error(tel)
        const c = checar(await supabase.from('clientes').insert({ nome: sanitizar(novo.nome, 120), telefone: novo.telefone || null }).select().single())
        onCriado(); onEscolher({ ...c, saldo: 0 })
      }, 'Cliente cadastrado').catch(() => {})}>Salvar</Botao>
    </>}>
      <div className="form">
        <Campo label="Nome"><Input autoFocus maxLength={120} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Campo>
        <Campo label="Telefone"><Input mascara="telefone" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} /></Campo>
      </div>
    </Modal>
  )

  return (
    <Modal titulo="Selecionar cliente" onFechar={onFechar} rodape={<button className="btn" onClick={() => setNovo({ nome: t, telefone: '' })}><UserPlus size={16} /> Cadastrar novo</button>}>
      <input autoFocus placeholder="Buscar por nome, telefone ou documento" value={t} onChange={(e) => setT(e.target.value)} />
      <div className="tabela-wrap" style={{ marginTop: 10 }}><table><tbody>
        {lista.map((c) => (
          <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onEscolher(c)}>
            <td><b>{c.nome}</b><div className="suave" style={{ fontSize: 12 }}>{c.telefone}</div></td>
            <td className="direita">{c.saldo > 0 && <span className="selo alerta">Deve {brl(c.saldo)}</span>}</td>
          </tr>
        ))}
        {!lista.length && <tr><td className="vazio">Nenhum cliente encontrado</td></tr>}
      </tbody></table></div>
    </Modal>
  )
}
