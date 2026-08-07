-- A freeform bio players write about themselves. No privacy toggle like
-- city/age get -- a bio is self-authored and meant to be seen, same as
-- display_name/username, so it's just always public via public_profiles.
-- Capped short (160 chars, tweet-length) on purpose: long enough to say
-- something real, short enough that people actually read it instead of
-- skimming past a wall of text on a profile header.

alter table public."Profiles"
  add column bio text;

alter table public."Profiles"
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 160);

comment on column public."Profiles".bio is
  'Freeform, self-authored bio shown on the public profile header. Capped at 160 characters.';

-- public_profiles: append at the end so this stays a plain
-- CREATE OR REPLACE (Postgres forbids reordering/dropping existing view
-- columns, only appending is allowed without a DROP).
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
        case
            when city_public then city
            else null::text
        end as city,
        case
            when age_public and date_of_birth is not null then extract(year from age(current_date::timestamp with time zone, date_of_birth::timestamp with time zone))::integer
            else null::integer
        end as age,
    banner_theme,
    bio
   from public."Profiles";
