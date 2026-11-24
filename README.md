# estoque-pdv

Sistema modelo de **controle de estoque + caixa (PDV)** para varejo, pronto para ser personalizado com a identidade visual de cada empresa.

**Demo:** https://madalkmin.github.io/estoque-pdv/

## Funcionalidades
- **Caixa (PDV)**: busca por nome ou leitor de código de barras, `3*código` para quantidade, atalhos `F2` (finalizar) e `F4` (cliente)
- **Pagamentos**: dinheiro com troco, Pix com QR Code gerado pela chave da loja, crédito, débito, fiado e pagamento dividido
- **Cupom não fiscal** para impressora térmica 58/80 mm, com reimpressão
- **Estoque**: categorias, variações (tamanho/cor), estoque mínimo, ajustes e histórico completo de movimentações
- **Compras** de fornecedores com entrada automática no estoque e atualização de custo
- **Clientes e fiado**: limite de crédito, saldo devedor, recebimentos e histórico
- **Relatórios**: faturamento, lucro bruto, ticket médio, mais vendidos, formas de pagamento, valor em estoque, exportação CSV
- **Usuários**: administrador (acesso total) e operador (caixa e consulta). O primeiro cadastro vira admin, e os seguintes aguardam aprovação dele
- Modo claro/escuro e layout responsivo

## Personalizar para um cliente
1. Edite [`src/tema.js`](src/tema.js): nome, slogan, logo (coloque a imagem em `public/`), cores e fonte
2. Crie um projeto Supabase para o cliente, rode [`supabase/migrations/001_schema_inicial.sql`](supabase/migrations/001_schema_inicial.sql) e troque `supabaseConfig` em `src/tema.js`
3. Em Supabase → Authentication → URL Configuration, coloque a URL do site em *Site URL*
4. Faça push na `main`. O GitHub Actions publica no Pages automaticamente

## Desenvolvimento
```bash
npm install
npm run dev
```

Stack: React 18 + Vite, Supabase (Postgres, Auth, RLS), React Router (HashRouter), Recharts, lucide-react.
