-- MetaSystem v2 — Шаблоны тренировочных программ
-- Позволяет админу сохранять часто используемые недели как шаблоны
-- и быстро применять их к разным клиентам.

create table if not exists public.program_templates (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    description text,
    training_days_count integer not null default 3 check (training_days_count between 1 and 7),
    program_md text not null,
    program_data jsonb,
    -- кэш для быстрого превью; обновляется при insert/update
    tags text[] default '{}',
    -- свободные теги (например: 'masa', 'sila', 'nachalo', 'reabilitatsiya')
    created_by uuid references auth.users(id) on delete set null,
    is_global boolean default false,
    -- если true — шаблон виден всем админам/тренерам
    usage_count integer default 0,
    -- увеличивается при каждом применении, для сортировки «по популярности»
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists program_templates_created_by_idx
    on public.program_templates(created_by);

create index if not exists program_templates_updated_at_idx
    on public.program_templates(updated_at desc);

create index if not exists program_templates_usage_count_idx
    on public.program_templates(usage_count desc);

-- Авто-обновление updated_at
create or replace function public.tg_program_templates_set_updated_at()
returns trigger as $$
begin
    new.updated_at := now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists program_templates_set_updated_at on public.program_templates;
create trigger program_templates_set_updated_at
    before update on public.program_templates
    for each row execute function public.tg_program_templates_set_updated_at();

-- RLS
alter table public.program_templates enable row level security;

-- Админы/тренеры/кураторы видят всё (свои + глобальные)
drop policy if exists "Admins can view templates" on public.program_templates;
create policy "Admins can view templates" on public.program_templates
    for select
    using (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'trainer', 'curator')
        )
    );

-- Админы/тренеры/кураторы могут создавать шаблоны
drop policy if exists "Admins can insert templates" on public.program_templates;
create policy "Admins can insert templates" on public.program_templates
    for insert
    with check (
        exists (
            select 1 from public.profiles
            where profiles.id = auth.uid()
            and profiles.role in ('admin', 'trainer', 'curator')
        )
    );

-- Можно править свои; глобальные может править любой админ с ролью admin
drop policy if exists "Admins can update own templates" on public.program_templates;
create policy "Admins can update own templates" on public.program_templates
    for update
    using (
        created_by = auth.uid()
        or exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

-- Удалять можно свои; глобальные — только role='admin'
drop policy if exists "Admins can delete own templates" on public.program_templates;
create policy "Admins can delete own templates" on public.program_templates
    for delete
    using (
        created_by = auth.uid()
        or exists (
            select 1 from public.profiles
            where profiles.id = auth.uid() and profiles.role = 'admin'
        )
    );

comment on table public.program_templates is
    'Библиотека шаблонов тренировочных программ для быстрой загрузки клиентам';
