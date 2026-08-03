-- Animated profile banner/avatar-ring cosmetics (aurora/holographic/ember).
-- Purely cosmetic and free to set for now -- premium-gating this is a
-- future step once real billing exists, not part of this migration.

alter table public."Profiles"
  add column banner_theme text check (banner_theme in ('aurora', 'holographic', 'ember'));

comment on column public."Profiles".banner_theme is
  'Selected animated profile banner/avatar-ring cosmetic. Null = classic static look.';

create or replace view public.public_profiles with (security_invoker=off) as
 select id,
    username,
    is_verified,
    avatar_id,
    follow_list_private,
    role,
    display_name,
    is_admin,
    avatar_url,
    gender,
    state,
    case when city_public then city else null end as city,
    case when age_public and date_of_birth is not null
      then extract(year from age(current_date, date_of_birth))::int
      else null
    end as age,
    banner_theme
   from public."Profiles";
