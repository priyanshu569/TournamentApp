import { memo } from 'react';
import { Image, ImageStyle } from 'expo-image';
import { StyleProp } from 'react-native';

// User-supplied official app-icon renders (Play Store icons / key art),
// not transparent marks -- opaque squares, so every call site renders
// these as rounded-square "app icon" tiles (cover + matching border
// radius) rather than insetting them inside a colored circle backdrop,
// which only worked visually for the old transparent-mark version.
const GAME_LOGOS = {
  freefire: require('../assets/images/games/freefire.jpg'),
  bgmi: require('../assets/images/games/bgmi.jpg'),
  codm: require('../assets/images/games/codm.jpg'),
  valorant: require('../assets/images/games/valorant.jpg'),
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
// guaranteed visual should check getGameLogo(...) directly and fall
// back to their own generic icon.
//
// cover + a proportional radius, not contain inside a colored circle:
// these are opaque square app-icon renders, not transparent marks, so
// they need to fill their box edge-to-edge like a real app icon rather
// than float small inside a tinted backdrop.
function GameLogoBase({ game, size = 24, style }: Props) {
  const source = getGameLogo(game);
  if (!source) return null;
  return (
    <Image
      source={source}
      style={[{ width: size, height: size, borderRadius: size * 0.28 }, style]}
      contentFit="cover"
    />
  );
}

export default memo(GameLogoBase);
