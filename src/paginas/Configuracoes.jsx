import { useEffect, useState } from 'react'
import { supabase, checar } from '../lib/supabase'
import { Cabecalho, Campo, useAcao } from '../componentes/ui'

const campos = ['nome_loja', 'documento', 'endereco', 'telefone', 'chave_pix', 'nome_pix', 'cidade_pix', 'mensagem_cupom', 'largura_cupom']

export default function Configuracoes() {
  const [f, setF] = useState(null)
  const [executar, ocupado] = useAcao()
  useEffect(() => { supabase.from('configuracoes').select('*').single().then(({ data }) => setF(data)) }, [])
  if (!f) return <p className="suave">Carregando…</p>
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const salvar = (e) => {
    e.preventDefault()
    executar(async () => checar(await supabase.from('configuracoes').update(
      Object.fromEntries(campos.map((k) => [k, typeof f[k] === 'string' ? f[k].trim() || null : f[k]]))
    ).eq('id', 1)), 'Configurações salvas').catch(() => {})
  }

  return (
    <form onSubmit={salvar}>
      <Cabecalho titulo="Configurações" descricao="Dados impressos no cupom e recebimento por Pix">
        <button className="btn btn-primario" disabled={ocupado}>Salvar</button>
      </Cabecalho>
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Dados da loja</h2>
        <div className="form">
          <Campo label="Nome da loja"><input required value={f.nome_loja || ''} onChange={set('nome_loja')} /></Campo>
          <Campo label="CNPJ/CPF"><input value={f.documento || ''} onChange={set('documento')} /></Campo>
          <Campo label="Telefone"><input value={f.telefone || ''} onChange={set('telefone')} /></Campo>
          <Campo label="Endereço" inteiro><input value={f.endereco || ''} onChange={set('endereco')} /></Campo>
        </div>
      </div>
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Pix</h2>
        <div className="form">
          <Campo label="Chave Pix"><input value={f.chave_pix || ''} onChange={set('chave_pix')} placeholder="CPF, CNPJ, e-mail, telefone ou aleatória" /></Campo>
          <Campo label="Nome do recebedor"><input value={f.nome_pix || ''} onChange={set('nome_pix')} maxLength={25} /></Campo>
          <Campo label="Cidade"><input value={f.cidade_pix || ''} onChange={set('cidade_pix')} maxLength={15} /></Campo>
        </div>
        <p className="suave" style={{ marginBottom: 0 }}>Telefone deve estar no formato +5511999999999. O QR Code é gerado no caixa com o valor da venda.</p>
      </div>
      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Cupom</h2>
        <div className="form">
          <Campo label="Largura da impressora">
            <select value={f.largura_cupom} onChange={set('largura_cupom')}><option value="80mm">80 mm</option><option value="58mm">58 mm</option></select>
          </Campo>
          <Campo label="Mensagem no rodapé"><input value={f.mensagem_cupom || ''} onChange={set('mensagem_cupom')} /></Campo>
        </div>
      </div>
    </form>
  )
}
