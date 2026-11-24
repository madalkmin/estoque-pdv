# estoque-pdv — Especificação (entrevista de 2026-11-24)

Sistema modelo (white-label) de **controle de estoque + caixa (PDV)** para empresas, usado como demonstração e base para versões personalizadas com a identidade visual de cada cliente.

## Decisões
| Tema | Decisão |
|---|---|
| Stack | React + Vite, deploy no GitHub Pages |
| Dados | Supabase (banco, autenticação, sincronização entre caixas) |
| Público | Varejo geral (lojas, mercadinhos, cosméticos, roupas) |
| Usuários | Admin (vê tudo) + Operador (vende e consulta estoque) |
| Personalização | Arquivo de tema: logo, cores, fontes, nome da empresa |
| Visual padrão | Moderno limpo: fundo claro, cards, menu lateral, modo escuro opcional |

## Módulos da v1
- **Estoque completo**: categorias, variações (tamanho/cor), estoque mínimo, histórico de movimentações, ajustes
- **Caixa (PDV)**: busca por nome/código + leitor de código de barras USB
- **Pagamentos**: dinheiro (com troco), Pix (QR estático pela chave), cartões, fiado, pagamento dividido
- **Comprovante**: cupom não fiscal para impressora térmica 58/80mm (sem NF-e)
- **Relatórios/dashboard**: vendas por período, mais vendidos, lucro, estoque baixo
- **Clientes e fiado**: cadastro, histórico, vendas a prazo
- **Fornecedores e compras**: entradas de mercadoria com fornecedor e custo

## Fora da v1
- Abertura/fechamento de caixa (sangria/suprimento)
- Emissão fiscal (NF-e/NFC-e)
