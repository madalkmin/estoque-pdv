const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const brl = (v) => moeda.format(Number(v) || 0)
export const num = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
export const dataHora = (d) => new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
export const data = (d) => new Date(d).toLocaleDateString('pt-BR')

// Aceita "12,50" ou "12.50"
export const parseNum = (s) => {
  if (typeof s === 'number') return s
  const t = String(s ?? '').trim()
  const milhar = /^-?\d{1,3}(\.\d{3})+$/.test(t)
  const n = parseFloat(t.includes(',') || milhar ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) ? n : 0
}

export const formasPagamento = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  fiado: 'Fiado',
}

export const nomeVariacao = (v) =>
  v.produtos?.nome + (v.nome && v.nome !== 'Padrão' ? ` - ${v.nome}` : '')

export function inicioDoDia(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}
