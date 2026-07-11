-- Expands the avatar preset set from 8 to 20, adding cute/soft, warrior,
-- dangerous, and calm options alongside the original general esports set.

alter table public."Profiles"
  drop constraint profiles_avatar_id_check;

alter table public."Profiles"
  add constraint profiles_avatar_id_check
    check (avatar_id is null or avatar_id in (
      'flame', 'lightning', 'skull', 'controller',
      'headset', 'crosshair', 'trophy', 'ghost',
      'heart', 'star', 'flower', 'unicorn', 'butterfly', 'paw',
      'swordcross', 'shield', 'biohazard', 'snake',
      'leaf', 'meditation'
    ));
