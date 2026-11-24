/**
 * API universal de avisos, usável em qualquer arquivo (inclusive fora de componentes):
 *
 *   toast('Produto salvo')                          // sucesso
 *   toast('Falha ao salvar', 'erro')                // tipos: sucesso | erro | alerta | info
 *   toast('Venda #12', 'sucesso', { titulo: 'Concluída', acao: { rotulo: 'Desfazer', onClick } })
 *   toast.promessa(fetch(...), { carregando: 'Salvando…', sucesso: 'Salvo', erro: (e) => e.message })
 *
 *   if (await confirmar({ titulo: 'Excluir?', mensagem: '...', tipo: 'perigo', confirmar: 'Excluir' })) ...
 *   await alertar({ titulo: 'Atenção', mensagem: '...', tipo: 'alerta' })
 *
 * O <AvisoProvider> registra as implementações; sem ele cai no nativo do navegador.
 */
const ponte = {}
export const registrarPonte = (p) => Object.assign(ponte, p)

const textoDe = (op) => (typeof op === 'string' ? op : [op?.titulo, op?.mensagem].filter(Boolean).join('\n\n'))

export function toast(texto, tipo, opcoes) {
  if (ponte.avisar) return ponte.avisar(texto, tipo, opcoes)
  console.info(texto)
}
toast.promessa = (p, msgs) => (ponte.avisar ? ponte.avisar.promessa(p, msgs) : p)
toast.fechar = (id) => ponte.avisar?.fechar(id)

export const confirmar = (op) => (ponte.confirmar ? ponte.confirmar(op) : Promise.resolve(window.confirm(textoDe(op))))
export const alertar = (op) => (ponte.alertar ? ponte.alertar(op) : Promise.resolve(window.alert(textoDe(op))))

/* Traduz erros técnicos (Supabase/rede) em mensagens claras */
export function humanizarErro(e) {
  const m = String(e?.message || e || '')
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.'
  if (/jwt expired|invalid jwt|refresh token/i.test(m)) return 'Sua sessão expirou. Entre novamente.'
  if (/duplicate key|unique constraint|already exists/i.test(m)) return 'Já existe um registro com esses dados.'
  if (/foreign key|violates.*constraint.*references|still referenced/i.test(m)) return 'Este registro está em uso e não pode ser excluído.'
  if (/row-level security|permission denied|not authorized/i.test(m)) return 'Você não tem permissão para esta ação.'
  if (/timeout|timed out/i.test(m)) return 'O servidor demorou para responder. Tente novamente.'
  return m || 'Erro inesperado'
}
