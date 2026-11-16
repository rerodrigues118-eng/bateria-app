-- ============================================================================
-- ESQUEMA DE BANCO DE DADOS SUPABASE / POSTGRESQL PARA O APP DE BATERISTA
-- ============================================================================

-- Extensão para geração de UUID
create extension if not exists "uuid-ossp";

-- 1. Tabela de Músicas (songs)
create table if not exists public.songs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  bpm integer not null check (bpm between 30 and 320),
  time_signature_beats integer not null default 4 check (time_signature_beats in (2, 3, 4, 5, 6, 7, 12)),
  time_signature_value integer not null default 4 check (time_signature_value in (4, 8)),
  subdivision integer not null default 1 check (subdivision in (1, 2, 3, 4)),
  count_in_beats integer not null default 4 check (count_in_beats >= 0),
  notes text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Índices para buscas rápidas
create index if not exists idx_songs_user_id on public.songs(user_id);
create index if not exists idx_songs_updated_at on public.songs(updated_at desc);

-- 2. Tabela de Comandos de Voz da Timeline (voice_cues)
create table if not exists public.voice_cues (
  id uuid primary key default uuid_generate_v4(),
  song_id uuid not null references public.songs(id) on delete cascade,
  measure_number integer not null check (measure_number >= 1),
  cue_type text not null check (cue_type in ('count', 'fill_1234', 'cymbals', 'snare_kick', 'intro', 'solo', 'custom')),
  custom_text text,
  lead_time_bars integer not null default 1 check (lead_time_bars between 0 and 4),
  audio_key text
);

create index if not exists idx_voice_cues_song_id on public.voice_cues(song_id);
create index if not exists idx_voice_cues_measure on public.voice_cues(song_id, measure_number);

-- 3. Tabela de Setlists / Repertórios (setlists)
create table if not exists public.setlists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  song_ids jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_setlists_user_id on public.setlists(user_id);

-- ============================================================================
-- POLÍTICAS DE SEGURANÇA POR LINHA (ROW LEVEL SECURITY - RLS)
-- ============================================================================
alter table public.songs enable row level security;
alter table public.voice_cues enable row level security;
alter table public.setlists enable row level security;

-- Músicas: Usuário autenticado acessa somente suas próprias músicas
create policy "Users can manage their own songs"
  on public.songs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Voice Cues: Usuário autenticado acessa comandos de suas próprias músicas
create policy "Users can manage voice cues of their songs"
  on public.voice_cues
  for all
  using (
    exists (
      select 1 from public.songs s
      where s.id = voice_cues.song_id and s.user_id = auth.uid()
    )
  );

-- Setlists: Usuário autenticado acessa seus próprios setlists
create policy "Users can manage their own setlists"
  on public.setlists
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
