import { tema } from './tema'

const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())
const CHAVE = 'estoque-pdv:modo'

export function modoAtual() {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo) return salvo
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

export function aplicarTema(modo = modoAtual()) {
  const raiz = document.documentElement
  const cores = modo === 'escuro' ? tema.coresEscuro : tema.cores
  Object.entries(cores).forEach(([k, v]) => raiz.style.setProperty('--' + kebab(k), v))
  raiz.style.setProperty('--fonte', tema.fonte)
  raiz.style.setProperty('--raio', tema.arredondamento)
  raiz.style.colorScheme = modo === 'escuro' ? 'dark' : 'light'
  document.title = `${tema.nomeEmpresa} · ${tema.slogan}`
  try { localStorage.setItem(CHAVE, modo) } catch {}
  return modo
}
