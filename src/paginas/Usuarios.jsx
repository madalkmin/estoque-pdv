import { useEffect, useState } from 'react'
import { supabase, checar } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { data } from '../lib/formato'
import { Cabecalho, useAcao } from '../componentes/ui'

export default function Usuarios() {
  const { perfil } = useAuth()
  const [lista, setLista] = useState([])
  const [executar] = useAcao()
  const carregar = () => supabase.from('perfis').select('*').order('criado_em').then(({ data }) => setLista(data || []))
  useEffect(() => { carregar() }, [])

  const alterar = (u, dados, msg) => executar(async () => checar(await supabase.from('perfis').update(dados).eq('id', u.id)), msg).then(carregar, () => {})

  return (
    <>
      <Cabecalho titulo="Usuários" descricao="Novos funcionários se cadastram na tela de login e aparecem aqui para aprovação" />
      <div className="card">
        <div className="tabela-wrap"><table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Desde</th><th>Papel</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {lista.map((u) => {
              const eu = u.id === perfil.id
              return (
                <tr key={u.id}>
                  <td><b>{u.nome}</b>{eu && <span className="suave"> (você)</span>}</td>
                  <td className="suave">{u.email}</td>
                  <td className="suave">{data(u.criado_em)}</td>
                  <td>
                    <select value={u.papel} disabled={eu} style={{ width: 150, height: 32 }} onChange={(e) => alterar(u, { papel: e.target.value }, 'Papel atualizado')}>
                      <option value="operador">Operador</option><option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>{u.ativo ? <span className="selo ok">Ativo</span> : <span className="selo alerta">Aguardando</span>}</td>
                  <td className="direita">
                    {!eu && (u.ativo
                      ? <button className="btn btn-perigo" onClick={() => confirm(`Bloquear o acesso de ${u.nome}?`) && alterar(u, { ativo: false }, 'Acesso bloqueado')}>Bloquear</button>
                      : <button className="btn btn-primario" onClick={() => alterar(u, { ativo: true }, 'Acesso liberado')}>Liberar acesso</button>)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </div>
    </>
  )
}
