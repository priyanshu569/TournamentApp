import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSharedValue, cancelAnimation, useReducedMotion, SharedValue } from 'react-native-reanimated';

// Single source of truth for "should the banner be animating right now".
// Animations are stopped (not just hidden) when the screen loses focus or the
// app backgrounds, so an expensive multi-layer banner never burns battery
// while the user is somewhere else in the app.
export function useAnimationGate(reduceMotion?: boolean) {
  const focused = useIsFocused();
  const systemReduceMotion = useReducedMotion();
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  // An explicit prop wins; otherwise honour the OS accessibility setting.
  const motionOff = reduceMotion ?? systemReduceMotion;

  return { active: focused && foreground && !motionOff, motionOff };
}

// A repeating driver value that starts/stops with the gate. `makeAnimation`
// returns a Reanimated animation (withRepeat(...)) -- it is only invoked while
// active, and cancelled outright otherwise.
export function useLoopValue(active: boolean, from: number, makeAnimation: () => number): SharedValue<number> {
  const sv = useSharedValue(from);

  useEffect(() => {
    if (!active) {
      cancelAnimation(sv);
      return;
    }
    sv.value = from;
    sv.value = makeAnimation();
    return () => cancelAnimation(sv);
  }, [active]);

  return sv;
}
