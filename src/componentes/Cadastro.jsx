import { useState } from 'react'
import { Campo, Modal, useAcao, Botao } from './ui'
import { Input } from './Input'
import { supabase, checar } from '../lib/supabase'
import { validacoes, sanitizar, mascaras } from '../lib/mascaras'
import { parseNum } from '../lib/formato'

// Formulário genérico de cadastro (clientes, fornecedores)
// campo: { chave, rotulo, mascara?, tipo?, numero?, texto?, inteiro?, max? }
export function FormCadastro({ tabela, titulo, registro, campos, onFechar, onSalvo, podeExcluir }) {
  const [f, setF] = useState(() => Object.fromEntries(campos.map((c) => {
    const v = registro?.[c.chave]
    if (v == null) return [c.chave, '']
    if (c.numero) return [c.chave, Number(v) ? mascaras.decimal(String(Number(v).toFixed(2)).replace('.', ',')) : '']
    return [c.chave, c.mascara ? mascaras[c.mascara](v) : v]
  })))
  const [erros, setErros] = useState({})
  const [executar, ocupado] = useAcao()

  const salvar = () => executar(async () => {
    const novosErros = {}
    if (!sanitizar(f.nome).length) novosErros.nome = 'Informe o nome'
    for (const c of campos) {
      const regra = validacoes[c.mascara || (c.tipo === 'email' ? 'email' : '')]
      if (regra) { const r = regra(f[c.chave]); if (r !== true) novosErros[c.chave] = r }
    }
    setErros(novosErros)
    if (Object.keys(novosErros).length) throw new Error('Corrija os campos destacados')
    const dados = Object.fromEntries(campos.map((c) => [
      c.chave,
      c.numero ? parseNum(f[c.chave]) : (sanitizar(f[c.chave], c.texto ? 1000 : 200) || null),
    ]))
    if (dados.email) dados.email = dados.email.toLowerCase()
    if (registro?.id) checar(await supabase.from(tabela).update(dados).eq('id', registro.id))
    else checar(await supabase.from(tabela).insert(dados))
  }, 'Salvo com sucesso').then(onSalvo, () => {})

  const excluir = () => confirm('Desativar este cadastro?') &&
    executar(async () => checar(await supabase.from(tabela).update({ ativo: false }).eq('id', registro.id)), 'Cadastro desativado').then(onSalvo, () => {})

  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); if (erros[k]) setErros({ ...erros, [k]: null }) }

  return (
    <Modal titulo={titulo} onFechar={onFechar} rodape={<>
      {registro?.id && podeExcluir && <button className="btn btn-perigo" style={{ marginRight: 'auto' }} onClick={excluir}>Desativar</button>}
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <Botao className="btn-primario" carregando={ocupado} onClick={salvar}>Salvar</Botao>
    </>}>
      <div className="form">
        {campos.map((c, i) => (
          <Campo key={c.chave} label={c.rotulo} inteiro={c.inteiro}>
            {c.texto
              ? <textarea maxLength={1000} value={f[c.chave]} onChange={set(c.chave)} />
              : <Input autoFocus={i === 0} type={c.tipo} mascara={c.numero ? 'decimal' : c.mascara} maxLength={c.max} value={f[c.chave]} onChange={set(c.chave)} erro={erros[c.chave]} />}
          </Campo>
        ))}
      </div>
    </Modal>
  )
}
