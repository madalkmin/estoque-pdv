// ============================================================
//  TEMA DA EMPRESA — edite só este arquivo para personalizar
//  o sistema para cada cliente (nome, logo, cores e fonte).
// ============================================================
export const tema = {
  nomeEmpresa: 'Minha Loja',
  slogan: 'Estoque & Caixa',

  // Caminho de uma imagem em /public (ex.: './logo.png') ou null para usar o ícone padrão
  logo: null,

  // Fonte do Google Fonts (lembre de ajustar o <link> no index.html se trocar)
  fonte: "'Inter', system-ui, sans-serif",

  // Cores do modo claro
  cores: {
    primaria: '#2563eb',
    primariaTexto: '#ffffff',
    fundo: '#f5f7fb',
    superficie: '#ffffff',
    texto: '#0f172a',
    textoSuave: '#64748b',
    borda: '#e2e8f0',
    sucesso: '#16a34a',
    alerta: '#d97706',
    perigo: '#dc2626',
  },

  // Cores do modo escuro
  coresEscuro: {
    primaria: '#3b82f6',
    primariaTexto: '#ffffff',
    fundo: '#0b1120',
    superficie: '#111827',
    texto: '#e5e7eb',
    textoSuave: '#94a3b8',
    borda: '#1f2937',
    sucesso: '#22c55e',
    alerta: '#f59e0b',
    perigo: '#ef4444',
  },

  arredondamento: '12px',
}

// Conexão com o Supabase do cliente (chave publicável — pode ficar no front-end)
export const supabaseConfig = {
  url: 'https://quxagoipwhbxtdmsbdtg.supabase.co',
  chave: 'sb_publishable__1HASlBYyb-cVziY9QfiwQ_SNkyTfN0',
}
