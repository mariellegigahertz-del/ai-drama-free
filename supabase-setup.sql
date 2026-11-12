create table if not exists public.drama_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 500),
  genre text not null check (genre in ('Romance', 'Mystery', 'Sci-Fi', 'Fantasy', 'Drama', 'Thriller', 'Comedy')),
  creator_name text not null check (char_length(creator_name) between 1 and 60),
  license_type text not null check (license_type in (
    'All rights reserved — view only',
    'CC BY (attribution required)',
    'CC BY-SA (attribution and share alike)',
    'CC0 / Public Domain'
  )),
  license_url text,
  storage_path text not null unique,
  views bigint not null default 0 check (views >= 0),
  created_at timestamptz not null default now(),
  constraint drama_video_license_url_required check (
    license_type = 'All rights reserved — view only'
    or license_url like 'https://%'
  )
);

alter table public.drama_videos enable row level security;

create policy "Anyone can browse published dramas"
  on public.drama_videos for select
  using (true);

create policy "Creators can publish their own dramas"
  on public.drama_videos for insert to authenticated
  with check (
    auth.uid() = user_id
    and storage_path like auth.uid()::text || '/%'
  );

create policy "Creators can delete their own dramas"
  on public.drama_videos for delete to authenticated
  using (auth.uid() = user_id);

create or replace function public.increment_drama_view(p_video_id uuid)
returns bigint
language sql
security definer
set search_path = ''
as $$
  update public.drama_videos
  set views = views + 1
  where id = p_video_id
  returning views;
$$;

revoke all on function public.increment_drama_view(uuid) from public;
grant execute on function public.increment_drama_view(uuid) to anon, authenticated;

create table if not exists public.video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.drama_videos(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in (
    'Copyright or permission concern',
    'Harmful or illegal content',
    'Misleading or not an AI drama',
    'Spam or other issue'
  )),
  created_at timestamptz not null default now()
);

alter table public.video_reports enable row level security;

create policy "Signed-in users can report videos"
  on public.video_reports for insert to authenticated
  with check (auth.uid() = reporter_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'drama-videos',
  'drama-videos',
  true,
  52428800,
  array['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can watch published drama files"
  on storage.objects for select
  using (bucket_id = 'drama-videos');

create policy "Creators can upload to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'drama-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Creators can remove files in their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'drama-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
