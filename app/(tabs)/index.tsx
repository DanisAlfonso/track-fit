import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Animated, Image } from 'react-native';
import { FontAwesome5, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useWorkout } from '@/context/WorkoutContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProgressBottomSheet } from '@/components/ProgressBottomSheet';

// User profile keys
const USER_NAME_KEY = 'user_name';
const USER_PROFILE_PICTURE_KEY = 'user_profile_picture';

// Define stat icon colors
const statColors = {
  totalWorkouts: ['#4361EE', '#3A0CA3'] as [string, string], // Purple-blue gradient
  totalTime: ['#4CC9F0', '#4895EF'] as [string, string],     // Blue gradient
  thisWeek: ['#F72585', '#B5179E'] as [string, string],      // Pink-purple gradient
  streak: ['#F15BB5', '#FF5E5B'] as [string, string]         // Pink-orange gradient
};

// Define button gradients that complement the stat colors
const buttonGradients = {
  newRoutine: ['#6366F1', '#4F46E5'] as [string, string],    // Subtle indigo gradient
  startWorkout: ['#3B82F6', '#2563EB'] as [string, string]   // Subtle blue gradient
};

type Routine = {
  id: number;
  name: string;
  exerciseCount: number;
};

type RecentWorkout = {
  id: number;
  date: number;
  routine_name: string;
  duration: number;
  exercise_count: number;
  max_weight?: number;    // Maximum weight used in the workout
  primary_muscles?: string; // Main muscle groups worked
};

type WorkoutStats = {
  total_workouts: number;
  total_duration: number;
  this_week: number;
  last_workout_date: number | null;
  streak: number;
};

interface StrengthProgress {
    exercise_id: number;
    exercise_name: string;
    current_1rm: number;
    previous_1rm: number;
    improvement: number;
    improvement_percentage: number;
    last_workout_date: number;
    total_workout_sessions: number;
    recent_workout_sessions: number;
    previous_workout_sessions: number;
  }

