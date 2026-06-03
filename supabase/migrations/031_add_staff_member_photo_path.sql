alter table public.staff_members
add column if not exists photo_path text null;

insert into storage.buckets (id, name, public)
values ('teacher-photos', 'teacher-photos', true)
on conflict (id) do update
set public = true;

drop policy if exists "teacher_photos_public_read"
on storage.objects;
create policy "teacher_photos_public_read"
on storage.objects
for select
to public
using (bucket_id = 'teacher-photos');

drop policy if exists "teacher_photos_authenticated_insert"
on storage.objects;
create policy "teacher_photos_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'teacher-photos');

drop policy if exists "teacher_photos_authenticated_update"
on storage.objects;
create policy "teacher_photos_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'teacher-photos')
with check (bucket_id = 'teacher-photos');

notify pgrst, 'reload schema';
