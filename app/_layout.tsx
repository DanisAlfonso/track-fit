import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import { useColorScheme, Alert, View, Platform } from 'react-native';
import { initDatabase, insertDefaultExercises, migrateDatabase, syncExercises } from '@/utils/database';
import { WorkoutProvider } from '@/context/WorkoutContext';
import ActiveWorkoutIndicator from '@/components/ActiveWorkoutIndicator';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Initialize database and prepare app
  useEffect(() => {
    async function prepare() {
      try {
        // Initialize & migrate database
        console.log('Initializing database...');
        await initDatabase();
        console.log('Database initialized successfully');
        
        console.log('Migrating database if needed...');
        await migrateDatabase();
        console.log('Database migration checked');
        
        // Insert default data
        console.log('Inserting default exercises...');
        await insertDefaultExercises();
        console.log('Default exercises inserted successfully');
        
        // Synchronize exercises with master list (adding new ones and removing deprecated ones)
        console.log('Synchronizing exercises...');
        await syncExercises();
        console.log('Exercise synchronization completed');
        
        // Artificial delay for a smoother splash screen experience
        // Only apply in production to avoid slowing down development
        if (!__DEV__) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error('Error setting up database:', error);
        Alert.alert('Database Error', 'Failed to initialize the database. The app may not function correctly.');
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && loaded) {
      // This tells the splash screen to hide immediately
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, loaded]);

  if (!appIsReady || !loaded) {
    return null;
  }

  return <RootLayoutNav onReady={onLayoutRootView} />;
}

function RootLayoutNav({ onReady }: { onReady: () => Promise<void> }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ThemedNavigator onReady={onReady} />
      </ToastProvider>
    </ThemeProvider>
  );
}

function ThemedNavigator({ onReady }: { onReady: () => Promise<void> }) {
  const { currentTheme } = useTheme();
  const navTheme = currentTheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <WorkoutProvider>
      <NavigationThemeProvider value={navTheme}>
        <View style={{ flex: 1 }} onLayout={onReady}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <ActiveWorkoutIndicator />
        </View>
      </NavigationThemeProvider>
    </WorkoutProvider>
  );
}
