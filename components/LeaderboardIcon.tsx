import GradientIconBadge from './GradientIconBadge';

type Props = { size?: number };

export default function LeaderboardIcon({ size = 36 }: Props) {
  return (
    <GradientIconBadge
      icon="trophy"
      size={size}
      colors={['#FFE484', '#FFB800', '#B8860B']}
      iconColor="#4a2e00"
      glowColor="#FFB800"
    />
  );
}
