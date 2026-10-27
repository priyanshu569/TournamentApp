import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  useSharedValue,
  cancelAnimation,
  useReducedMotion,
  SharedValue,
} from 'react-native-reanimated';

/**
 * Controls whether premium animations should run.
 *
 * This hook intentionally does NOT depend on:
 * - @react-navigation/native
 * - expo-router
 *
 * This keeps the animation system independent from the navigation
 * implementation and avoids React Navigation compatibility issues.
 */
export function useAnimationGate(reduceMotion?: boolean) {
  const systemReduceMotion = useReducedMotion();

  const [foreground, setForeground] = useState(
    () => AppState.currentState === 'active'
  );

  const appStateRef = useRef<AppStateStatus>(AppState.currentState as AppStateStatus);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextState) => {
        appStateRef.current = nextState;
        setForeground(nextState === 'active');
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  // Explicit setting wins over the device accessibility setting.
  const motionOff = reduceMotion ?? systemReduceMotion;

  return {
    active: foreground && !motionOff,
    motionOff,
  };
}

/**
 * Creates a Reanimated shared value that repeatedly animates
 * while `active` is true.
 *
 * The animation is cancelled immediately when:
 * - active becomes false
 * - the component unmounts
 */
export function useLoopValue(
  active: boolean,
  from: number,
  makeAnimation: () => number
): SharedValue<number> {
  const sharedValue = useSharedValue(from);

  useEffect(() => {
    if (!active) {
      cancelAnimation(sharedValue);
      sharedValue.value = from;
      return;
    }

    sharedValue.value = from;
    sharedValue.value = makeAnimation();

    return () => {
      cancelAnimation(sharedValue);
    };
  }, [active, from, makeAnimation, sharedValue]);

  return sharedValue;
}