type MonthlyStrengthGains = {
  total_exercises_improved: number;
  average_improvement: number;
  best_improvement: {
    exercise_name: string;
    improvement: number;
  } | null;
};

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const { showToast } = useToast();
  const { activeWorkout } = useWorkout();
  
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<RecentWorkout[]>([]);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todaysRoutine, setTodaysRoutine] = useState<{ name: string; id: number; exerciseCount: number } | null>(null);
  const [userName, setUserName] = useState('Fitness Enthusiast');
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [isRestDayToday, setIsRestDayToday] = useState(false);
  const [strengthProgress, setStrengthProgress] = useState<StrengthProgress[]>([]);
  const [monthlyGains, setMonthlyGains] = useState<MonthlyStrengthGains | null>(null);

  // ProgressBottomSheet state
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetType, setBottomSheetType] = useState<'totalWorkouts' | 'totalTime' | 'thisWeek' | 'streak'>('totalWorkouts');
  const [bottomSheetValue, setBottomSheetValue] = useState<string | number>('');

  // Animation values
  const [fadeAnim] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(20));

  useEffect(() => {
    // Start animations after initial render
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
    
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const loadData = async () => {
    try {
      // Only show loading indicator on initial load, not during refresh
      if (!refreshing) {
        setLoading(true);
      }
      
      const db = await getDatabase();
      
      // Load routines
      const routinesResults = await db.getAllAsync<Routine>(`
        SELECT r.id, r.name, 
        (SELECT COUNT(*) FROM routine_exercises WHERE routine_id = r.id) as exerciseCount
        FROM routines r
        ORDER BY r.created_at DESC
      `);
      setRoutines(routinesResults);
      
      // Load recent workouts - Only select workouts that still exist and are completed
      const recentWorkoutsResults = await db.getAllAsync<RecentWorkout>(`
        SELECT 
          w.id, 
          w.date, 
          r.name as routine_name, 
          w.duration,
          (SELECT COUNT(DISTINCT we.exercise_id) FROM workout_exercises we WHERE we.workout_id = w.id) as exercise_count,
          (SELECT MAX(s.weight) FROM sets s 
           JOIN workout_exercises we ON s.workout_exercise_id = we.id 
           WHERE we.workout_id = w.id) as max_weight,
          (SELECT GROUP_CONCAT(DISTINCT e.primary_muscle) 
           FROM workout_exercises we 
           JOIN exercises e ON we.exercise_id = e.id 
           WHERE we.workout_id = w.id 
           LIMIT 3) as primary_muscles
        FROM workouts w
        JOIN routines r ON w.routine_id = r.id
        WHERE w.completed_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM workouts WHERE id = w.id)
        ORDER BY w.date DESC
        LIMIT 3
      `);
      setRecentWorkouts(recentWorkoutsResults);
      
      // Load workout stats
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Calculate days to subtract to get to Monday
      // If today is Sunday (0), go back 6 days to get to Monday
      // If today is Monday (1), go back 0 days
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - daysToSubtract); // Start of current week (Monday)
      startOfWeek.setHours(0, 0, 0, 0);
      
      const statsResult = await db.getFirstAsync<WorkoutStats>(`
        SELECT 
          COUNT(*) as total_workouts,
          SUM(duration) as total_duration,
          (SELECT COUNT(*) FROM workouts WHERE date >= ? AND completed_at IS NOT NULL) as this_week,
          (SELECT MAX(date) FROM workouts WHERE completed_at IS NOT NULL) as last_workout_date,
          0 as streak
        FROM workouts
        WHERE completed_at IS NOT NULL
      `, [startOfWeek.getTime()]);
      
      // Calculate streak (simplified version - assumes consecutive days)
      if (statsResult && statsResult.last_workout_date) {
        let streak = 0;
        const lastWorkoutDate = new Date(statsResult.last_workout_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check if last workout was yesterday or today
        const lastWorkoutDay = lastWorkoutDate.setHours(0, 0, 0, 0);
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        if (lastWorkoutDay >= yesterday.getTime()) {
          // Start counting streak
          let currentDate = new Date(lastWorkoutDate);
          let keepCounting = true;
          
          while (keepCounting) {
            const workoutOnDate = await db.getFirstAsync(`
              SELECT 1 FROM workouts 
              WHERE date >= ? AND date < ? AND completed_at IS NOT NULL
              LIMIT 1
            `, [
              currentDate.setHours(0, 0, 0, 0),
              currentDate.setHours(23, 59, 59, 999)
            ]);
            
            if (workoutOnDate) {
              streak++;
              currentDate = new Date(currentDate);
              currentDate.setDate(currentDate.getDate() - 1);
            } else {
              keepCounting = false;
            }
          }
        }
        
        statsResult.streak = streak;
      }
      
      setStats(statsResult);
      
      // Load today's scheduled workout if any
      await loadTodaysScheduledWorkout();

      // Check if today is a rest day according to weekly schedule
      const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      const weeklyScheduleResult = await db.getAllAsync<{routine_id: number}>(
        'SELECT routine_id FROM weekly_schedule WHERE day_of_week = ?',
        [today]
      );
      
      // It's a rest day if there are no routines scheduled for today
      setIsRestDayToday(weeklyScheduleResult.length === 0);

      // Load user name and profile picture from AsyncStorage
      try {
        const name = await AsyncStorage.getItem(USER_NAME_KEY);
        if (name) {
          setUserName(name);
        }
        
        const profilePicture = await AsyncStorage.getItem(USER_PROFILE_PICTURE_KEY);
        setProfilePictureUri(profilePicture);
      } catch (error) {
        console.error('Error loading user profile data:', error);
        // Keep default values if there's an error
      }

      // Load strength progress data
      await loadStrengthProgress();
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 1RM Calculation Functions
  const calculate1RM = {
    // Average of multiple formulas for better accuracy
    average: (weight: number, reps: number): number => {
      if (reps === 1) return weight;
      if (reps > 15) return weight; // Formulas become unreliable at very high reps
      
      // Brzycki formula: weight × (36 / (37 - reps))
      const brzycki = reps >= 37 ? weight : weight * (36 / (37 - reps));
      
      // Epley formula: weight × (1 + reps/30)
      const epley = weight * (1 + reps / 30);
      
      // McGlothin formula: weight × (100 / (101.3 - 2.67123 × reps))
      const mcglothin = weight * (100 / (101.3 - 2.67123 * reps));
      
      return (brzycki + epley + mcglothin) / 3;
    }
  };

  const loadStrengthProgress = async () => {
    try {
      const db = await getDatabase();
      
      // Get the date 60 days ago for broader comparison window
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const sixtyDaysAgoTimestamp = sixtyDaysAgo.getTime();
      
      // Get the date 14 days ago for recent progress (last 2 weeks)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const fourteenDaysAgoTimestamp = fourteenDaysAgo.getTime();
      
      // Query to get exercise progress data with improved logic
      const progressQuery = `
        WITH exercise_workout_counts AS (
          SELECT 
            e.id as exercise_id,
            e.name as exercise_name,
            COUNT(DISTINCT w.date) as total_workout_sessions,
            COUNT(DISTINCT CASE WHEN w.date >= ? THEN w.date END) as recent_workout_sessions,
            COUNT(DISTINCT CASE WHEN w.date < ? THEN w.date END) as previous_workout_sessions
          FROM exercises e
          JOIN workout_exercises we ON e.id = we.exercise_id
          JOIN workouts w ON we.workout_id = w.id
          JOIN sets s ON we.id = s.workout_exercise_id
          WHERE w.completed_at IS NOT NULL 
            AND s.weight > 0 
            AND s.reps > 0
            AND s.reps <= 15
            AND w.date >= ?
          GROUP BY e.id, e.name
          HAVING total_workout_sessions >= 2
            AND recent_workout_sessions >= 1
            AND previous_workout_sessions >= 1
        ),
        exercise_1rm_data AS (
          SELECT 
            e.id as exercise_id,
            e.name as exercise_name,
            w.date as workout_date,
            s.weight,
            s.reps,
            (s.weight * (1 + s.reps/30)) as estimated_1rm
          FROM exercises e
          JOIN workout_exercises we ON e.id = we.exercise_id
          JOIN workouts w ON we.workout_id = w.id
          JOIN sets s ON we.id = s.workout_exercise_id
          JOIN exercise_workout_counts ewc ON e.id = ewc.exercise_id
          WHERE w.completed_at IS NOT NULL 
            AND s.weight > 0 
            AND s.reps > 0
            AND s.reps <= 15
            AND w.date >= ?
        ),
        recent_best AS (
          SELECT 
            exercise_id,
            exercise_name,
            MAX(estimated_1rm) as best_recent_1rm,
            MAX(workout_date) as last_workout_date
          FROM exercise_1rm_data
          WHERE workout_date >= ?
          GROUP BY exercise_id, exercise_name
        ),
        previous_best AS (
          SELECT 
            exercise_id,
            exercise_name,
            MAX(estimated_1rm) as best_previous_1rm
          FROM exercise_1rm_data
          WHERE workout_date < ?
          GROUP BY exercise_id, exercise_name
        )
        SELECT 
          r.exercise_id,
          r.exercise_name,
          r.best_recent_1rm as current_1rm,
          p.best_previous_1rm as previous_1rm,
          (r.best_recent_1rm - p.best_previous_1rm) as improvement,
          ((r.best_recent_1rm - p.best_previous_1rm) / p.best_previous_1rm) * 100 as improvement_percentage,
          r.last_workout_date,
          ewc.total_workout_sessions,
          ewc.recent_workout_sessions,
          ewc.previous_workout_sessions
        FROM recent_best r
        INNER JOIN previous_best p ON r.exercise_id = p.exercise_id
        INNER JOIN exercise_workout_counts ewc ON r.exercise_id = ewc.exercise_id
        WHERE r.best_recent_1rm > p.best_previous_1rm
        ORDER BY improvement_percentage DESC
        LIMIT 3
      `;
      
      const progressResults = await db.getAllAsync<StrengthProgress>(
        progressQuery,
        [
          fourteenDaysAgoTimestamp, // for recent_workout_sessions count
          fourteenDaysAgoTimestamp, // for previous_workout_sessions count
          sixtyDaysAgoTimestamp,    // for total data window
          sixtyDaysAgoTimestamp,    // for exercise_1rm_data
          fourteenDaysAgoTimestamp, // for recent_best
          fourteenDaysAgoTimestamp  // for previous_best
        ]
      );
      
      setStrengthProgress(progressResults);
      
      // Calculate monthly gains summary
      if (progressResults.length > 0) {
        const totalImprovement = progressResults.reduce((sum, item) => sum + item.improvement, 0);
        const averageImprovement = totalImprovement / progressResults.length;
        const bestImprovement = progressResults[0]; // Already sorted by improvement DESC
        
        setMonthlyGains({
          total_exercises_improved: progressResults.length,
          average_improvement: averageImprovement,
          best_improvement: {
            exercise_name: bestImprovement.exercise_name,
            improvement: bestImprovement.improvement
          }
        });
      } else {
        setMonthlyGains({
          total_exercises_improved: 0,
          average_improvement: 0,
          best_improvement: null
        });
      }
    } catch (error) {
      console.error('Error loading strength progress:', error);
    }
  };

  const loadTodaysScheduledWorkout = async () => {
    try {
      const db = await getDatabase();
      const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      const scheduledRoutine = await db.getFirstAsync<{ name: string; id: number; exerciseCount: number } | null>(`
        SELECT r.id, r.name, 
        (SELECT COUNT(*) FROM routine_exercises WHERE routine_id = r.id) as exerciseCount
        FROM weekly_schedule ws
        JOIN routines r ON ws.routine_id = r.id
        WHERE ws.day_of_week = ?
      `, [today]);
      
      if (scheduledRoutine) {
        setTodaysRoutine(scheduledRoutine);
      } else {
        setTodaysRoutine(null);
      }
    } catch (error) {
      console.error('Error loading today\'s routine:', error);
    }
  };

  const navigateToCreateRoutine = () => {
    router.push('/routine/create');
  };

  const handleStartWorkout = () => {
    if (loading) {
      return;
    }
    
    // Check if there's already an active workout
    if (activeWorkout.id) {
      showToast('You already have a workout in progress. Please finish or cancel it before starting a new one.', 'error');
      
      // Navigate to the existing workout
      router.push({
        pathname: "/workout/start",
        params: { workoutId: activeWorkout.id }
      });
      return;
    }
    
    if (routines.length === 0) {
      showToast('You need to create a routine before starting a workout.', 'info', 5000, {
        label: 'Create',
        onPress: navigateToCreateRoutine
      });
      return;
    }

    if (routines.length === 1) {
      const routine = routines[0];
      if (routine.exerciseCount === 0) {
        showToast(`The routine "${routine.name}" doesn't have any exercises yet.`, 'info', 5000, {
          label: 'Edit',
          onPress: () => router.push(`/routine/edit/${routine.id}`)
        });
        return;
      }
      
      router.push({
        pathname: '/workout/start',
        params: { routineId: routine.id }
      });
    } else {
      router.push('/routine/select');
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  const navigateToWorkout = async (workoutId: number) => {
    try {
      // Check if the workout still exists in the database before navigating
      const db = await getDatabase();
      const workout = await db.getFirstAsync(`SELECT id FROM workouts WHERE id = ?`, [workoutId]);
      
      if (workout) {
        router.push({
          pathname: '/workout/[id]',
          params: { id: workoutId }
        });
      } else {
        // Workout doesn't exist anymore, was probably deleted
        showToast('This workout has been deleted.', 'error');
        // Refresh the data to remove the deleted workout from recent workouts
        loadData();
      }
    } catch (error) {
      console.error('Error checking workout existence:', error);
      showToast('Failed to load workout details.', 'error');
    }
  };

  const navigateToHistory = () => {
    router.push('/history');
  };

  const handleRoutinePress = (routine: Routine) => {
    if (routine.exerciseCount > 0) {
      router.push({
        pathname: '/workout/start',
        params: { routineId: routine.id }
      });
    } else {
      showToast(`This routine doesn't have any exercises yet.`, 'info', 5000, {
        label: 'Edit',
        onPress: () => router.push(`/routine/edit/${routine.id}`)
      });
    }
  };

  const getGreeting = (): string => {
    const currentHour = new Date().getHours();
    let timeGreeting = '';
    
    // Time-based greeting with more casual, friendly options
    if (currentHour < 12) {
      timeGreeting = ['Hey there', 'Morning', 'Rise and shine'][Math.floor(Math.random() * 3)];
    } else if (currentHour < 17) {
      timeGreeting = ['Hey', "What's up", 'Afternoon'][Math.floor(Math.random() * 3)];
    } else {
      timeGreeting = ['Hey there', 'Evening', 'Hi there'][Math.floor(Math.random() * 3)];
    }
    
    // If they completed a workout today
    if (recentWorkouts.length > 0) {
      const today = new Date().setHours(0, 0, 0, 0);
      const latestWorkoutDate = new Date(recentWorkouts[0].date).setHours(0, 0, 0, 0);
      
      if (today === latestWorkoutDate) {
        return `Nice work today, ${userName}!`;
      }
    }
    
    // If they have a streak of 3+ days
    if (stats?.streak && stats.streak >= 3) {
      return `Crushing it, ${userName}!`;
    }
    
    // Default is time-based greeting
    return `${timeGreeting}, ${userName}!`;
  };

  const getWelcomeSubtitle = (): React.ReactNode => {
    // Check if there's a workout scheduled for today
    if (todaysRoutine) {
      return (
        <Text>
          <Text style={{ fontWeight: 'bold' }}>{todaysRoutine.name}</Text>
          <Text> is on your schedule today</Text>
        </Text>
      );
    }
    
    // If today is a rest day according to weekly schedule
    if (isRestDayToday) {
      return "Rest day today - recovery is key to progress";
    }
    
    // Generate data-driven insights based on workout history
    
    // If user has recent workouts, give insights on their progress
    if (recentWorkouts.length > 0) {
      const latestWorkout = recentWorkouts[0];
      const today = new Date().setHours(0, 0, 0, 0);
      const latestWorkoutDate = new Date(latestWorkout.date).setHours(0, 0, 0, 0);
      const daysSinceLastWorkout = Math.floor((today - latestWorkoutDate) / (1000 * 60 * 60 * 24));
      
      // Give insight based on recent activity
      if (daysSinceLastWorkout === 1) {
        // Day after a workout - don't assume it's a rest day
        return `Yesterday: ${latestWorkout.routine_name}`;
      } else if (daysSinceLastWorkout >= 2 && daysSinceLastWorkout <= 3) {
        // 2-3 days since last workout - encourage a new session
        return `${daysSinceLastWorkout} days since your last workout`;
      } else if (daysSinceLastWorkout > 3) {
        // More than 3 days - stronger encouragement
        return `Time to get back to your fitness routine`;
      }
    }
    
    // Check if there's a streak going
    if (stats?.streak && stats.streak > 1) {
      return `${stats.streak} day streak! Keep it up!`;
    }
    
    // Weekly goal progress
    if (stats?.this_week && stats.this_week > 0) {
      // If user has at least one workout this week
      if (stats.this_week === 1) {
        return "1 workout this week — great start!";
      } else {
        return `${stats.this_week} workouts this week — impressive!`;
      }
    }
    
    // For new users with no workouts
    if (stats?.total_workouts === 0) {
      return "Start your fitness journey today";
    }
    
    // Fallback to time-based encouragement
    const currentHour = new Date().getHours();
    if (currentHour < 12) {
      return "Morning workout gets you energized all day";
    } else if (currentHour < 17) {
      return "Afternoon sessions boost productivity";
    } else {
      return "Evening workouts help reduce stress";
    }
  };

  // Render the stat cards with different colors
  const renderStatCard = (
    icon: string, 
    value: string | number, 
    label: string, 
    gradientColors: string[],
    index: number,
    type: 'totalWorkouts' | 'totalTime' | 'thisWeek' | 'streak'
  ) => {
    // Stagger animation for each card
    const animDelay = index * 100;
    
    const handlePress = () => {
      setBottomSheetType(type);
      setBottomSheetValue(value);
      setBottomSheetVisible(true);
    };
    
    return (
      <TouchableOpacity 
        onPress={handlePress}
        style={[
          styles.statCard, 
          { 
            backgroundColor: currentTheme === 'dark' ? '#252525' : colors.card,
            shadowColor: gradientColors[0],
            shadowOpacity: 0.15
          }
        ]}
      >
        <Animated.View 
          style={[
            { 
              opacity: fadeAnim,
              transform: [{ translateY: translateY }],
              alignItems: 'center'
            }
          ]}
        >
          <LinearGradient
            colors={[gradientColors[0], gradientColors[1]]}
            style={styles.statIconContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <FontAwesome5 name={icon} size={16} color="white" />
          </LinearGradient>
          <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>{label}</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading your dashboard...</Text>
        </View>
      </View>
    );
  }

  return (
    <>
      <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
          title="Pull to refresh"
          titleColor={colors.subtext}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.greetingSection}>
            <Text style={[styles.welcomeMessage, { color: colors.text }]}>{getGreeting()}</Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.subtext }]}>{getWelcomeSubtitle()}</Text>
          </View>
          <TouchableOpacity 
            style={[styles.profileButton, { backgroundColor: colors.card }]}
            onPress={() => router.push('/profile')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              style={styles.profileIconContainer}
            >
              {profilePictureUri ? (
                <Image 
                  source={{ uri: profilePictureUri }} 
                  style={styles.profileImage} 
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.profileInitial}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={navigateToCreateRoutine}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={buttonGradients.newRoutine}
              style={styles.quickActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <FontAwesome5 name="plus" size={16} color="white" />
              <Text style={styles.quickActionText}>New Routine</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={handleStartWorkout}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={buttonGradients.startWorkout}
              style={styles.quickActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <FontAwesome5 name="play" size={14} color="white" />
              <Text style={styles.quickActionText}>Start Workout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Today's Workout */}
      {todaysRoutine && (
        <Animated.View 
          style={[
            styles.todaysWorkoutContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Workout</Text>
          
          <TouchableOpacity 
            style={[styles.todaysWorkoutCard, { backgroundColor: colors.card }]}
            onPress={() => {
              if (todaysRoutine.exerciseCount > 0) {
                // Check if there's already an active workout
                if (activeWorkout.id) {
                  showToast('You already have a workout in progress. Please finish or cancel it before starting a new one.', 'error');
                  
                  // Navigate to the existing workout
                  router.push({
                    pathname: "/workout/start",
                    params: { workoutId: activeWorkout.id }
                  });
                  return;
                }
                
                router.push({
                  pathname: '/workout/start',
                  params: { routineId: todaysRoutine.id }
                });
              } else {
                showToast(`This routine doesn't have any exercises yet.`, 'info', 5000, {
                  label: 'Edit',
                  onPress: () => router.push(`/routine/edit/${todaysRoutine.id}`)
                });
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.todaysWorkoutContent}>
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.todaysWorkoutIconContainer}
              >
                <FontAwesome5 name="calendar-day" size={20} color="white" />
              </LinearGradient>
              <View style={styles.todaysWorkoutInfo}>
                <Text style={[styles.todaysWorkoutTitle, { color: colors.text }]}>
                  {todaysRoutine.name}
                </Text>
                <Text style={[styles.todaysWorkoutSubtitle, { color: colors.subtext }]}>
                  {todaysRoutine.exerciseCount} exercise{todaysRoutine.exerciseCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              style={styles.startButton}
            >
              <FontAwesome5 name="play" size={14} color="white" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.scheduleLink}
            onPress={() => router.push('/weekly-schedule')}
          >
            <Text style={[styles.scheduleLinkText, { color: colors.primary }]}>View Weekly Schedule</Text>
            <FontAwesome5 name="chevron-right" size={12} color={colors.primary} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Workout Stats */}
      <View style={styles.statsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Progress</Text>
        
        <View style={styles.statsGrid}>
          {renderStatCard(
            "calendar-check", 
            stats?.total_workouts || 0, 
            "Total Workouts", 
            statColors.totalWorkouts,
            0,
            'totalWorkouts'
          )}
          
          {renderStatCard(
            "clock", 
            stats?.total_duration ? formatDuration(stats.total_duration) : '0m', 
            "Total Time", 
            statColors.totalTime,
            1,
            'totalTime'
          )}
          
          {renderStatCard(
            "calendar-week", 
            stats?.this_week || 0, 
            "This Week", 
            statColors.thisWeek,
            2,
            'thisWeek'
          )}
          
          {renderStatCard(
            "fire", 
            stats?.streak || 0, 
            "Day Streak", 
            statColors.streak,
            3,
            'streak'
          )}
        </View>
      </View>

      {/* Strength Progress Summary */}
      {strengthProgress.length > 0 && (
        <Animated.View 
          style={[
            styles.strengthProgressContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Strength Progress</Text>
            <TouchableOpacity onPress={() => router.push('/analytics')}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {/* Monthly Summary */}
          {monthlyGains && (
            <View style={[styles.monthlyGainsCard, { backgroundColor: colors.card }]}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.monthlyGainsIconContainer}
              >
                <FontAwesome5 name="chart-line" size={16} color="white" />
              </LinearGradient>
              <View style={styles.monthlyGainsContent}>
                <Text style={[styles.monthlyGainsTitle, { color: colors.text }]}>This Month</Text>
                <Text style={[styles.monthlyGainsText, { color: colors.subtext }]}>
                  {monthlyGains.total_exercises_improved} exercise{monthlyGains.total_exercises_improved !== 1 ? 's' : ''} improved
                  {monthlyGains.best_improvement && (
                    <Text> • Best: {monthlyGains.best_improvement.exercise_name} (+{monthlyGains.best_improvement.improvement.toFixed(1)}kg)</Text>
                  )}
                </Text>
              </View>
            </View>
          )}
          
          {/* Top 3 Exercises with Recent Improvements */}
          <View style={styles.strengthProgressList}>
            {strengthProgress.map((exercise, index) => (
              <TouchableOpacity 
                key={exercise.exercise_id}
                style={[styles.strengthProgressCard, { backgroundColor: colors.card }]}
                onPress={() => router.push(`/exercise/history/${exercise.exercise_id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.strengthProgressContent}>
                  <View style={styles.strengthProgressHeader}>
                    <Text style={[styles.strengthProgressName, { color: colors.text }]}>
                      {exercise.exercise_name}
                    </Text>
                    <View style={[styles.improvementBadge, { backgroundColor: colors.primaryLight }]}>
                      <FontAwesome5 name="arrow-up" size={10} color={colors.primary} />
                      <Text style={[styles.improvementText, { color: colors.primary }]}>
                        +{exercise.improvement.toFixed(1)}kg
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.strengthProgressMeta}>
                    <View style={styles.strengthProgressMetaItem}>
                      <FontAwesome5 name="weight" size={12} color={colors.primary} style={styles.metaIcon} />
                      <Text style={[styles.strengthProgressMetaText, { color: colors.subtext }]}>
                        1RM: {exercise.current_1rm.toFixed(1)}kg
                      </Text>
                    </View>
                    <View style={styles.strengthProgressMetaItem}>
                      <FontAwesome5 name="percentage" size={12} color={colors.primary} style={styles.metaIcon} />
                      <Text style={[styles.strengthProgressMetaText, { color: colors.subtext }]}>
                        +{exercise.improvement_percentage.toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.strengthProgressMetaItem}>
                      <FontAwesome5 name="dumbbell" size={12} color={colors.primary} style={styles.metaIcon} />
                      <Text style={[styles.strengthProgressMetaText, { color: colors.subtext }]}>
                        {exercise.total_workout_sessions} session{exercise.total_workout_sessions !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={[styles.lastWorkoutDate, { color: colors.subtext }]}>
                    Last: {formatDate(exercise.last_workout_date)} • Recent: {exercise.recent_workout_sessions}, Previous: {exercise.previous_workout_sessions}
                  </Text>
                </View>
                
                <View style={styles.arrowContainer}>
                  <FontAwesome5 name="chevron-right" size={14} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Recent Workouts */}
      <View style={styles.recentWorkoutsContainer}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Workouts</Text>
          <TouchableOpacity onPress={navigateToHistory}>
            <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {recentWorkouts.length > 0 ? (
          recentWorkouts.map((workout, index) => (
            <TouchableOpacity 
              key={workout.id}
              style={[
                styles.workoutCard
              ]}
              onPress={() => navigateToWorkout(workout.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.cardInner, {backgroundColor: colors.card}]}>
                <View style={[styles.workoutDateContainer, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.workoutDate, { color: colors.primary }]}>
                    {formatDate(workout.date)}
                  </Text>
                </View>
                <View style={styles.workoutContent}>
                  <Text style={[styles.workoutName, { color: colors.text }]}>{workout.routine_name}</Text>
                  
                  <View style={styles.workoutMeta}>
                    <View style={styles.workoutMetaItem}>
                      <FontAwesome5 name="dumbbell" size={12} color={colors.primary} style={styles.metaIcon} />
                      <Text style={[styles.workoutMetaText, { color: colors.subtext }]}>
                        {workout.exercise_count} exercises
                      </Text>
                    </View>
                    <View style={styles.workoutMetaItem}>
                      <FontAwesome5 name="clock" size={12} color={colors.primary} style={styles.metaIcon} />
                      <Text style={[styles.workoutMetaText, { color: colors.subtext }]}>
                        {formatDuration(workout.duration)}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Additional Information */}
                  <View style={styles.workoutExtraInfo}>
                    {workout.max_weight ? (
                      <View style={styles.workoutTagItem}>
                        <FontAwesome5 name="weight" size={10} color={colors.primary} />
                        <Text style={[styles.workoutTagText, { color: colors.subtext }]}>
                          Max: {workout.max_weight}kg
                        </Text>
                      </View>
                    ) : null}
                    
                    {workout.primary_muscles ? (
                      <View style={styles.workoutTagItem}>
                        <FontAwesome5 name="running" size={10} color={colors.primary} />
                        <Text style={[styles.workoutTagText, { color: colors.subtext }]}>
                          {workout.primary_muscles.split(',').slice(0, 2).join(', ')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.arrowContainer}>
                  <FontAwesome5 name="chevron-right" size={14} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.emptyWorkoutsContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Workouts Yet</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              Time to start your fitness journey
            </Text>
            <TouchableOpacity 
              style={styles.startWorkoutButton} 
              onPress={handleStartWorkout}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={buttonGradients.startWorkout}
                style={styles.startWorkoutGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.startWorkoutText}>Start First Workout</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        </View>
      </ScrollView>
      
      <ProgressBottomSheet
        visible={bottomSheetVisible}
        onClose={() => setBottomSheetVisible(false)}
        type={bottomSheetType}
        value={bottomSheetValue}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding to ensure content is visible above tab bar
  },
  header: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greetingSection: {
    flex: 1,
    marginRight: 16,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  profileInitial: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  welcomeMessage: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  welcomeSubtitle: {
    fontSize: 16,
    opacity: 0.8,
  },
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  quickActionText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 15,
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  recentWorkoutsContainer: {
    marginBottom: 24,
  },
  workoutCard: {
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 20, // Increased to make card larger
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutDateContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 14,
  },
  workoutDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  workoutContent: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Added space for extra info
  },
  workoutMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaIcon: {
    marginRight: 5,
  },
  workoutMetaText: {
    fontSize: 13,
  },
  workoutExtraInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  workoutTagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 153, 255, 0.1)', // Light blue that works in both themes
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  workoutTagText: {
    fontSize: 11,
    marginLeft: 5,
    fontWeight: '500',
  },
  emptyWorkoutsContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  startWorkoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
    width: '80%',
  },
  startWorkoutGradient: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWorkoutText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  activityIndicator: {
    marginRight: 8,
  },
  todaysWorkoutContainer: {
    marginBottom: 24,
  },
  todaysWorkoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  todaysWorkoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  todaysWorkoutIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  todaysWorkoutInfo: {
    flex: 1,
  },
  todaysWorkoutTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  todaysWorkoutSubtitle: {
    fontSize: 14,
  },
  scheduleLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 8,
  },
  scheduleLinkText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  startButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthProgressContainer: {
    marginBottom: 24,
  },
  monthlyGainsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  monthlyGainsIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  monthlyGainsContent: {
    flex: 1,
  },
  monthlyGainsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  monthlyGainsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  strengthProgressList: {
    gap: 12,
  },
  strengthProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  strengthProgressContent: {
    flex: 1,
  },
  strengthProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  strengthProgressName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  improvementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  improvementText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  strengthProgressMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  strengthProgressMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  strengthProgressMetaText: {
    fontSize: 13,
  },
  lastWorkoutDate: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
