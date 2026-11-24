import { brl, num, dataHora, formasPagamento } from './formato'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Abre o cupom não fiscal em uma janela e chama a impressão (impressora térmica 58/80mm)
export function imprimirCupom({ venda, itens, pagamentos, cliente, config, operador }) {
  const largura = config?.largura_cupom || '80mm'
  const linhas = itens.map((i) => `
    <div class="item">${esc(i.descricao)}</div>
    <div class="row"><span>${num(i.quantidade)} x ${brl(i.preco_unitario)}</span><span>${brl(i.quantidade * i.preco_unitario)}</span></div>`).join('')
  const pags = pagamentos.map((p) => `<div class="row"><span>${formasPagamento[p.forma]}</span><span>${brl(p.valor)}</span></div>`).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Cupom #${venda.id}</title>
  <style>
    @page { size: ${largura} auto; margin: 0 }
    body { font-family: 'Courier New', monospace; font-size: ${largura === '58mm' ? '10px' : '12px'}; width: ${largura}; margin: 0; padding: 3mm; box-sizing: border-box; color:#000 }
    .c { text-align: center } .b { font-weight: bold } hr { border: 0; border-top: 1px dashed #000; margin: 4px 0 }
    .row { display: flex; justify-content: space-between; gap: 6px } .item { margin-top: 3px }
    .tot { font-size: 1.3em }
  </style></head><body>
    <div class="c b">${esc(config?.nome_loja)}</div>
    ${config?.documento ? `<div class="c">${esc(config.documento)}</div>` : ''}
    ${config?.endereco ? `<div class="c">${esc(config.endereco)}</div>` : ''}
    ${config?.telefone ? `<div class="c">${esc(config.telefone)}</div>` : ''}
    <hr><div class="c b">CUPOM NÃO FISCAL</div>
    <div class="row"><span>Venda #${venda.id}</span><span>${dataHora(venda.criado_em)}</span></div>
    ${cliente ? `<div>Cliente: ${esc(cliente.nome)}</div>` : ''}
    ${operador ? `<div>Operador: ${esc(operador)}</div>` : ''}
    <hr>${linhas}<hr>
    <div class="row"><span>Subtotal</span><span>${brl(venda.subtotal)}</span></div>
    ${Number(venda.desconto) > 0 ? `<div class="row"><span>Desconto</span><span>-${brl(venda.desconto)}</span></div>` : ''}
    <div class="row b tot"><span>TOTAL</span><span>${brl(venda.total)}</span></div>
    <hr>${pags}
    ${Number(venda.troco) > 0 ? `<div class="row b"><span>Troco</span><span>${brl(venda.troco)}</span></div>` : ''}
    <hr><div class="c">${esc(config?.mensagem_cupom || '')}</div>
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300) }</script>
  </body></html>`

  const w = window.open('', '_blank', 'width=400,height=600')
  if (!w) return alert('Permita pop-ups para imprimir o cupom.')
  w.document.write(html)
  w.document.close()
}
