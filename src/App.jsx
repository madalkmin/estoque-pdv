import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, ArrowLeftRight, Receipt, Users, Truck, ShoppingBag,
  BarChart3, UserCog, Settings, LogOut, Menu, Moon, Sun, Wallet,
} from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import { AvisoProvider, Marca, TelaCarregando, useOndaBotoes } from './componentes/ui'
import { aplicarTema, modoAtual } from './aplicarTema'
import Login from './paginas/Login'
import Dashboard from './paginas/Dashboard'
import PDV from './paginas/PDV'
import Caixa from './paginas/Caixa'
import Produtos from './paginas/Produtos'
import Movimentacoes from './paginas/Movimentacoes'
import Vendas from './paginas/Vendas'
import Clientes from './paginas/Clientes'
import Fornecedores from './paginas/Fornecedores'
import Compras from './paginas/Compras'
import Relatorios from './paginas/Relatorios'
import Usuarios from './paginas/Usuarios'
import Configuracoes from './paginas/Configuracoes'

const menu = [
  { secao: 'Operação' },
  { to: '/', icone: LayoutDashboard, texto: 'Início', fim: true },
  { to: '/caixa', icone: ShoppingCart, texto: 'Caixa (PDV)' },
  { to: '/controle-caixa', icone: Wallet, texto: 'Abrir/fechar caixa' },
  { to: '/vendas', icone: Receipt, texto: 'Vendas' },
  { to: '/clientes', icone: Users, texto: 'Clientes e fiado' },
  { secao: 'Estoque' },
  { to: '/produtos', icone: Package, texto: 'Produtos' },
  { to: '/movimentacoes', icone: ArrowLeftRight, texto: 'Movimentações' },
  { to: '/compras', icone: ShoppingBag, texto: 'Compras', admin: true },
  { to: '/fornecedores', icone: Truck, texto: 'Fornecedores', admin: true },
  { secao: 'Gestão', admin: true },
  { to: '/relatorios', icone: BarChart3, texto: 'Relatórios', admin: true },
  { to: '/usuarios', icone: UserCog, texto: 'Usuários', admin: true },
  { to: '/configuracoes', icone: Settings, texto: 'Configurações', admin: true },
]

function SoAdmin({ children }) {
  const { admin } = useAuth()
  return admin ? children : <Navigate to="/" replace />
}

function Casca() {
  const { sessao, perfil, admin, carregando, sair, recuperando } = useAuth()
  useOndaBotoes()
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState(modoAtual())
  const local = useLocation()

  if (carregando) return <TelaCarregando />
  if (!sessao || recuperando) return <Login />
  if (!perfil?.ativo) return (
    <div className="login"><div className="card">
      <Marca />
      <h2>Aguardando aprovação</h2>
      <p className="suave">Sua conta ({perfil?.email}) foi criada. Peça a um administrador para liberar seu acesso em <b>Usuários</b>.</p>
      <button className="btn" onClick={sair}><LogOut size={16} /> Sair</button>
    </div></div>
  )

  const itens = menu.filter((m) => !m.admin || admin)

  return (
    <div className="app">
      <div className="topo-mobile">
        <button className="btn btn-icone" onClick={() => setAberto(true)} aria-label="Menu"><Menu size={18} /></button>
        <b>{itens.find((m) => m.to === local.pathname)?.texto || ''}</b>
      </div>
      {aberto && <div className="veu" onClick={() => setAberto(false)} />}
      <aside className={'lateral' + (aberto ? ' aberta' : '')} onClick={() => setAberto(false)}>
        <Marca />
        <nav className="menu">
          {itens.map((m, i) => m.secao
            ? <div key={i} className="secao">{m.secao}</div>
            : <NavLink key={m.to} to={m.to} end={m.fim}><m.icone size={18} />{m.texto}</NavLink>)}
        </nav>
        <div className="usuario">
          <div><b>{perfil.nome}</b><small>{admin ? 'Administrador' : 'Operador'}</small></div>
          <button className="btn btn-icone btn-fantasma" title="Alternar tema" onClick={(e) => { e.stopPropagation(); setModo(aplicarTema(modo === 'escuro' ? 'claro' : 'escuro')) }}>
            {modo === 'escuro' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="btn btn-icone btn-fantasma" title="Sair" onClick={sair}><LogOut size={17} /></button>
        </div>
      </aside>
      <main className="conteudo">
        <div className="pagina" key={local.pathname}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/caixa" element={<PDV />} />
          <Route path="/controle-caixa" element={<Caixa />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/produtos" element={<Produtos />} />
          <Route path="/movimentacoes" element={<Movimentacoes />} />
          <Route path="/compras" element={<SoAdmin><Compras /></SoAdmin>} />
          <Route path="/fornecedores" element={<SoAdmin><Fornecedores /></SoAdmin>} />
          <Route path="/relatorios" element={<SoAdmin><Relatorios /></SoAdmin>} />
          <Route path="/usuarios" element={<SoAdmin><Usuarios /></SoAdmin>} />
          <Route path="/configuracoes" element={<SoAdmin><Configuracoes /></SoAdmin>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return <AvisoProvider><AuthProvider><Casca /></AuthProvider></AvisoProvider>
}
