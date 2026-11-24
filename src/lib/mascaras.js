// Máscaras e validações de documentos/contatos brasileiros
const digitos = (s, max) => String(s ?? '').replace(/\D/g, '').slice(0, max)

export const mascaras = {
  cpf: (v) => digitos(v, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'),
  cnpj: (v) => digitos(v, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2'),
  cpfCnpj: (v) => (digitos(v, 14).length <= 11 ? mascaras.cpf(v) : mascaras.cnpj(v)),
  telefone: (v) => {
    const d = digitos(v, 11)
    if (d.length <= 2) return d.replace(/^(\d{1,2})/, '($1')
    if (d.length <= 6) return d.replace(/^(\d{2})(\d+)/, '($1) $2')
    if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d+)/, '($1) $2-$3')
    return d.replace(/^(\d{2})(\d{5})(\d+)/, '($1) $2-$3')
  },
  cep: (v) => digitos(v, 8).replace(/(\d{5})(\d)/, '$1-$2'),
  codigoBarras: (v) => digitos(v, 14),
  // Moeda estilo caixa eletrônico: dígitos entram pelos centavos -> "R$ 1.234,56"
  moeda: (v) => 'R$ ' + (Number(String(v ?? '').replace(/\D/g, '').slice(0, 13) || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  // número -> "R$ 1.234,56" (valor inicial de campos com máscara moeda)
  moedaDe: (n) => (n === '' || n == null ? '' : mascaras.moeda(Math.round(Number(n) * 100))),
  // Moeda: "1234,5" -> "1.234,50" (aceita digitação livre)
  decimal: (v) => {
    let s = String(v ?? '').replace(/[^\d,]/g, '')
    const i = s.indexOf(',')
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '').slice(0, 2)
    const [int, dec] = s.split(',')
    const intFmt = (int || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return dec !== undefined ? `${intFmt || '0'},${dec}` : intFmt
  },
  quantidade: (v) => {
    let s = String(v ?? '').replace(/[^\d,]/g, '')
    const i = s.indexOf(',')
    if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '').slice(0, 3)
    return s
  },
}

export function cpfValido(v) {
  const d = digitos(v, 11)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (n) => {
    let s = 0
    for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === +d[9] && calc(10) === +d[10]
}

export function cnpjValido(v) {
  const d = digitos(v, 14)
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false
  const calc = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = pesos.reduce((a, p, i) => a + +d[i] * p, 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === +d[12] && calc(13) === +d[13]
}

export const validacoes = {
  cpf: (v) => !digitos(v) || cpfValido(v) || 'CPF inválido',
  cnpj: (v) => !digitos(v) || cnpjValido(v) || 'CNPJ inválido',
  cpfCnpj: (v) => {
    const d = digitos(v, 14)
    if (!d) return true
    if (d.length <= 11) return cpfValido(d) || 'CPF inválido'
    return cnpjValido(d) || 'CNPJ inválido'
  },
  telefone: (v) => { const n = digitos(v, 11).length; return !n || n === 10 || n === 11 || 'Telefone incompleto' },
  email: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || 'E-mail inválido',
}

// Remove caracteres de controle e espaços extras; limita tamanho
export const sanitizar = (s, max = 200) => String(s ?? '').replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, max)

export function forcaSenha(s = '') {
  let p = 0
  if (s.length >= 8) p++
  if (s.length >= 12) p++
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) p++
  if (/\d/.test(s)) p++
  if (/[^A-Za-z0-9]/.test(s)) p++
  const nivel = Math.min(4, p)
  return { nivel, texto: ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'][nivel] }
}
