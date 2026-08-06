-- Rewards need a photo gallery, not a single shot: a hoodie has a front,
-- a back, sleeve/print detail, and a sizing shot, and a player spending
-- hard-won coins on a physical item should see all of them before
-- committing. Replaces the single image_url with an ordered array whose
-- FIRST element is the cover (what the catalog grid and admin list show).
--
-- image_url is dropped rather than kept alongside: two sources of truth
-- for "the reward's picture" is exactly the kind of thing that drifts.
-- Nothing else references it -- redeem_reward selects only
-- (id, name, coin_cost, stock_quantity, is_active), and coin_redemptions
-- snapshots reward_name/coin_cost, never the image.

alter table public.reward_catalog
  add column image_urls text[] not null default '{}';

-- Preserve anything already uploaded through the single-image field.
update public.reward_catalog
  set image_urls = array[image_url]
  where image_url is not null and image_url <> '';

alter table public.reward_catalog
  drop column image_url;

-- Cap the gallery server-side too, not just in the admin UI: these are
-- public bucket objects and the array is admin-writable directly via the
-- "Admins manage reward catalog" policy, not only through a function.
alter table public.reward_catalog
  add constraint reward_catalog_image_urls_max
  check (coalesce(array_length(image_urls, 1), 0) <= 6);

comment on column public.reward_catalog.image_urls is
  'Ordered gallery of public reward-images URLs. The first element is the cover shown in the catalog grid; the rest are additional angles/details. Max 6.';
