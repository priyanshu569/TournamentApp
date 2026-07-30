-- Replaces "blank = hidden" for city with an explicit visibility toggle
-- (existing users keep their city public by default, so nothing
-- changes for them), and adds the same toggle for age. Age itself was
-- never exposed publicly before (only date_of_birth existed, privately,
-- for computing "Age: X" in Edit Profile) -- the view now exposes a
-- computed age, never the raw birthdate, so opting in never leaks the
-- exact birthday.

alter table public."Profiles"
  add column city_public boolean not null default true,
  add column age_public boolean not null default true;

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
    end as age
   from public."Profiles";
