// The role a viewer should be treated as *for their own app functionality*
// (which dashboard/tab content they see) -- never for how other users see
// them. A host can browse as a player (role stays 'host'); an admin can
// preview as a host without actually being one. Both are stored in the
// personal, never-publicly-exposed browsing_mode column.
export function isEffectivelyHost(
  profile: { role?: string | null; browsing_mode?: string | null; is_admin?: boolean | null } | null | undefined
): boolean {
  if (!profile) return false;
  if (profile.role === 'host') return profile.browsing_mode !== 'player';
  return !!profile.is_admin && profile.browsing_mode === 'host';
}
