import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Painel flutuante ancorado a um elemento, renderizado no <body>.
 * Fecha ao clicar fora, Esc, e se reposiciona em scroll/resize.
 */
export function Popover({ ancora, aberto, onFechar, children, largura, alinhar = 'inicio', className = '' }) {
  const painel = useRef()
  const [pos, setPos] = useState(null)

  function posicionar() {
    const r = ancora.current?.getBoundingClientRect()
    if (!r) return
    const w = largura || Math.max(r.width, 220)
    const h = painel.current?.offsetHeight || 320
    const cabeEmbaixo = window.innerHeight - r.bottom > h + 12
    let left = alinhar === 'fim' ? r.right - w : r.left
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
    setPos({ left, width: w, top: cabeEmbaixo || r.top < h ? r.bottom + 6 : r.top - h - 6, paraCima: !(cabeEmbaixo || r.top < h) })
  }

  useLayoutEffect(() => { if (aberto) posicionar() }, [aberto])
  useLayoutEffect(() => { if (aberto && pos) posicionar() }, [aberto && painel.current?.offsetHeight])

  useEffect(() => {
    if (!aberto) return
    const fora = (e) => {
      if (painel.current?.contains(e.target) || ancora.current?.contains(e.target)) return
      // cliques dentro de um painel aberto depois deste (ex.: calendário dentro do filtro) não fecham
      const outro = e.target.closest?.('.pop, .sel-painel')
      if (outro && painel.current && painel.current.compareDocumentPosition(outro) & Node.DOCUMENT_POSITION_FOLLOWING) return
      onFechar()
    }
    const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onFechar() } }
    const mover = (e) => { if (!painel.current?.contains(e.target)) posicionar() }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc, true)
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', mover, true)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc, true)
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', mover, true)
    }
  }, [aberto])

  if (!aberto) return null
  return createPortal(
    <div ref={painel} className={'pop ' + (pos?.paraCima ? 'para-cima ' : '') + className}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: pos?.width }}>
      {children}
    </div>,
    document.body
  )
}
