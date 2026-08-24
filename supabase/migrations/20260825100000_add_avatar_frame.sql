-- Avatar frames: the decorated backdrop an avatar icon sits on.
--
-- Deliberately a separate column from avatar_id rather than a replacement.
-- avatar_id keeps meaning "which icon", this keeps meaning "which backdrop",
-- and the two combine -- so 10 frames x 10 icons covers 100 looks, and every
-- profile saved before frames existed keeps rendering exactly as it did
-- (null frame = the original flat gradient).
--
-- Entitlement is NOT enforced here, matching how banner_theme was handled in
-- 20260803120000. When subscriptions land, premium frames need gating in an
-- RPC or RLS policy -- a CHECK constraint can't express "this user paid".

alter table public."Profiles"
  add column avatar_frame text check (avatar_frame in (
    'hexforge', 'neoncircuit', 'sunburst', 'voidorbit', 'runesigil',
    'glitch', 'lockon', 'hyperdrive', 'toxic', 'pixel'
  ));

comment on column public."Profiles".avatar_frame is
  'Selected avatar frame backdrop. Null = classic flat gradient behind the icon.';

-- public_profiles is what every list screen reads from, so the frame has to be
-- exposed here or avatars would only render framed on your own profile.
--
-- Copied forward verbatim from 20260807150000 with avatar_frame appended:
-- CREATE OR REPLACE can only add columns at the end, never reorder or drop
-- them, so re-listing the existing set in its exact current order is required
-- (and dropping bio by omission here would quietly blank it everywhere).
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
    bio,
    avatar_frame
   from public."Profiles";
