-- estoque-pdv: schema inicial
-- Perfis, catálogo com variações, estoque, compras, vendas, clientes/fiado.

-- ============ PERFIS ============
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text,
  papel text not null default 'operador' check (papel in ('admin','operador')),
  ativo boolean not null default false,
  criado_em timestamptz not null default now()
);

create or replace function public.eh_ativo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from perfis where id = auth.uid() and ativo);
$$;

create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from perfis where id = auth.uid() and ativo and papel = 'admin');
$$;

-- Primeiro usuário cadastrado vira admin ativo; os demais aguardam aprovação.
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare primeiro boolean;
begin
  perform pg_advisory_xact_lock(4242);
  select not exists(select 1 from perfis) into primeiro;
  insert into perfis (id, nome, email, papel, ativo)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email,
          case when primeiro then 'admin' else 'operador' end, primeiro);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.criar_perfil();

-- ============ CADASTROS ============
create table public.categorias (
  id bigint generated always as identity primary key,
  nome text not null unique,
  criado_em timestamptz not null default now()
);

create table public.fornecedores (
  id bigint generated always as identity primary key,
  nome text not null,
  documento text, telefone text, email text, observacoes text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.clientes (
  id bigint generated always as identity primary key,
  nome text not null,
  documento text, telefone text, email text, observacoes text,
  limite_fiado numeric(12,2) not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.produtos (
  id bigint generated always as identity primary key,
  nome text not null,
  descricao text,
  categoria_id bigint references public.categorias(id) on delete set null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Todo produto tem ao menos uma variação (a "Padrão" quando não há tamanho/cor).
create table public.variacoes (
  id bigint generated always as identity primary key,
  produto_id bigint not null references public.produtos(id) on delete cascade,
  nome text not null default 'Padrão',
  sku text,
  codigo_barras text unique,
  preco_custo numeric(12,2) not null default 0 check (preco_custo >= 0),
  preco_venda numeric(12,2) not null default 0 check (preco_venda >= 0),
  estoque numeric(12,3) not null default 0,
  estoque_minimo numeric(12,3) not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on public.variacoes(produto_id);

create table public.movimentacoes (
  id bigint generated always as identity primary key,
  variacao_id bigint not null references public.variacoes(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida','ajuste','venda','compra','cancelamento')),
  quantidade numeric(12,3) not null,          -- positivo entra, negativo sai
  estoque_resultante numeric(12,3) not null,
  motivo text,
  referencia_id bigint,
  usuario_id uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on public.movimentacoes(variacao_id, criado_em desc);

-- ============ COMPRAS ============
create table public.compras (
  id bigint generated always as identity primary key,
  fornecedor_id bigint references public.fornecedores(id) on delete set null,
  total numeric(12,2) not null default 0,
  observacoes text,
  usuario_id uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

create table public.compra_itens (
  id bigint generated always as identity primary key,
  compra_id bigint not null references public.compras(id) on delete cascade,
  variacao_id bigint not null references public.variacoes(id),
  quantidade numeric(12,3) not null check (quantidade > 0),
  custo_unitario numeric(12,2) not null check (custo_unitario >= 0)
);
create index on public.compra_itens(compra_id);

-- ============ VENDAS ============
create table public.vendas (
  id bigint generated always as identity primary key,
  cliente_id bigint references public.clientes(id) on delete set null,
  subtotal numeric(12,2) not null,
  desconto numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  troco numeric(12,2) not null default 0,
  status text not null default 'concluida' check (status in ('concluida','cancelada')),
  usuario_id uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on public.vendas(criado_em desc);

create table public.venda_itens (
  id bigint generated always as identity primary key,
  venda_id bigint not null references public.vendas(id) on delete cascade,
  variacao_id bigint not null references public.variacoes(id),
  descricao text not null,
  quantidade numeric(12,3) not null check (quantidade > 0),
  preco_unitario numeric(12,2) not null,
  custo_unitario numeric(12,2) not null default 0
);
create index on public.venda_itens(venda_id);

create table public.venda_pagamentos (
  id bigint generated always as identity primary key,
  venda_id bigint not null references public.vendas(id) on delete cascade,
  forma text not null check (forma in ('dinheiro','pix','credito','debito','fiado')),
  valor numeric(12,2) not null check (valor > 0)
);
create index on public.venda_pagamentos(venda_id);

-- Recebimentos de fiado (abatem o saldo devedor do cliente)
create table public.recebimentos_fiado (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes(id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  forma text not null check (forma in ('dinheiro','pix','credito','debito')),
  observacoes text,
  usuario_id uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);

-- Configurações da loja (chave Pix, dados do cupom)
create table public.configuracoes (
  id int primary key default 1 check (id = 1),
  nome_loja text not null default 'Minha Loja',
  documento text, endereco text, telefone text,
  chave_pix text, nome_pix text, cidade_pix text,
  mensagem_cupom text default 'Obrigado pela preferência!',
  largura_cupom text not null default '80mm' check (largura_cupom in ('58mm','80mm'))
);
insert into public.configuracoes (id) values (1);

-- ============ VIEWS ============
create view public.saldo_clientes with (security_invoker = true) as
select c.id as cliente_id,
  coalesce((select sum(p.valor) from venda_pagamentos p join vendas v on v.id = p.venda_id
            where v.cliente_id = c.id and p.forma = 'fiado' and v.status = 'concluida'),0)
  - coalesce((select sum(r.valor) from recebimentos_fiado r where r.cliente_id = c.id),0) as saldo
from clientes c;

-- ============ RLS ============
alter table public.perfis enable row level security;
alter table public.categorias enable row level security;
alter table public.fornecedores enable row level security;
alter table public.clientes enable row level security;
alter table public.produtos enable row level security;
alter table public.variacoes enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.compras enable row level security;
alter table public.compra_itens enable row level security;
alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.venda_pagamentos enable row level security;
alter table public.recebimentos_fiado enable row level security;
alter table public.configuracoes enable row level security;

create policy perfis_ler on public.perfis for select to authenticated
  using (id = (select auth.uid()) or (select eh_admin()));
create policy perfis_admin on public.perfis for update to authenticated
  using ((select eh_admin())) with check ((select eh_admin()));

-- Leitura para qualquer usuário ativo
do $$ declare t text; begin
  foreach t in array array['categorias','fornecedores','clientes','produtos','variacoes','movimentacoes',
    'compras','compra_itens','vendas','venda_itens','venda_pagamentos','recebimentos_fiado','configuracoes'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select eh_ativo()))', t||'_ler', t);
  end loop;
end $$;

-- Escrita direta só para admin nos cadastros
do $$ declare t text; begin
  foreach t in array array['categorias','fornecedores','produtos','variacoes','configuracoes'] loop
    execute format('create policy %I on public.%I for insert to authenticated with check ((select eh_admin()))', t||'_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select eh_admin())) with check ((select eh_admin()))', t||'_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select eh_admin()))', t||'_del', t);
  end loop;
end $$;

-- Operador pode cadastrar/editar clientes (ex.: na hora da venda)
create policy clientes_ins on public.clientes for insert to authenticated with check ((select eh_ativo()));
create policy clientes_upd on public.clientes for update to authenticated using ((select eh_ativo())) with check ((select eh_ativo()));
create policy clientes_del on public.clientes for delete to authenticated using ((select eh_admin()));

-- Vendas, compras, movimentações e recebimentos só via funções abaixo.

-- ============ FUNÇÕES ============
create or replace function public.mover_estoque(p_variacao bigint, p_qtd numeric, p_tipo text, p_motivo text, p_ref bigint)
returns numeric language plpgsql security definer set search_path = public as $$
declare novo numeric;
begin
  update variacoes set estoque = estoque + p_qtd where id = p_variacao returning estoque into novo;
  if novo is null then raise exception 'Variação % não encontrada', p_variacao; end if;
  insert into movimentacoes (variacao_id, tipo, quantidade, estoque_resultante, motivo, referencia_id, usuario_id)
  values (p_variacao, p_tipo, p_qtd, novo, p_motivo, p_ref, auth.uid());
  return novo;
end $$;
revoke all on function public.mover_estoque(bigint,numeric,text,text,bigint) from public, anon, authenticated;

-- Ajuste manual (admin). p_modo: 'entrada' | 'saida' | 'ajuste' (define o valor absoluto)
create or replace function public.ajustar_estoque(p_variacao bigint, p_modo text, p_quantidade numeric, p_motivo text)
returns numeric language plpgsql security definer set search_path = public as $$
declare atual numeric; delta numeric;
begin
  if not eh_admin() then raise exception 'Apenas administradores podem ajustar estoque'; end if;
  select estoque into atual from variacoes where id = p_variacao for update;
  if atual is null then raise exception 'Variação não encontrada'; end if;
  delta := case p_modo when 'entrada' then abs(p_quantidade)
                       when 'saida' then -abs(p_quantidade)
                       when 'ajuste' then p_quantidade - atual
                       else null end;
  if delta is null then raise exception 'Modo inválido'; end if;
  return mover_estoque(p_variacao, delta, p_modo, p_motivo, null);
end $$;

-- Venda atômica.
-- p jsonb: { cliente_id, desconto, itens:[{variacao_id, quantidade, preco_unitario}], pagamentos:[{forma, valor}] }
create or replace function public.registrar_venda(p jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; it jsonb; pg jsonb; var record;
  v_subtotal numeric := 0; v_desconto numeric := coalesce((p->>'desconto')::numeric,0);
  v_total numeric; v_pago numeric := 0; v_dinheiro numeric := 0; v_fiado numeric := 0;
  v_cliente bigint := nullif(p->>'cliente_id','')::bigint; v_troco numeric;
  v_limite numeric; v_saldo numeric;
begin
  if not eh_ativo() then raise exception 'Usuário sem permissão'; end if;
  if jsonb_array_length(coalesce(p->'itens','[]')) = 0 then raise exception 'Venda sem itens'; end if;

  for it in select * from jsonb_array_elements(p->'itens') loop
    if (it->>'quantidade')::numeric <= 0 then raise exception 'Quantidade inválida'; end if;
    -- operador não pode alterar preço: usa o preço cadastrado
    v_subtotal := v_subtotal + (it->>'quantidade')::numeric *
      case when eh_admin() and it ? 'preco_unitario' then (it->>'preco_unitario')::numeric
           else (select preco_venda from variacoes where id = (it->>'variacao_id')::bigint) end;
  end loop;

  if v_desconto < 0 or v_desconto > v_subtotal then raise exception 'Desconto inválido'; end if;
  v_total := round(v_subtotal - v_desconto, 2);

  for pg in select * from jsonb_array_elements(coalesce(p->'pagamentos','[]')) loop
    v_pago := v_pago + (pg->>'valor')::numeric;
    if pg->>'forma' = 'dinheiro' then v_dinheiro := v_dinheiro + (pg->>'valor')::numeric; end if;
    if pg->>'forma' = 'fiado' then v_fiado := v_fiado + (pg->>'valor')::numeric; end if;
  end loop;
  if v_pago < v_total then raise exception 'Pagamento insuficiente'; end if;
  v_troco := round(v_pago - v_total, 2);
  if v_troco > v_dinheiro then raise exception 'Troco só pode sair de pagamento em dinheiro'; end if;

  if v_fiado > 0 then
    if v_cliente is null then raise exception 'Fiado exige cliente'; end if;
    select c.limite_fiado, s.saldo into v_limite, v_saldo
      from clientes c join saldo_clientes s on s.cliente_id = c.id where c.id = v_cliente;
    if v_limite > 0 and v_saldo + v_fiado > v_limite then
      raise exception 'Limite de fiado excedido (saldo %, limite %)', v_saldo, v_limite;
    end if;
  end if;

  insert into vendas (cliente_id, subtotal, desconto, total, troco, usuario_id)
  values (v_cliente, round(v_subtotal,2), v_desconto, v_total, v_troco, auth.uid()) returning id into v_id;

  for it in select * from jsonb_array_elements(p->'itens') loop
    select v.*, pr.nome as produto_nome into var
      from variacoes v join produtos pr on pr.id = v.produto_id where v.id = (it->>'variacao_id')::bigint for update of v;
    if var.id is null then raise exception 'Produto não encontrado'; end if;
    insert into venda_itens (venda_id, variacao_id, descricao, quantidade, preco_unitario, custo_unitario)
    values (v_id, var.id,
      var.produto_nome || case when var.nome <> 'Padrão' then ' - ' || var.nome else '' end,
      (it->>'quantidade')::numeric,
      case when eh_admin() and it ? 'preco_unitario' then (it->>'preco_unitario')::numeric else var.preco_venda end,
      var.preco_custo);
    perform mover_estoque(var.id, -(it->>'quantidade')::numeric, 'venda', 'Venda #' || v_id, v_id);
  end loop;

  for pg in select * from jsonb_array_elements(p->'pagamentos') loop
    insert into venda_pagamentos (venda_id, forma, valor)
    select v_id, pg->>'forma', x.val from (select
      case when pg->>'forma' = 'dinheiro' then (pg->>'valor')::numeric - least(v_troco, (pg->>'valor')::numeric)
           else (pg->>'valor')::numeric end as val) x where x.val > 0;
    if pg->>'forma' = 'dinheiro' then v_troco := v_troco - least(v_troco, (pg->>'valor')::numeric); end if;
  end loop;

  return v_id;
end $$;

create or replace function public.cancelar_venda(p_venda bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare it record;
begin
  if not eh_admin() then raise exception 'Apenas administradores podem cancelar vendas'; end if;
  update vendas set status = 'cancelada' where id = p_venda and status = 'concluida';
  if not found then raise exception 'Venda não encontrada ou já cancelada'; end if;
  for it in select * from venda_itens where venda_id = p_venda loop
    perform mover_estoque(it.variacao_id, it.quantidade, 'cancelamento',
      'Cancelamento venda #' || p_venda || coalesce(': ' || p_motivo, ''), p_venda);
  end loop;
end $$;

-- p jsonb: { fornecedor_id, observacoes, atualizar_custo, itens:[{variacao_id, quantidade, custo_unitario}] }
create or replace function public.registrar_compra(p jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare c_id bigint; it jsonb; tot numeric := 0;
begin
  if not eh_admin() then raise exception 'Apenas administradores podem registrar compras'; end if;
  if jsonb_array_length(coalesce(p->'itens','[]')) = 0 then raise exception 'Compra sem itens'; end if;
  insert into compras (fornecedor_id, observacoes, usuario_id)
  values (nullif(p->>'fornecedor_id','')::bigint, p->>'observacoes', auth.uid()) returning id into c_id;
  for it in select * from jsonb_array_elements(p->'itens') loop
    insert into compra_itens (compra_id, variacao_id, quantidade, custo_unitario)
    values (c_id, (it->>'variacao_id')::bigint, (it->>'quantidade')::numeric, (it->>'custo_unitario')::numeric);
    tot := tot + (it->>'quantidade')::numeric * (it->>'custo_unitario')::numeric;
    if coalesce((p->>'atualizar_custo')::boolean, true) then
      update variacoes set preco_custo = (it->>'custo_unitario')::numeric where id = (it->>'variacao_id')::bigint;
    end if;
    perform mover_estoque((it->>'variacao_id')::bigint, (it->>'quantidade')::numeric, 'compra', 'Compra #' || c_id, c_id);
  end loop;
  update compras set total = round(tot,2) where id = c_id;
  return c_id;
end $$;

create or replace function public.receber_fiado(p_cliente bigint, p_valor numeric, p_forma text, p_obs text)
returns bigint language plpgsql security definer set search_path = public as $$
declare r_id bigint;
begin
  if not eh_ativo() then raise exception 'Usuário sem permissão'; end if;
  insert into recebimentos_fiado (cliente_id, valor, forma, observacoes, usuario_id)
  values (p_cliente, p_valor, p_forma, p_obs, auth.uid()) returning id into r_id;
  return r_id;
end $$;

revoke execute on function public.ajustar_estoque(bigint,text,numeric,text) from public, anon;
revoke execute on function public.registrar_venda(jsonb) from public, anon;
revoke execute on function public.cancelar_venda(bigint,text) from public, anon;
revoke execute on function public.registrar_compra(jsonb) from public, anon;
revoke execute on function public.receber_fiado(bigint,numeric,text,text) from public, anon;
revoke execute on function public.criar_perfil() from public, anon, authenticated;
revoke execute on function public.eh_admin() from public, anon;
revoke execute on function public.eh_ativo() from public, anon;
grant execute on function public.eh_admin() to authenticated;
grant execute on function public.eh_ativo() to authenticated;
grant execute on function public.ajustar_estoque(bigint,text,numeric,text) to authenticated;
grant execute on function public.registrar_venda(jsonb) to authenticated;
grant execute on function public.cancelar_venda(bigint,text) to authenticated;
grant execute on function public.registrar_compra(jsonb) to authenticated;
grant execute on function public.receber_fiado(bigint,numeric,text,text) to authenticated;
