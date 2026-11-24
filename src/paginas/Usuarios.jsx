import { useEffect, useState } from 'react'
import { supabase, checar } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { data } from '../lib/formato'
import { Cabecalho, useAcao } from '../componentes/ui'
import { SkeletonLinhas } from '../componentes/Skeleton'
import Select from '../componentes/Select'
import Tabela from '../componentes/Tabela'
import { confirmar } from '../lib/notificar'

export default function Usuarios() {
  const { perfil } = useAuth()
  const [lista, setLista] = useState(null)
  const [executar] = useAcao()
  const carregar = () => supabase.from('perfis').select('*').order('criado_em').then(({ data }) => setLista(data || []))
  useEffect(() => { carregar() }, [])

  const alterar = (u, dados, msg) => executar(async () => checar(await supabase.from('perfis').update(dados).eq('id', u.id)), msg).then(carregar, () => {})

  return (
    <>
      <Cabecalho titulo="Usuários" descricao="Novos funcionários se cadastram na tela de login e aparecem aqui para aprovação" />
      <div className="card">
        <Tabela
          dados={lista}
          ordemInicial={{ chave: 'criado_em', dir: 1 }}
          colunas={[
            { chave: 'nome', titulo: 'Nome', render: (u) => <><b>{u.nome}</b>{u.id === perfil.id && <span className="suave"> (você)</span>}</> },
            { chave: 'email', titulo: 'E-mail', classe: 'suave' },
            { chave: 'criado_em', titulo: 'Desde', tipo: 'data', classe: 'suave', render: (u) => data(u.criado_em) },
            { chave: 'papel', titulo: 'Papel', tipo: 'opcoes', rotulo: (p) => (p === 'admin' ? 'Administrador' : 'Operador'),
              render: (u) => <Select tamanho="p" value={u.papel} disabled={u.id === perfil.id} style={{ width: 170 }} onChange={(v) => v !== u.papel && alterar(u, { papel: v }, 'Papel atualizado')}
                options={[{ value: 'operador', label: 'Operador', descricao: 'Caixa e consultas' }, { value: 'admin', label: 'Administrador', descricao: 'Acesso total' }]} /> },
            { chave: 'ativo', titulo: 'Situação', tipo: 'opcoes', rotulo: (a) => (a === 'true' ? 'Ativo' : 'Aguardando'),
              render: (u) => (u.ativo ? <span className="selo ok">Ativo</span> : <span className="selo alerta">Aguardando</span>) },
          ]}
          acoes={(u) => u.id !== perfil.id && (u.ativo
            ? <button className="btn btn-perigo" onClick={async () => (await confirmar({ titulo: 'Bloquear acesso?', mensagem: `${u.nome} não conseguirá mais entrar no sistema até ser liberado de novo.`, tipo: 'perigo', confirmar: 'Bloquear' })) && alterar(u, { ativo: false }, 'Acesso bloqueado')}>Bloquear</button>
            : <button className="btn btn-primario" onClick={() => alterar(u, { ativo: true }, 'Acesso liberado')}>Liberar acesso</button>)}
        />
      </div>
    </>
  )
}
