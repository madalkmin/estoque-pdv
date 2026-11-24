import { useState } from 'react'
import { Campo, Modal, useAcao } from './ui'
import { supabase, checar } from '../lib/supabase'

// Formulário genérico de cadastro (clientes, fornecedores)
export function FormCadastro({ tabela, titulo, registro, campos, onFechar, onSalvo, podeExcluir }) {
  const [f, setF] = useState(() => Object.fromEntries(campos.map((c) => [c.chave, registro?.[c.chave] ?? ''])))
  const [executar, ocupado] = useAcao()

  const salvar = () => executar(async () => {
    if (!String(f.nome || '').trim()) throw new Error('Informe o nome')
    const dados = Object.fromEntries(campos.map((c) => [c.chave, c.numero ? Number(String(f[c.chave]).replace(',', '.')) || 0 : (String(f[c.chave]).trim() || null)]))
    if (registro?.id) checar(await supabase.from(tabela).update(dados).eq('id', registro.id))
    else checar(await supabase.from(tabela).insert(dados))
  }, 'Salvo com sucesso').then(onSalvo, () => {})

  const excluir = () => confirm('Desativar este cadastro?') &&
    executar(async () => checar(await supabase.from(tabela).update({ ativo: false }).eq('id', registro.id)), 'Cadastro desativado').then(onSalvo, () => {})

  return (
    <Modal titulo={titulo} onFechar={onFechar} rodape={<>
      {registro?.id && podeExcluir && <button className="btn btn-perigo" style={{ marginRight: 'auto' }} onClick={excluir}>Desativar</button>}
      <button className="btn" onClick={onFechar}>Cancelar</button>
      <button className="btn btn-primario" disabled={ocupado} onClick={salvar}>Salvar</button>
    </>}>
      <div className="form">
        {campos.map((c, i) => (
          <Campo key={c.chave} label={c.rotulo} inteiro={c.inteiro}>
            {c.texto
              ? <textarea value={f[c.chave]} onChange={(e) => setF({ ...f, [c.chave]: e.target.value })} />
              : <input autoFocus={i === 0} inputMode={c.numero ? 'decimal' : undefined} value={f[c.chave]} onChange={(e) => setF({ ...f, [c.chave]: e.target.value })} />}
          </Campo>
        ))}
      </div>
    </Modal>
  )
}
