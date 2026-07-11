-- Removes star, butterfly, paw, biohazard, and leaf from the avatar preset
-- set (20 -> 15). Verified no existing Profiles row uses any of these five
-- before tightening the constraint.

alter table public."Profiles"
  drop constraint profiles_avatar_id_check;

alter table public."Profiles"
  add constraint profiles_avatar_id_check
    check (avatar_id is null or avatar_id in (
      'flame', 'lightning', 'skull', 'controller',
      'headset', 'crosshair', 'trophy', 'ghost',
      'heart', 'flower', 'unicorn',
      'swordcross', 'shield', 'snake',
      'meditation'
    ));
