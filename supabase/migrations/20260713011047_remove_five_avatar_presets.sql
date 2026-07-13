-- Removes flame, lightning, trophy, shield, and snake from the avatar preset
-- set (15 -> 10). Verified no existing Profiles row uses any of these five
-- before tightening the constraint.

alter table public."Profiles"
  drop constraint profiles_avatar_id_check;

alter table public."Profiles"
  add constraint profiles_avatar_id_check
    check (avatar_id is null or avatar_id in (
      'skull', 'controller', 'headset', 'crosshair', 'ghost',
      'heart', 'flower', 'unicorn',
      'swordcross',
      'meditation'
    ));
