// Checkbox universal animado. Use `interruptor` para o estilo toggle.
export default function Checkbox({ checked, onChange, children, disabled, interruptor, descricao }) {
  return (
    <label className={'chk' + (disabled ? ' chk-desab' : '')}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {interruptor
        ? <span className="chk-toggle" aria-hidden><span /></span>
        : <span className="chk-caixa" aria-hidden><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" /></svg></span>}
      {(children || descricao) && <span className="chk-texto">{children}{descricao && <small>{descricao}</small>}</span>}
    </label>
  )
}
