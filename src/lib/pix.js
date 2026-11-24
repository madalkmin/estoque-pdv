// Gera o "Pix Copia e Cola" (BR Code estático) a partir da chave da loja.
const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor

function crc16(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

const limpar = (s, max) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().slice(0, max)

export function gerarPix({ chave, nome, cidade, valor, txid = '***' }) {
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', chave.trim())
  let payload =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor ? campo('54', Number(valor).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', limpar(nome, 25) || 'LOJA') +
    campo('60', limpar(cidade, 15) || 'BRASIL') +
    campo('62', campo('05', txid)) +
    '6304'
  return payload + crc16(payload)
}
