import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import { useColorScheme, Alert, View, Platform, Vibration } from 'react-native';
import { initDatabase, insertDefaultExercises, migrateDatabase, syncExercises } from '@/utils/database';
import { WorkoutProvider } from '@/context/WorkoutContext';
import ActiveWorkoutIndicator from '@/components/ActiveWorkoutIndicator';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

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
        // Cancel any existing notifications when the app opens
        await Notifications.cancelAllScheduledNotificationsAsync();
        
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

  // Setup notification handler and listener for timer vibrations
  useEffect(() => {
    // Configure the notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    
    // Request notification permissions
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    
    requestPermissions();
    
    // Listen for notifications to trigger vibrations
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      
      // Handle timer vibrations
      if (data?.type === 'timer-complete') {
        Vibration.vibrate([100, 200, 100, 200, 100]);
      }
    });
    
    return () => subscription.remove();
  }, []);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && loaded) {
      // This tells the splash screen to hide immediately! If we call this after
      // `setAppIsReady`, then we may see a blank screen while the app is
      // loading its initial state and rendering its first pixels. So instead,
      // we hide the splash screen once we know the root view has already
      // performed layout.
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, loaded]);

  if (!appIsReady || !loaded) {
    return null;
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <ThemeProvider>
        <ToastProvider>
          <WorkoutProvider>
            <RootLayoutNav />
          </WorkoutProvider>
        </ToastProvider>
      </ThemeProvider>
    </View>
  );
}

function RootLayoutNav() {
  const { currentTheme } = useTheme();
  const navTheme = currentTheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationThemeProvider value={navTheme}>
      <View style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <ActiveWorkoutIndicator />
      </View>
    </NavigationThemeProvider>
  );
}
