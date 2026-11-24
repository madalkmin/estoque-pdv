import { useEffect, useState } from 'react'
import { Plus, Pencil, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Cabecalho } from '../componentes/ui'
import { FormCadastro } from '../componentes/Cadastro'
import { SkeletonLinhas } from '../componentes/Skeleton'

const campos = [
  { chave: 'nome', rotulo: 'Nome / Razão social' },
  { chave: 'documento', rotulo: 'CNPJ/CPF', mascara: 'cpfCnpj' },
  { chave: 'telefone', rotulo: 'Telefone', mascara: 'telefone' },
  { chave: 'email', rotulo: 'E-mail', tipo: 'email' },
  { chave: 'observacoes', rotulo: 'Observações', texto: true, inteiro: true },
]

export default function Fornecedores() {
  const [lista, setLista] = useState(null)
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState(null)
  const carregar = () => supabase.from('fornecedores').select('*').eq('ativo', true).order('nome').then(({ data }) => setLista(data || []))
  useEffect(() => { carregar() }, [])
  const filtrada = (lista || []).filter((f) => f.nome.toLowerCase().includes(busca.toLowerCase()) || f.documento?.includes(busca))

  return (
    <>
      <Cabecalho titulo="Fornecedores" descricao={lista ? `${lista.length} cadastrados` : ' '}>
        <button className="btn btn-primario" onClick={() => setEditando({})}><Plus size={16} /> Novo fornecedor</button>
      </Cabecalho>
      <div className="card">
        <div className="busca" style={{ marginBottom: 14 }}><Search size={16} /><input placeholder="Buscar fornecedor" value={busca} onChange={(e) => setBusca(e.target.value)} /></div>
        <div className="tabela-wrap"><table>
          <thead><tr><th>Nome</th><th>Documento</th><th>Telefone</th><th>E-mail</th><th /></tr></thead>
          <tbody>
            {lista === null && <SkeletonLinhas colunas={5} />}
            {filtrada.map((f) => (
              <tr key={f.id}><td><b>{f.nome}</b></td><td className="suave">{f.documento || '—'}</td><td className="suave">{f.telefone || '—'}</td><td className="suave">{f.email || '—'}</td>
                <td className="direita"><button className="btn btn-icone btn-fantasma" onClick={() => setEditando(f)} aria-label="Editar"><Pencil size={16} /></button></td></tr>
            ))}
            {lista && !filtrada.length && <tr><td colSpan={5} className="vazio">Nenhum fornecedor</td></tr>}
          </tbody>
        </table></div>
      </div>
      {editando && <FormCadastro tabela="fornecedores" titulo={editando.id ? 'Editar fornecedor' : 'Novo fornecedor'} registro={editando} campos={campos} podeExcluir
        onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); carregar() }} />}
    </>
  )
}
