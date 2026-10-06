// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // These two React Compiler-oriented rules (new in eslint-config-expo's
    // SDK 57 bump) flag this codebase's standard patterns as errors:
    // fetch-on-mount/focus effects that setState (set-state-in-effect), and
    // react-native-reanimated's intentional `sharedValue.value = x` mutation
    // API (immutability). Neither is a real bug here, so they're off rather
    // than noise across ~30 files.
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
    },
  },
]);
