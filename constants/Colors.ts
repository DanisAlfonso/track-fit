/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0099FF';
const tintColorDark = '#4CC9F0';

export default {
  light: {
    primary: '#0099FF',
    secondary: '#4C75F0',
    accent: '#FA7921',
    background: '#F8F8F8',
    card: '#FFFFFF',
    text: '#1A1A1A',
    subtext: '#717171',
    border: '#E0E0E0',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    tint: tintColorLight,
    tabIconDefault: '#CCCCCC',
    tabIconSelected: tintColorLight,
  },
  dark: {
    primary: '#4CC9F0',
    secondary: '#8C9EFF',
    accent: '#FF9F1C',
    background: '#121212',
    card: '#1E1E1E',
    text: '#F8F8F8',
    subtext: '#AAAAAA',
    border: '#333333',
    success: '#4CAF50',
    error: '#F44336',
    warning: '#FF9800',
    tint: tintColorDark,
    tabIconDefault: '#666666',
    tabIconSelected: tintColorDark,
  },
};
