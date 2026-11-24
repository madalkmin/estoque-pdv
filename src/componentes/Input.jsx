import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { mascaras, validacoes } from '../lib/mascaras'

const limites = { cpf: 14, cnpj: 18, cpfCnpj: 18, telefone: 15, cep: 9, codigoBarras: 14, decimal: 16, quantidade: 12, moeda: 20 }
const teclados = { cpf: 'numeric', cnpj: 'numeric', cpfCnpj: 'numeric', telefone: 'tel', cep: 'numeric', codigoBarras: 'numeric', decimal: 'decimal', quantidade: 'decimal', moeda: 'numeric' }
const placeholders = { cpf: '000.000.000-00', cnpj: '00.000.000/0000-00', cpfCnpj: 'CPF ou CNPJ', telefone: '(00) 00000-0000', cep: '00000-000', decimal: '0,00', moeda: 'R$ 0,00' }

/**
 * Input universal com máscara, validação no blur e ícone opcional.
 * mascara: cpf | cnpj | cpfCnpj | telefone | cep | codigoBarras | decimal | moeda | quantidade
 * validar: nome de validação (cpf, cnpj, cpfCnpj, telefone, email) — por padrão usa a da máscara
 */
export const Input = forwardRef(function Input({ mascara, validar, icone: Icone, value, onChange, onBlur, className = '', erro: erroExterno, style, ...resto }, ref) {
  const [erro, setErro] = useState(null)
  const regra = validacoes[validar ?? mascara ?? (resto.type === 'email' ? 'email' : '')]
  const msg = erroExterno || erro

  return (
    <div className={'inp' + (Icone ? ' inp-icone' : '') + (msg ? ' inp-erro' : '') + ' ' + className} style={style?.width ? { width: style.width, flexShrink: 0 } : undefined}>
      {Icone && <Icone size={16} className="inp-ic" />}
      <input
        ref={ref}
        style={style}
        value={value ?? ''}
        maxLength={mascara ? limites[mascara] : resto.maxLength ?? 200}
        inputMode={mascara ? teclados[mascara] : resto.inputMode}
        placeholder={resto.placeholder ?? placeholders[mascara]}
        autoComplete={resto.autoComplete ?? 'off'}
        spellCheck={false}
        {...resto}
        aria-invalid={!!msg}
        onChange={(e) => {
          const v = mascara ? mascaras[mascara](e.target.value) : e.target.value
          if (erro) setErro(null)
          onChange?.({ ...e, target: { ...e.target, value: v } }, v)
        }}
        onBlur={(e) => {
          if (regra) { const r = regra(e.target.value); setErro(r === true ? null : r) }
          onBlur?.(e)
        }}
      />
      {msg && <span className="inp-msg">{msg}</span>}
    </div>
  )
})

export const InputSenha = forwardRef(function InputSenha({ value, onChange, icone: Icone, ...resto }, ref) {
  const [ver, setVer] = useState(false)
  return (
    <div className={'inp inp-senha' + (Icone ? ' inp-icone' : '')}>
      {Icone && <Icone size={16} className="inp-ic" />}
      <input ref={ref} type={ver ? 'text' : 'password'} value={value} onChange={onChange} maxLength={72} {...resto} />
      <button type="button" className="inp-olho" onClick={() => setVer(!ver)} aria-label={ver ? 'Esconder senha' : 'Mostrar senha'} title={ver ? 'Esconder senha' : 'Mostrar senha'}>
        <span className={'olho' + (ver ? ' ver' : '')}>{ver ? <EyeOff size={17} /> : <Eye size={17} />}</span>
      </button>
    </div>
  )
})
