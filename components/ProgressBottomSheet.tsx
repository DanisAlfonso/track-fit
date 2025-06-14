import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  useColorScheme
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDatabase } from '@/utils/database';
import { format, startOfWeek, endOfWeek, subDays, addDays, isWithinInterval } from 'date-fns';

const { height, width } = Dimensions.get('window');

type ProgressType = 'totalWorkouts' | 'totalTime' | 'thisWeek' | 'streak';

interface ProgressBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  type: ProgressType;
  value: string | number;
}

interface WorkoutDetail {
  id: number;
  name: string;
  date: number;
  duration: number;
  exercise_count: number;
}

interface StreakDetail {
  date: string;
  workouts: number;
  isToday: boolean;
}

export const ProgressBottomSheet: React.FC<ProgressBottomSheetProps> = ({
  visible,
  onClose,
  type,
  value
}) => {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const insets = useSafeAreaInsets();
  
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(height)).current;
  const [loading, setLoading] = useState(true);
  const [workoutDetails, setWorkoutDetails] = useState<WorkoutDetail[]>([]);
  const [streakDetails, setStreakDetails] = useState<StreakDetail[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [averageDuration, setAverageDuration] = useState(0);
  const [longestWorkout, setLongestWorkout] = useState<WorkoutDetail | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  useEffect(() => {
    if (visible) {
      loadData();
      // Show animation with spring for smooth entrance
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const loadData = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      
      switch (type) {
        case 'totalWorkouts':
          await loadTotalWorkoutsData(db);
          break;
        case 'totalTime':
          await loadTotalTimeData(db);
          break;
        case 'thisWeek':
          await loadThisWeekData(db);
          break;
        case 'streak':
          await loadStreakData(db);
          break;
      }
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTotalWorkoutsData = async (db: any) => {
    const workouts = await db.getAllAsync(`
      SELECT 
        w.id,
        COALESCE(r.name, w.name) as name,
        w.completed_at as date,
        w.duration,
        COUNT(we.id) as exercise_count
      FROM workouts w
      LEFT JOIN routines r ON w.routine_id = r.id
      LEFT JOIN workout_exercises we ON w.id = we.workout_id
      WHERE w.completed_at IS NOT NULL
      GROUP BY w.id
      ORDER BY w.completed_at DESC
      LIMIT 20
    `) as WorkoutDetail[];
    setWorkoutDetails(workouts);
  };

  const loadTotalTimeData = async (db: any) => {
    const workouts = await db.getAllAsync(`
      SELECT 
        w.id,
        COALESCE(r.name, w.name) as name,
        w.completed_at as date,
        w.duration,
        COUNT(we.id) as exercise_count
      FROM workouts w
      LEFT JOIN routines r ON w.routine_id = r.id
      LEFT JOIN workout_exercises we ON w.id = we.workout_id
      WHERE w.completed_at IS NOT NULL AND w.duration > 0
      GROUP BY w.id
      ORDER BY w.duration DESC
      LIMIT 10
    `) as WorkoutDetail[];
    
    const totalTime = workouts.reduce((sum: any, workout: { duration: any; }) => sum + workout.duration, 0);
    const avgTime = workouts.length > 0 ? totalTime / workouts.length : 0;
    const longest = workouts.length > 0 ? workouts[0] : null;
    
    setWorkoutDetails(workouts);
    setTotalDuration(totalTime);
    setAverageDuration(avgTime);
    setLongestWorkout(longest);
  };

  const loadThisWeekData = async (db: any) => {
    // Calculate start of week with Monday as first day
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Calculate days to subtract to get to Monday
    // If today is Sunday (0), go back 6 days to get to Monday
    // If today is Monday (1), go back 0 days
    // If today is Tuesday (2), go back 1 day, etc.
    const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysToSubtract);
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Calculate last week start for comparison
    const lastWeekStart = new Date(startOfWeek);
    lastWeekStart.setDate(startOfWeek.getDate() - 7);
    
    // Query workouts for this week (Monday to Sunday)
    const workouts = await db.getAllAsync(`
      SELECT 
        w.id,
        COALESCE(r.name, w.name) as name,
        w.completed_at as date,
        w.duration,
        COUNT(we.id) as exercise_count
      FROM workouts w
      LEFT JOIN routines r ON w.routine_id = r.id
      LEFT JOIN workout_exercises we ON w.id = we.workout_id
      WHERE w.completed_at IS NOT NULL 
        AND w.date >= ?
      GROUP BY w.id
      ORDER BY w.completed_at DESC
    `, [startOfWeek.getTime()]) as WorkoutDetail[];
    
    setWorkoutDetails(workouts);
  };

  const loadStreakData = async (db: any) => {
    const workouts = await db.getAllAsync(`
      SELECT DISTINCT date(completed_at / 1000, 'unixepoch') as date_str, completed_at as date
      FROM workouts 
      WHERE completed_at IS NOT NULL
      ORDER BY date DESC
    `) as { date: number }[];
    
    // Calculate current and longest streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 29);
    
    // Find the start of the week for the oldest date (Monday = 1)
    const startOfCalendar = startOfWeek(thirtyDaysAgo, { weekStartsOn: 1 });
    
    // Find the end of the week for today
    const endOfCalendar = endOfWeek(today, { weekStartsOn: 1 });
    
    const streakData: StreakDetail[] = [];
    
    // Create calendar grid from start of week to end of week
    let currentDate = startOfCalendar;
    while (currentDate <= endOfCalendar) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const isInRange = currentDate >= thirtyDaysAgo && currentDate <= today;
      
      if (isInRange) {
        const workoutCount = workouts.filter((w: { date: string | number | Date; }) => {
          const workoutDate = format(new Date(w.date), 'yyyy-MM-dd');
          return workoutDate === dateStr;
        }).length;
        
        streakData.push({
          date: dateStr,
          workouts: workoutCount,
          isToday: format(currentDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
        });
        
        // Calculate streak for consecutive days from today backwards
        const daysFromToday = Math.floor((today.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
        if (workoutCount > 0) {
          if (daysFromToday === currentStreak) {
            currentStreak++;
          }
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else if (daysFromToday <= currentStreak) {
          tempStreak = 0;
        }
      } else {
        // Add empty cell for proper calendar alignment
        streakData.push({
          date: '',
          workouts: 0,
          isToday: false
        });
      }
      
      currentDate = addDays(currentDate, 1);
    }
    
    setStreakDetails(streakData);
    setCurrentStreak(currentStreak);
    setLongestStreak(longestStreak);
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
      return format(date, 'EEEE, MMM d, yyyy');
    }
  };

  const getTitle = (): string => {
    switch (type) {
      case 'totalWorkouts':
        return 'Total Workouts';
      case 'totalTime':
        return 'Total Time';
      case 'thisWeek':
        return 'This Week';
      case 'streak':
        return 'Day Streak';
      default:
        return 'Progress';
    }
  };

  const getIcon = (): string => {
    switch (type) {
      case 'totalWorkouts':
        return 'calendar-check';
      case 'totalTime':
        return 'clock';
      case 'thisWeek':
        return 'calendar-week';
      case 'streak':
        return 'fire';
      default:
        return 'chart-line';
    }
  };

  const getGradientColors = (): [string, string] => {
    switch (type) {
      case 'totalWorkouts':
        return ['#4361EE', '#3A0CA3'];
      case 'totalTime':
        return ['#4CC9F0', '#4895EF'];
      case 'thisWeek':
        return ['#F72585', '#B5179E'];
      case 'streak':
        return ['#F15BB5', '#FF5E5B'];
      default:
        return ['#6366F1', '#4F46E5'];
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading details...</Text>
        </View>
      );
    }

    switch (type) {
      case 'totalWorkouts':
        return (
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>Workout History</Text>
              <Text style={[styles.summarySubtitle, { color: colors.subtext }]}>Your recent workouts</Text>
            </View>
            
            {workoutDetails.map((workout, index) => (
              <View key={workout.id} style={[styles.workoutItem, { backgroundColor: colors.card }]}>
                <View style={styles.workoutInfo}>
                  <Text style={[styles.workoutName, { color: colors.text }]}>{workout.name}</Text>
                  <Text style={[styles.workoutDate, { color: colors.subtext }]}>{formatDate(workout.date)}</Text>
                </View>
                <View style={styles.workoutStats}>
                  <Text style={[styles.workoutDuration, { color: colors.primary }]}>{formatDuration(workout.duration)}</Text>
                  <Text style={[styles.workoutExercises, { color: colors.subtext }]}>{workout.exercise_count} exercises</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        );

      case 'totalTime':
        return (
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>Time Statistics</Text>
              <View style={styles.timeStats}>
                <View style={styles.timeStat}>
                  <Text style={[styles.timeStatValue, { color: colors.primary }]}>{formatDuration(averageDuration)}</Text>
                  <Text style={[styles.timeStatLabel, { color: colors.subtext }]}>Average Duration</Text>
                </View>
                {longestWorkout && (
                  <View style={styles.timeStat}>
                    <Text style={[styles.timeStatValue, { color: colors.primary }]}>{formatDuration(longestWorkout.duration)}</Text>
                    <Text style={[styles.timeStatLabel, { color: colors.subtext }]}>Longest Workout</Text>
                  </View>
                )}
              </View>
            </View>
            
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Longest Workouts</Text>
            {workoutDetails.map((workout, index) => (
              <View key={workout.id} style={[styles.workoutItem, { backgroundColor: colors.card }]}>
                <View style={styles.workoutInfo}>
                  <Text style={[styles.workoutName, { color: colors.text }]}>{workout.name}</Text>
                  <Text style={[styles.workoutDate, { color: colors.subtext }]}>{formatDate(workout.date)}</Text>
                </View>
                <View style={styles.workoutStats}>
                  <Text style={[styles.workoutDuration, { color: colors.primary }]}>{formatDuration(workout.duration)}</Text>
                  <Text style={[styles.workoutExercises, { color: colors.subtext }]}>{workout.exercise_count} exercises</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        );

      case 'thisWeek':
        return (
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>This Week's Progress</Text>
              <Text style={[styles.summarySubtitle, { color: colors.subtext }]}>Workouts completed this week</Text>
            </View>
            
            {workoutDetails.length > 0 ? (
              workoutDetails.map((workout, index) => (
                <View key={workout.id} style={[styles.workoutItem, { backgroundColor: colors.card }]}>
                  <View style={styles.workoutInfo}>
                    <Text style={[styles.workoutName, { color: colors.text }]}>{workout.name}</Text>
                    <Text style={[styles.workoutDate, { color: colors.subtext }]}>{formatDate(workout.date)}</Text>
                  </View>
                  <View style={styles.workoutStats}>
                    <Text style={[styles.workoutDuration, { color: colors.primary }]}>{formatDuration(workout.duration)}</Text>
                    <Text style={[styles.workoutExercises, { color: colors.subtext }]}>{workout.exercise_count} exercises</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <FontAwesome5 name="calendar-times" size={48} color={colors.subtext} style={styles.emptyIcon} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No workouts this week</Text>
                <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>Start your first workout to see progress here</Text>
              </View>
            )}
          </ScrollView>
        );

      case 'streak':
        return (
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>Streak Statistics</Text>
              <View style={styles.streakStats}>
                <View style={styles.streakStat}>
                  <Text style={[styles.streakStatValue, { color: colors.primary }]}>{currentStreak}</Text>
                  <Text style={[styles.streakStatLabel, { color: colors.subtext }]}>Current Streak</Text>
                </View>
                <View style={styles.streakStat}>
                  <Text style={[styles.streakStatValue, { color: colors.primary }]}>{longestStreak}</Text>
                  <Text style={[styles.streakStatLabel, { color: colors.subtext }]}>Longest Streak</Text>
                </View>
              </View>
            </View>
            
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Last 30 Days</Text>
            
            {/* Day labels */}
            <View style={styles.dayLabelsRow}>
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLabel, index) => (
                <View key={index} style={styles.dayLabel}>
                  <Text style={[styles.dayLabelText, { color: colors.subtext }]}>{dayLabel}</Text>
                </View>
              ))}
            </View>
            
            <View style={styles.streakGrid}>
              {streakDetails.map((day, index) => {
                // Handle empty cells for calendar alignment
                if (!day.date) {
                  return (
                    <View key={`empty-${index}`} style={[
                      styles.streakDay,
                      { backgroundColor: 'transparent' }
                    ]} />
                  );
                }
                
                return (
                  <View key={day.date} style={[
                    styles.streakDay,
                    { 
                      backgroundColor: day.workouts > 0 ? colors.primary : colors.border,
                      opacity: day.workouts > 0 ? 1 : 0.3
                    }
                  ]}>
                    <Text style={[
                      styles.streakDayText,
                      { color: day.workouts > 0 ? 'white' : colors.subtext }
                    ]}>
                      {format(new Date(day.date), 'd')}
                    </Text>
                    {day.isToday && (
                      <View style={styles.todayIndicator} />
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        );

      default:
        return null;
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop with blur */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity }
            ]}
          >
            <BlurView 
              intensity={currentTheme === 'dark' ? 30 : 25}
              tint={currentTheme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </TouchableWithoutFeedback>
        
        {/* Bottom sheet */}
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.background,
              borderColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              transform: [{ translateY: sheetTranslateY }],
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <LinearGradient
            colors={getGradientColors()}
            style={styles.headerIcon}
          >
            <FontAwesome5 name={getIcon()} size={20} color="white" />
          </LinearGradient>
          
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{getTitle()}</Text>
            <Text style={[styles.headerValue, { color: colors.primary }]}>{value}</Text>
          </View>
          
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <FontAwesome5 name="times" size={20} color={colors.subtext} />
          </TouchableOpacity>
        </View>

          {/* Content */}
          {renderContent()}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    height: height * 0.75,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  contentScroll: {
    flex: 1,
    padding: 20,
  },
  summaryCard: {
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  timeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  timeStat: {
    alignItems: 'center',
  },
  timeStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timeStatLabel: {
    fontSize: 12,
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  streakStat: {
    alignItems: 'center',
  },
  streakStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streakStatLabel: {
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  workoutDate: {
    fontSize: 14,
  },
  workoutStats: {
    alignItems: 'flex-end',
  },
  workoutDuration: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  workoutExercises: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  dayLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayLabel: {
    width: (width - 80) / 7,
    alignItems: 'center',
  },
  dayLabelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  streakGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  streakDay: {
    width: (width - 80) / 7,
    height: (width - 80) / 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  streakDayText: {
    fontSize: 12,
    fontWeight: '500',
  },
  todayIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'white',
  },
});