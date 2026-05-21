insert into public.modalities (name, sort_order)
select seed.name, seed.sort_order
from (
  values
    ('Danças Urbanas', 10),
    ('Jazz', 20),
    ('K-Pop', 30)
) as seed(name, sort_order)
where not exists (
  select 1
  from public.modalities existing
  where lower(existing.name) = lower(seed.name)
);

insert into public.levels (name, sort_order)
select seed.name, seed.sort_order
from (
  values
    ('Kids 1', 10),
    ('Kids 2', 20),
    ('Jr 1', 30),
    ('Jr 2', 40),
    ('Juvenil', 50),
    ('Iniciante', 60),
    ('Intermediário', 70),
    ('Avançado', 80),
    ('Adulto', 90)
) as seed(name, sort_order)
where not exists (
  select 1
  from public.levels existing
  where lower(existing.name) = lower(seed.name)
);
