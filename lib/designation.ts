import { ThemeColors } from '@/constants/theme';

export function getDesignation(
  author: { is_admin?: boolean | null; role?: string | null } | null | undefined,
  colors: ThemeColors
): { label: string; color: string } {
  if (author?.is_admin) return { label: 'Admin', color: '#F5B93D' };
  if (author?.role === 'host') return { label: 'Host', color: '#A78BFA' };
  return { label: 'Player', color: colors.textFaint };
}
