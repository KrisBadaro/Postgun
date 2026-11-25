-- =========================================================
-- POSTGUN: tabela de perfis
-- Cole no Supabase: SQL Editor > New query > Run
-- =========================================================

-- 1. Tabela de perfis (uma linha por usuário)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  niche text,
  created_at timestamptz not null default now()
);

-- 2. Segurança (RLS): cada pessoa só enxerga e edita o PRÓPRIO perfil
alter table public.profiles enable row level security;

create policy "Ver o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Editar o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- 3. Cria o perfil automaticamente quando alguém se cadastra,
--    usando o nome e o nicho enviados pelo formulário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, niche)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'niche'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();