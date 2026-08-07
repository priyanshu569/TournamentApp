import { memo } from 'react';
import { Image, ImageStyle } from 'expo-image';
import { StyleProp } from 'react-native';

// Officially sourced brand marks -- Riot's public VALORANT asset kit,
// Garena's and Krafton's own CDNs, Activision's site -- never redrawn.
// Bundled as local assets rather than fetched at runtime.
const GAME_LOGOS = {
  freefire: require('../assets/images/games/freefire.png'),
  bgmi: require('../assets/images/games/bgmi.png'),
  codm: require('../assets/images/games/codm.png'),
  valorant: require('../assets/images/games/valorant.png'),
};

// Matches Fragify's own game name strings (e.g. "Free Fire", "COD Mobile",
// exactly as typed across create-tournament.tsx/game-details.tsx/etc) to
// the right bundled mark. Was previously duplicated as five near-identical
// lookup functions/maps across events.tsx, index.tsx, game-details.tsx,
// leaderboard.tsx, and user-profile.tsx -- consolidated here.
export function getGameLogo(game: string) {
  const g = game.toLowerCase();
  if (g.includes('free fire') || g.includes('freefire')) return GAME_LOGOS.freefire;
  if (g.includes('bgmi') || g.includes('battlegrounds')) return GAME_LOGOS.bgmi;
  if (g.includes('cod')) return GAME_LOGOS.codm;
  if (g.includes('valorant')) return GAME_LOGOS.valorant;
  return null;
}

type Props = {
  game: string;
  size?: number;
  style?: StyleProp<ImageStyle>;
};

// Renders nothing for an unrecognized game name -- callers that need a
// guaranteed visual (e.g. a circle background) should check
// getGameLogo(...) directly and fall back to their own generic icon.
function GameLogoBase({ game, size = 24, style }: Props) {
  const source = getGameLogo(game);
  if (!source) return null;
  return <Image source={source} style={[{ width: size, height: size }, style]} contentFit="contain" />;
}

export default memo(GameLogoBase);
