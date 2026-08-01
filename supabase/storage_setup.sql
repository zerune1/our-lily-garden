insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('memories', 'memories', true)
on conflict (id) do nothing;

create policy "authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

create policy "avatars are publicly viewable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "authenticated users can upload memories"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'memories');

create policy "memories are publicly viewable"
  on storage.objects for select
  to public
  using (bucket_id = 'memories');
