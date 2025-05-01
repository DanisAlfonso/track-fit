import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Text, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
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

// User profile key from profile.tsx
const USER_NAME_KEY = 'user_name';

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
};

type WorkoutStats = {
  total_workouts: number;
  total_duration: number;
  this_week: number;
  last_workout_date: number | null;
  streak: number;
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

  useEffect(() => {
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
        SELECT w.id, w.date, r.name as routine_name, w.duration,
        (SELECT COUNT(DISTINCT we.exercise_id) FROM workout_exercises we WHERE we.workout_id = w.id) as exercise_count
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
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
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

      // Load user name from AsyncStorage
      try {
        const name = await AsyncStorage.getItem(USER_NAME_KEY);
        if (name) {
          setUserName(name);
        }
      } catch (error) {
        console.error('Error loading user name:', error);
        // Keep default name if there's an error
      }
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setLoading(false);
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

  const getWelcomeSubtitle = (): string => {
    // Check if there's a workout scheduled for today
    if (todaysRoutine) {
      return `${todaysRoutine.name} is on your schedule today`;
    }
    
    // Check if user has a streak going
    if (stats?.streak && stats.streak > 1) {
      return `${stats.streak} day streak! Keep it up!`;
    }
    
    // Time-based greeting if no other conditions are met
    const currentHour = new Date().getHours();
    if (currentHour < 12) {
      return "Let's start the day strong!";
    } else if (currentHour < 17) {
      return "Time for an afternoon boost?";
    } else {
      return "Evening workout to end the day?";
    }
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
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]} 
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
        <Text style={[styles.welcomeMessage, { color: colors.text }]}>{getGreeting()}</Text>
        <Text style={[styles.welcomeSubtitle, { color: colors.subtext }]}>{getWelcomeSubtitle()}</Text>
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
              colors={[colors.accent, colors.secondary]}
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
              colors={[colors.primary, colors.secondary]}
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
        <View style={styles.todaysWorkoutContainer}>
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
        </View>
      )}

      {/* Workout Stats */}
      <View style={styles.statsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Progress</Text>
        
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primaryLight }]}>
              <FontAwesome5 name="calendar-check" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats?.total_workouts || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Total Workouts</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primaryLight }]}>
              <FontAwesome5 name="clock" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats?.total_duration ? formatDuration(stats.total_duration) : '0m'}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Total Time</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primaryLight }]}>
              <FontAwesome5 name="calendar-week" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats?.this_week || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>This Week</Text>
          </View>
          
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primaryLight }]}>
              <FontAwesome5 name="fire" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats?.streak || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Day Streak</Text>
          </View>
        </View>
      </View>

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
              style={[styles.workoutCard, { backgroundColor: colors.card }]}
              onPress={() => navigateToWorkout(workout.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.workoutDateContainer, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.workoutDate, { color: colors.primary }]}>
                  {formatDate(workout.date)}
                </Text>
              </View>
              <View style={styles.workoutContent}>
                <Text style={[styles.workoutName, { color: colors.text }]}>{workout.routine_name}</Text>
                <View style={styles.workoutMeta}>
                  <View style={styles.workoutMetaItem}>
                    <FontAwesome5 name="dumbbell" size={12} color={colors.subtext} style={styles.metaIcon} />
                    <Text style={[styles.workoutMetaText, { color: colors.subtext }]}>
                      {workout.exercise_count} exercises
                    </Text>
                  </View>
                  <View style={styles.workoutMetaItem}>
                    <FontAwesome5 name="clock" size={12} color={colors.subtext} style={styles.metaIcon} />
                    <Text style={[styles.workoutMetaText, { color: colors.subtext }]}>
                      {formatDuration(workout.duration)}
                    </Text>
                  </View>
                </View>
              </View>
              <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
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
                colors={[colors.primary, colors.secondary]}
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

      {/* Suggested Workouts */}
      {routines.length > 0 && (
        <View style={styles.suggestedContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Suggested Workouts</Text>
          
          {routines.slice(0, 2).map((routine) => (
            <TouchableOpacity 
              key={routine.id}
              style={[styles.suggestedCard, { backgroundColor: colors.card }]}
              onPress={() => handleRoutinePress(routine)}
              activeOpacity={0.7}
            >
              <View style={styles.suggestedContent}>
                <Text style={[styles.suggestedName, { color: colors.text }]}>{routine.name}</Text>
                <Text style={[styles.suggestedCount, { color: colors.subtext }]}>
                  {routine.exerciseCount} exercise{routine.exerciseCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.startButtonContainer}>
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={styles.startButton}
                >
                  <FontAwesome5 name="play" size={14} color="white" />
                </LinearGradient>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginTop: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
    paddingHorizontal: 4,
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
    borderRadius: 12,
    overflow: 'hidden',
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
    borderRadius: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
  },
  recentWorkoutsContainer: {
    marginBottom: 24,
  },
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  workoutDateContainer: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
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
  },
  workoutMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaIcon: {
    marginRight: 4,
  },
  workoutMetaText: {
    fontSize: 13,
  },
  suggestedContainer: {
    marginBottom: 30,
  },
  suggestedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestedContent: {
    flex: 1,
  },
  suggestedName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  suggestedCount: {
    fontSize: 13,
  },
  startButtonContainer: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  startButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWorkoutsContainer: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
});
