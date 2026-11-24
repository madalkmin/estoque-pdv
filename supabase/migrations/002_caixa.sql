-- estoque-pdv: abertura/fechamento de caixa, sangria e suprimento
-- Um caixa aberto por operador. Vendas exigem caixa aberto e ficam ligadas a ele.

create table public.caixas (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.perfis(id) on delete restrict default auth.uid(),
  aberto_em timestamptz not null default now(),
  valor_abertura numeric(12,2) not null default 0 check (valor_abertura >= 0),
  status text not null default 'aberto' check (status in ('aberto','fechado')),
  fechado_em timestamptz,
  fechado_por uuid references public.perfis(id) on delete set null,
  valor_esperado numeric(12,2),
  valor_contado numeric(12,2),
  diferenca numeric(12,2),
  observacoes text
);
create unique index caixas_um_aberto_por_usuario on public.caixas(usuario_id) where status = 'aberto';
create index on public.caixas(aberto_em desc);
create index on public.caixas(fechado_por);

create table public.caixa_movimentos (
  id bigint generated always as identity primary key,
  caixa_id bigint not null references public.caixas(id) on delete cascade,
  tipo text not null check (tipo in ('sangria','suprimento')),
  valor numeric(12,2) not null check (valor > 0),
  motivo text,
  usuario_id uuid references public.perfis(id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now()
);
create index on public.caixa_movimentos(caixa_id);
create index on public.caixa_movimentos(usuario_id);

alter table public.vendas add column caixa_id bigint references public.caixas(id) on delete set null;
alter table public.recebimentos_fiado add column caixa_id bigint references public.caixas(id) on delete set null;
create index on public.vendas(caixa_id);
create index on public.recebimentos_fiado(caixa_id);

alter table public.caixas enable row level security;
alter table public.caixa_movimentos enable row level security;
-- admin vê todos; operador vê só os próprios. Escrita apenas pelas funções.
create policy caixas_ler on public.caixas for select to authenticated
  using ((select eh_admin()) or (usuario_id = (select auth.uid()) and (select eh_ativo())));
create policy caixa_movimentos_ler on public.caixa_movimentos for select to authenticated
  using ((select eh_admin()) or exists (select 1 from public.caixas c where c.id = caixa_id and c.usuario_id = (select auth.uid())));

-- ============ FUNÇÕES ============
create or replace function public.caixa_aberto_id() returns bigint
language sql stable security definer set search_path = public as $$
  select id from caixas where usuario_id = auth.uid() and status = 'aberto';
$$;

-- Resumo financeiro de um caixa (admin: qualquer; operador: o próprio)
create or replace function public.resumo_caixa(p_caixa bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record; r jsonb; v_formas jsonb; v_fiado jsonb;
  v_din numeric; v_fiado_din numeric; v_sup numeric; v_san numeric;
begin
  select * into c from caixas where id = p_caixa;
  if c.id is null then raise exception 'Caixa não encontrado'; end if;
  if not (eh_admin() or (eh_ativo() and c.usuario_id = auth.uid())) then raise exception 'Sem permissão'; end if;

  select coalesce(jsonb_object_agg(forma, total), '{}') into v_formas from (
    select p.forma, sum(p.valor) total from venda_pagamentos p join vendas v on v.id = p.venda_id
    where v.caixa_id = p_caixa and v.status = 'concluida' group by p.forma) x;
  select coalesce(jsonb_object_agg(forma, total), '{}') into v_fiado from (
    select forma, sum(valor) total from recebimentos_fiado where caixa_id = p_caixa group by forma) x;
  v_din := coalesce((v_formas->>'dinheiro')::numeric, 0);
  v_fiado_din := coalesce((v_fiado->>'dinheiro')::numeric, 0);
  select coalesce(sum(valor) filter (where tipo = 'suprimento'), 0), coalesce(sum(valor) filter (where tipo = 'sangria'), 0)
    into v_sup, v_san from caixa_movimentos where caixa_id = p_caixa;

  select jsonb_build_object(
    'caixa', to_jsonb(c) || jsonb_build_object('operador', (select nome from perfis where id = c.usuario_id),
                                               'fechado_por_nome', (select nome from perfis where id = c.fechado_por)),
    'vendas_qtd', (select count(*) from vendas where caixa_id = p_caixa and status = 'concluida'),
    'vendas_total', (select coalesce(sum(total), 0) from vendas where caixa_id = p_caixa and status = 'concluida'),
    'canceladas_qtd', (select count(*) from vendas where caixa_id = p_caixa and status = 'cancelada'),
    'canceladas_total', (select coalesce(sum(total), 0) from vendas where caixa_id = p_caixa and status = 'cancelada'),
    'por_forma', v_formas,
    'fiado_recebido', v_fiado,
    'suprimentos', v_sup,
    'sangrias', v_san,
    'dinheiro_esperado', round(c.valor_abertura + v_din + v_fiado_din + v_sup - v_san, 2)
  ) into r;
  return r;
end $$;

create or replace function public.abrir_caixa(p_valor numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not eh_ativo() then raise exception 'Usuário sem permissão'; end if;
  if coalesce(p_valor, 0) < 0 then raise exception 'Valor de abertura inválido'; end if;
  if caixa_aberto_id() is not null then raise exception 'Você já tem um caixa aberto'; end if;
  insert into caixas (usuario_id, valor_abertura) values (auth.uid(), round(coalesce(p_valor, 0), 2)) returning id into v_id;
  return v_id;
end $$;

-- p_tipo: 'sangria' (retirada) | 'suprimento' (reforço)
create or replace function public.movimentar_caixa(p_tipo text, p_valor numeric, p_motivo text) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_caixa bigint := caixa_aberto_id(); v_id bigint; v_disp numeric;
begin
  if not eh_ativo() then raise exception 'Usuário sem permissão'; end if;
  if v_caixa is null then raise exception 'Abra o caixa primeiro'; end if;
  if p_tipo not in ('sangria','suprimento') then raise exception 'Tipo inválido'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Informe um valor maior que zero'; end if;
  perform 1 from caixas where id = v_caixa for update;
  if p_tipo = 'sangria' then
    v_disp := (resumo_caixa(v_caixa)->>'dinheiro_esperado')::numeric;
    if p_valor > v_disp then raise exception 'Sangria maior que o dinheiro em caixa (%)', to_char(v_disp, 'FM999G999G990D00'); end if;
  end if;
  insert into caixa_movimentos (caixa_id, tipo, valor, motivo, usuario_id)
  values (v_caixa, p_tipo, round(p_valor, 2), nullif(trim(p_motivo), ''), auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- Fecha o próprio caixa (ou, se admin, o caixa informado em p_caixa)
create or replace function public.fechar_caixa(p_valor_contado numeric, p_obs text, p_caixa bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_caixa bigint; v_esp numeric; c record;
begin
  if not eh_ativo() then raise exception 'Usuário sem permissão'; end if;
  v_caixa := coalesce(p_caixa, caixa_aberto_id());
  if v_caixa is null then raise exception 'Nenhum caixa aberto'; end if;
  select * into c from caixas where id = v_caixa for update;
  if c.id is null or c.status <> 'aberto' then raise exception 'Caixa não está aberto'; end if;
  if c.usuario_id <> auth.uid() and not eh_admin() then raise exception 'Apenas administradores podem fechar o caixa de outro operador'; end if;
  if coalesce(p_valor_contado, -1) < 0 then raise exception 'Informe o valor contado'; end if;
  v_esp := (resumo_caixa(v_caixa)->>'dinheiro_esperado')::numeric;
  update caixas set status = 'fechado', fechado_em = now(), fechado_por = auth.uid(),
    valor_esperado = v_esp, valor_contado = round(p_valor_contado, 2), diferenca = round(p_valor_contado - v_esp, 2),
    observacoes = nullif(trim(p_obs), '')
  where id = v_caixa;
  return resumo_caixa(v_caixa);
end $$;

-- Venda: agora exige caixa aberto e grava caixa_id
create or replace function public.registrar_venda(p jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint; it jsonb; pg jsonb; var record;
  v_subtotal numeric := 0; v_desconto numeric := coalesce((p->>'desconto')::numeric,0);
  v_total numeric; v_pago numeric := 0; v_dinheiro numeric := 0; v_fiado numeric := 0;
  v_cliente bigint := nullif(p->>'cliente_id','')::bigint; v_troco numeric;
  v_limite numeric; v_saldo numeric; v_caixa bigint;
begin
  if not eh_ativo() then raise exception 'Usuário sem permissão'; end if;
  v_caixa := caixa_aberto_id();
  if v_caixa is null then raise exception 'Abra o caixa antes de vender'; end if;
  if jsonb_array_length(coalesce(p->'itens','[]')) = 0 then raise exception 'Venda sem itens'; end if;

  for it in select * from jsonb_array_elements(p->'itens') loop
    if (it->>'quantidade')::numeric <= 0 then raise exception 'Quantidade inválida'; end if;
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

  insert into vendas (cliente_id, subtotal, desconto, total, troco, usuario_id, caixa_id)
  values (v_cliente, round(v_subtotal,2), v_desconto, v_total, v_troco, auth.uid(), v_caixa) returning id into v_id;

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

-- Recebimento de fiado: em dinheiro exige caixa aberto; liga ao caixa quando houver
create or replace function public.receber_fiado(p_cliente bigint, p_valor numeric, p_forma text, p_obs text)
returns bigint language plpgsql security definer set search_path = public as $$
declare r_id bigint; v_caixa bigint := caixa_aberto_id();
begin
  if not eh_ativo() then raise exception 'Usuário sem permissão'; end if;
  if p_forma = 'dinheiro' and v_caixa is null then raise exception 'Abra o caixa para receber em dinheiro'; end if;
  insert into recebimentos_fiado (cliente_id, valor, forma, observacoes, usuario_id, caixa_id)
  values (p_cliente, p_valor, p_forma, p_obs, auth.uid(), v_caixa) returning id into r_id;
  return r_id;
end $$;

revoke execute on function public.caixa_aberto_id() from public, anon;
revoke execute on function public.resumo_caixa(bigint) from public, anon;
revoke execute on function public.abrir_caixa(numeric) from public, anon;
revoke execute on function public.movimentar_caixa(text,numeric,text) from public, anon;
revoke execute on function public.fechar_caixa(numeric,text,bigint) from public, anon;
grant execute on function public.caixa_aberto_id() to authenticated;
grant execute on function public.resumo_caixa(bigint) to authenticated;
grant execute on function public.abrir_caixa(numeric) to authenticated;
grant execute on function public.movimentar_caixa(text,numeric,text) to authenticated;
grant execute on function public.fechar_caixa(numeric,text,bigint) to authenticated;
