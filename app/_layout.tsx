import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import { useColorScheme, Alert, View, Platform, Vibration } from 'react-native';
import { initDatabase, insertDefaultExercises, migrateDatabase, syncExercises, initNotificationPreferences } from '@/utils/database';
import { WorkoutProvider, useWorkout } from '@/context/WorkoutContext';
import ActiveWorkoutIndicator from '@/components/ActiveWorkoutIndicator';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { ToastProvider, useToast } from '@/context/ToastContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import Colors from '@/constants/Colors';

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
        
        // Initialize notification preferences
        console.log('Setting up notification preferences...');
        await initNotificationPreferences();
        console.log('Notification preferences initialized');
        
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
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT
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
      // This tells the splash screen to hide immediately
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, loaded]);

  if (!appIsReady || !loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ThemeProvider>
          <ToastProvider>
            <WorkoutProvider>
              <RootLayoutNav />
            </WorkoutProvider>
          </ToastProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { theme: appTheme } = useTheme();
  const currentTheme = appTheme === 'system' ? colorScheme ?? 'light' : appTheme;
  const navTheme = currentTheme === 'dark' ? DarkTheme : DefaultTheme;
  const { checkForAbandonedWorkout } = useWorkout();
  const { showToast } = useToast();

  // Check for abandoned workouts when app starts
  useEffect(() => {
    const checkWorkouts = async () => {
      const hasRecovered = await checkForAbandonedWorkout();
      if (hasRecovered) {
        // Show a notification to the user
        showToast(
          'Recovered a workout in progress. You can resume it from the home screen.',
          'info',
          5000
        );
      }
    };
    
    checkWorkouts();
  }, []);

  // Get the actual theme colors from your app's color constants
  const backgroundColor = currentTheme === 'dark' ? Colors.dark.background : Colors.light.background;
  const cardColor = currentTheme === 'dark' ? Colors.dark.card : Colors.light.card;

  // Configure status bar and navigation bar based on theme
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Configure Android navigation bar (bottom system buttons)
      NavigationBar.setVisibilityAsync('visible');
      NavigationBar.setPositionAsync('absolute');
      NavigationBar.setBackgroundColorAsync(backgroundColor);
      NavigationBar.setButtonStyleAsync(currentTheme === 'dark' ? 'light' : 'dark');
    }
  }, [currentTheme, backgroundColor]);

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ 
        flex: 1, 
        backgroundColor: backgroundColor,
      }}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <ActiveWorkoutIndicator />
      </SafeAreaView>
    </NavigationThemeProvider>
  );
}

export { ErrorBoundary } from 'expo-router';
