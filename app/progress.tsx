import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions, 
  Image
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { getDatabase } from '@/utils/database';
import { formatDate, formatRelativeDate, calculateDuration } from '@/utils/dateUtils';

// Types for our data
interface PersonalRecord {
  name: string;
  value: number;
  unit: string;
  date: string;
  icon: string;
}

interface Milestone {
  id: number;
  title: string;
  description: string;
  date: string | null;
  achieved: boolean;
  icon: string;
}

interface WorkoutStreak {
  current: number;
  longest: number;
  lastWorkout: string | null;
}

interface ProgressItem {
  date: string;
  title: string;
  description: string;
  icon: string;
  value?: number | string;
  unit?: string;
}

export default function ProgressScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [streak, setStreak] = useState<WorkoutStreak>({ current: 0, longest: 0, lastWorkout: null });
  const [progressTimeline, setProgressTimeline] = useState<ProgressItem[]>([]);
  
  // Fetch all the user progress data
  useEffect(() => {
    const loadProgressData = async () => {
      try {
        setLoading(true);
        const db = await getDatabase();
        
        // Load personal records
        await loadPersonalRecords(db);
        
        // Load milestones
        await loadMilestones(db);
        
        // Load workout streak
        await loadWorkoutStreak(db);
        
        // Load progress timeline
        await loadProgressTimeline(db);
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading progress data:', error);
        setLoading(false);
      }
    };
    
    loadProgressData();
  }, []);
  
  // Load personal records from database
  const loadPersonalRecords = async (db: any) => {
    try {
      // Query the database for the user's personal records
      // In a real implementation, this would fetch the highest weight/reps for each exercise
      const records = await db.getAllAsync(`
        SELECT 
          e.name,
          e.id as exercise_id,
          MAX(s.weight) as max_weight,
          MAX(s.reps) as max_reps,
          w.date
        FROM
          sets s
          JOIN workout_exercises we ON s.workout_exercise_id = we.id
          JOIN exercises e ON we.exercise_id = e.id
          JOIN workouts w ON we.workout_id = w.id
        WHERE
          w.completed_at IS NOT NULL
        GROUP BY
          e.id
        ORDER BY
          max_weight DESC
        LIMIT 10
      `);

      // Transform the data into PersonalRecord objects
      const personalRecords: PersonalRecord[] = records.map((record: any) => {
        // Determine which value to use as the record (weight or reps)
        const isWeightExercise = record.max_weight > 0;
        return {
          name: record.name,
          value: isWeightExercise ? record.max_weight : record.max_reps,
          unit: isWeightExercise ? 'kg' : 'reps',
          date: record.date,
          icon: getExerciseIcon(record.name) // Use exercise name instead of muscle group
        };
      });
      
      setPersonalRecords(personalRecords);
    } catch (error) {
      console.error('Error loading personal records:', error);
      setPersonalRecords([]);
    }
  };
  
  // Get appropriate icon based on exercise name
  const getExerciseIcon = (exerciseName: string): string => {
    const lowerCaseName = exerciseName.toLowerCase();
    
    // Chest exercises
    if (lowerCaseName.includes('bench') || lowerCaseName.includes('chest') || lowerCaseName.includes('push up') || lowerCaseName.includes('pushup') || lowerCaseName.includes('fly')) {
      return 'dumbbell';
    }
    
    // Leg exercises
    if (lowerCaseName.includes('squat') || lowerCaseName.includes('leg') || lowerCaseName.includes('calf') || lowerCaseName.includes('lunge') || lowerCaseName.includes('deadlift')) {
      return 'running';
    }
    
    // Back exercises
    if (lowerCaseName.includes('row') || lowerCaseName.includes('pull') || lowerCaseName.includes('lat') || lowerCaseName.includes('back')) {
      return 'arrow-up';
    }
    
    // Shoulder exercises
    if (lowerCaseName.includes('shoulder') || lowerCaseName.includes('press') || lowerCaseName.includes('delt') || lowerCaseName.includes('raise')) {
      return 'weight';
    }
    
    // Arm exercises
    if (lowerCaseName.includes('curl') || lowerCaseName.includes('extension') || lowerCaseName.includes('tricep') || lowerCaseName.includes('bicep')) {
      return 'hand-rock';
    }
    
    // Core exercises
    if (lowerCaseName.includes('ab') || lowerCaseName.includes('crunch') || lowerCaseName.includes('plank') || lowerCaseName.includes('core') || lowerCaseName.includes('twist')) {
      return 'burn';
    }
    
    // Default icon for other exercises
    return 'dumbbell';
  };
  
  // Load milestones from database
  const loadMilestones = async (db: any) => {
    try {
      // Calculate basic milestones based on user activity
      const milestoneData = [];
      
      // Get total workout count
      const workoutCount = await db.getFirstAsync(`
        SELECT COUNT(*) as count 
        FROM workouts 
        WHERE completed_at IS NOT NULL
      `);
      
      const totalWorkouts = workoutCount?.count || 0;
      
      // First workout milestone
      if (totalWorkouts > 0) {
        const firstWorkout = await db.getFirstAsync(`
          SELECT date 
          FROM workouts 
          WHERE completed_at IS NOT NULL 
          ORDER BY date ASC 
          LIMIT 1
        `);
        
        milestoneData.push({
          id: 1,
          title: 'First Workout',
          description: 'Completed your first workout',
          date: firstWorkout?.date,
          achieved: true,
          icon: 'flag'
        });
      }
      
      // Workout count milestones
      const workoutMilestones = [
        { id: 2, count: 5, title: '5 Workouts' },
        { id: 3, count: 10, title: '10 Workouts' },
        { id: 4, count: 25, title: '25 Workouts' },
        { id: 5, count: 50, title: '50 Workouts' },
        { id: 6, count: 100, title: '100 Workouts' }
      ];
      
      workoutMilestones.forEach(milestone => {
        if (totalWorkouts >= milestone.count) {
          // Find the date this milestone was achieved
          milestoneData.push({
            id: milestone.id,
            title: milestone.title,
            description: `Completed ${milestone.count} workouts`,
            date: new Date().toISOString(), // This would ideally be the actual date
            achieved: true,
            icon: 'medal'
          });
        } else {
          milestoneData.push({
            id: milestone.id,
            title: milestone.title,
            description: `Complete ${milestone.count} workouts`,
            date: null,
            achieved: false,
            icon: 'medal'
          });
        }
      });
      
      // Check for streak milestone
      if (streak.longest >= 5) {
        milestoneData.push({
          id: 7,
          title: '5-Day Streak',
          description: 'Worked out for 5 days in a row',
          date: new Date().toISOString(), // This would ideally be the actual date
          achieved: true,
          icon: 'fire'
        });
      } else {
        milestoneData.push({
          id: 7,
          title: '5-Day Streak',
          description: 'Work out for 5 days in a row',
          date: null,
          achieved: false,
          icon: 'fire'
        });
      }
      
      setMilestones(milestoneData);
    } catch (error) {
      console.error('Error loading milestones:', error);
      setMilestones([]);
    }
  };
  
  // Load workout streak from database
  const loadWorkoutStreak = async (db: any) => {
    try {
      // Get current streak
      const currentStreakResult = await db.getFirstAsync(`
        WITH workout_dates AS (
          SELECT date(completed_at) as workout_date
          FROM workouts
          WHERE completed_at IS NOT NULL
          ORDER BY workout_date DESC
        ),
        streak_groups AS (
          SELECT 
            workout_date,
            julianday(workout_date) - julianday(
              (SELECT min(workout_date) FROM workout_dates)
            ) - ROW_NUMBER() OVER (ORDER BY workout_date) as group_num
          FROM workout_dates
        )
        SELECT COUNT(*) as streak
        FROM streak_groups
        WHERE group_num = (
          SELECT group_num 
          FROM streak_groups 
          WHERE workout_date = (SELECT max(workout_date) FROM workout_dates)
        )
      `);
      
      // Get longest streak
      const longestStreakResult = await db.getFirstAsync(`
        WITH workout_dates AS (
          SELECT date(completed_at) as workout_date
          FROM workouts
          WHERE completed_at IS NOT NULL
          ORDER BY workout_date DESC
        ),
        streak_groups AS (
          SELECT 
            workout_date,
            julianday(workout_date) - julianday(
              (SELECT min(workout_date) FROM workout_dates)
            ) - ROW_NUMBER() OVER (ORDER BY workout_date) as group_num
          FROM workout_dates
        )
        SELECT COUNT(*) as streak
        FROM streak_groups
        GROUP BY group_num
        ORDER BY streak DESC
        LIMIT 1
      `);
      
      // Get last workout date
      const lastWorkoutResult = await db.getFirstAsync(`
        SELECT completed_at 
        FROM workouts 
        WHERE completed_at IS NOT NULL 
        ORDER BY completed_at DESC 
        LIMIT 1
      `);
      
      setStreak({
        current: currentStreakResult?.streak || 0,
        longest: longestStreakResult?.streak || 0,
        lastWorkout: lastWorkoutResult?.completed_at || null
      });
      
    } catch (error) {
      console.error('Error calculating streak:', error);
      setStreak({ current: 0, longest: 0, lastWorkout: null });
    }
  };
  
  // Load progress timeline from database
  const loadProgressTimeline = async (db: any) => {
    try {
      // Get completed workouts
      const workouts = await db.getAllAsync(`
        SELECT 
          w.id, 
          w.date, 
          w.completed_at, 
          r.name as routine_name
        FROM 
          workouts w
          LEFT JOIN routines r ON w.routine_id = r.id
        WHERE 
          w.completed_at IS NOT NULL
        ORDER BY 
          w.date DESC
        LIMIT 20
      `);
      
      // Get personal records with dates, filtering out 0 values
      const personalRecords = await db.getAllAsync(`
        WITH MaxWeights AS (
          SELECT 
            e.id AS exercise_id,
            e.name AS exercise_name,
            MAX(s.weight) AS max_weight,
            MAX(s.reps) AS max_reps
          FROM 
            sets s
            JOIN workout_exercises we ON s.workout_exercise_id = we.id
            JOIN exercises e ON we.exercise_id = e.id
          WHERE 
            (s.weight > 0 OR s.reps > 0)
          GROUP BY 
            e.id
        )
        SELECT 
          e.name AS exercise_name,
          s.weight,
          s.reps,
          w.date,
          mw.max_weight,
          mw.max_reps
        FROM 
          sets s
          JOIN workout_exercises we ON s.workout_exercise_id = we.id
          JOIN exercises e ON we.exercise_id = e.id
          JOIN workouts w ON we.workout_id = w.id
          JOIN MaxWeights mw ON e.id = mw.exercise_id
        WHERE 
          ((s.weight = mw.max_weight AND mw.max_weight > 0)
          OR (s.reps = mw.max_reps AND mw.max_reps > 0))
          AND (s.weight > 0 OR s.reps > 0)
        ORDER BY 
          w.date DESC
      `);
      
      // Combine workouts and personal records into timeline
      const timeline: ProgressItem[] = [];
      
      // Add workouts to timeline with null checks
      workouts.forEach((workout: any) => {
        if (workout && workout.date) {
          timeline.push({
            date: workout.date,
            title: 'Workout Completed',
            description: workout.routine_name || 'Custom Workout',
            icon: 'dumbbell'
          });
        }
      });
      
      // Add personal records to timeline with null checks
      personalRecords.forEach((record: any) => {
        if (record && record.date) {
          // Only add records with non-zero values
          const isWeightExercise = record.max_weight > 0;
          const value = isWeightExercise ? record.weight : record.reps;
          
          // Skip records with 0 values
          if (value > 0) {
            timeline.push({
              date: record.date,
              title: 'New Personal Record',
              description: `${record.exercise_name || 'Exercise'}`,
              icon: 'trophy',
              value: value,
              unit: isWeightExercise ? 'kg' : 'reps'
            });
          }
        }
      });
      
      // Sort timeline by date (newest first)
      timeline.sort((a, b) => {
        // Handle potential date parsing issues
        try {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        } catch (err) {
          console.error('Error sorting timeline dates:', err);
          return 0;
        }
      });
      
      setProgressTimeline(timeline);
    } catch (error) {
      console.error('Error loading progress timeline:', error);
      setProgressTimeline([]);
    }
  };
  
  // Render a personal record card
  const renderPersonalRecord = (record: PersonalRecord) => (
    <View key={record.name} style={[styles.recordCard, { backgroundColor: colors.card }]}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.recordIconContainer}
      >
        <FontAwesome5 name={record.icon} size={24} color="white" />
      </LinearGradient>
      <View style={styles.recordInfo}>
        <Text style={[styles.recordName, { color: colors.text }]}>{record.name}</Text>
        <Text style={[styles.recordValue, { color: colors.text }]}>
          {record.value} {record.unit}
        </Text>
        <Text style={[styles.recordDate, { color: colors.subtext }]}>
          {formatRelativeDate(record.date)}
        </Text>
      </View>
    </View>
  );
  
  // Render milestone item
  const renderMilestone = (milestone: Milestone) => (
    <TouchableOpacity 
      key={milestone.id} 
      style={[
        styles.milestoneItem, 
        { 
          backgroundColor: milestone.achieved ? colors.primaryLight : colors.card,
          borderColor: milestone.achieved ? colors.primary : colors.border
        }
      ]}
      activeOpacity={0.8}
    >
      <View style={[
        styles.milestoneIconContainer, 
        { backgroundColor: milestone.achieved ? colors.primary : colors.border }
      ]}>
        <FontAwesome5 name={milestone.icon} size={18} color="white" />
      </View>
      <View style={styles.milestoneContent}>
        <Text style={[styles.milestoneTitle, { color: colors.text }]}>{milestone.title}</Text>
        <Text style={[styles.milestoneDescription, { color: colors.subtext }]}>
          {milestone.description}
        </Text>
        {milestone.date && (
          <Text style={[styles.milestoneDate, { color: colors.primary }]}>
            {formatRelativeDate(milestone.date)}
          </Text>
        )}
      </View>
      <View style={styles.milestoneStatus}>
        {milestone.achieved ? (
          <FontAwesome5 name="check-circle" size={20} color={colors.primary} />
        ) : (
          <FontAwesome5 name="circle" size={20} color={colors.border} />
        )}
      </View>
    </TouchableOpacity>
  );
  
  // Render progress timeline item
  const renderTimelineItem = (item: ProgressItem, index: number) => {
    // Ensure we have valid data for rendering
    if (!item || !item.date) {
      return null;
    }
    
    return (
      <View key={`${item.date}-${index}`} style={styles.timelineItem}>
        <View style={styles.timelineLeft}>
          <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
          <View style={[styles.timelineDot, { backgroundColor: colors.primary }]}>
            <FontAwesome5 name={item.icon || 'circle'} size={14} color="white" />
          </View>
        </View>
        <View style={[styles.timelineContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.timelineDate, { color: colors.subtext }]}>
            {formatRelativeDate(item.date)}
          </Text>
          <Text style={[styles.timelineTitle, { color: colors.text }]}>
            {item.title || 'Event'}
          </Text>
          <Text style={[styles.timelineDescription, { color: colors.subtext }]}>
            {item.description || ''}
          </Text>
          {item.value !== undefined && item.value !== null && (
            <View style={styles.timelineValueContainer}>
              <Text style={[styles.timelineValue, { color: colors.primary }]}>
                {item.value} {item.unit || ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Improved empty state components
  const EmptyStateCard = ({ icon, title, message, actionLabel, action }: { 
    icon: string, 
    title: string, 
    message: string, 
    actionLabel?: string, 
    action?: () => void 
  }) => (
    <View style={[styles.emptyStateCard, { backgroundColor: colors.card }]}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.emptyStateIconContainer}
      >
        <FontAwesome5 name={icon} size={32} color="white" />
      </LinearGradient>
      <Text style={[styles.emptyStateTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyStateMessage, { color: colors.subtext }]}>
        {message}
      </Text>
      {actionLabel && action && (
        <TouchableOpacity 
          style={[styles.emptyStateButton, { backgroundColor: colors.primary }]}
          onPress={action}
        >
          <Text style={styles.emptyStateButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Empty state for Personal Records section
  const PersonalRecordsEmptyState = () => (
    <EmptyStateCard
      icon="trophy"
      title="No Personal Records Yet"
      message="Complete workouts to track your personal bests for each exercise."
      actionLabel="Start a Workout"
      action={() => router.push({pathname: '/'})}
    />
  );

  // Empty state for Milestones section
  const MilestonesEmptyState = () => (
    <EmptyStateCard
      icon="medal"
      title="Achievements Waiting"
      message="Complete your fitness goals to unlock achievements and milestones."
      actionLabel="Explore Workouts"
      action={() => router.push({pathname: '/'})}
    />
  );

  // Empty state for Timeline section
  const TimelineEmptyState = () => (
    <EmptyStateCard
      icon="history"
      title="Your Journey Begins"
      message="As you work out, your fitness journey will be recorded here."
      actionLabel="Get Started"
      action={() => router.push({pathname: '/'})}
    />
  );

  // Empty state for when no data exists at all
  const NoDataEmptyState = () => (
    <View style={styles.noDataContainer}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.noDataIconCircle}
      >
        <FontAwesome5 name="dumbbell" size={64} color="white" />
      </LinearGradient>
      
      <Text style={[styles.noDataTitle, { color: colors.text }]}>
        Begin Your Fitness Journey
      </Text>
      
      <Text style={[styles.noDataMessage, { color: colors.subtext }]}>
        Track your workouts, set personal records, and achieve your fitness goals.
      </Text>
      
      <TouchableOpacity
        style={[styles.noDataButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push({pathname: '/'})}
      >
        <Text style={styles.noDataButtonText}>Start Your First Workout</Text>
        <FontAwesome5 name="arrow-right" size={16} color="white" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );

  // Check if any data exists
  const hasAnyData = personalRecords.length > 0 || streak.current > 0 || progressTimeline.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          title: 'Your Progress',
          headerStyle: {
            backgroundColor: 'transparent',
          },
          headerTransparent: true,
          headerTintColor: 'white',
          headerBackVisible: true,
        }}
      />
      
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Your Fitness Journey</Text>
          <Text style={styles.headerSubtitle}>Track achievements and milestones</Text>
        </View>
      </LinearGradient>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>
            Loading your progress data...
          </Text>
        </View>
      ) : !hasAnyData ? (
        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.contentContainer, styles.noDataContentContainer]}
        >
          <NoDataEmptyState />
        </ScrollView>
      ) : (
        <ScrollView 
          style={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.contentContainer}
        >
          {/* Streak Section */}
          <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
            <View style={styles.streakHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Workout Streak
              </Text>
              <FontAwesome5 name="fire" size={20} color={colors.accent} />
            </View>
            
            <View style={styles.streakStats}>
              <View style={styles.streakStat}>
                <Text style={[styles.streakValue, { color: colors.text }]}>{streak.current}</Text>
                <Text style={[styles.streakLabel, { color: colors.subtext }]}>Current Streak</Text>
              </View>
              
              <View style={[styles.streakDivider, { backgroundColor: colors.border }]} />
              
              <View style={styles.streakStat}>
                <Text style={[styles.streakValue, { color: colors.text }]}>{streak.longest}</Text>
                <Text style={[styles.streakLabel, { color: colors.subtext }]}>Best Streak</Text>
              </View>
            </View>
            
            <Text style={[styles.lastWorkoutText, { color: colors.subtext }]}>
              {streak.lastWorkout 
                ? `Last workout: ${formatRelativeDate(streak.lastWorkout)}` 
                : 'No workouts recorded yet'}
            </Text>
          </View>
          
          {/* Personal Records Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Personal Records
            </Text>
            {personalRecords.length > 0 ? (
              <ScrollView 
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recordsContainer}
              >
                {personalRecords.map(renderPersonalRecord)}
              </ScrollView>
            ) : (
              <PersonalRecordsEmptyState />
            )}
          </View>
          
          {/* Milestones Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Achievements & Milestones
            </Text>
            {milestones.length > 0 ? (
              <View style={styles.milestonesContainer}>
                {milestones.map(renderMilestone)}
              </View>
            ) : (
              <MilestonesEmptyState />
            )}
          </View>
          
          {/* Progress Timeline Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Your Journey Timeline
            </Text>
            {progressTimeline.length > 0 ? (
              <View style={styles.timelineContainer}>
                {progressTimeline.map((item, index) => renderTimelineItem(item, index))}
              </View>
            ) : (
              <TimelineEmptyState />
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 40,
    paddingTop: 100,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 20,
  },
  headerContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  scrollContainer: {
    flex: 1,
    marginTop: -20,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  streakCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakStat: {
    alignItems: 'center',
    flex: 1,
  },
  streakValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 14,
  },
  streakDivider: {
    width: 1,
    height: 40,
  },
  lastWorkoutText: {
    textAlign: 'center',
    fontSize: 14,
    fontStyle: 'italic',
  },
  recordsContainer: {
    paddingBottom: 8,
    paddingRight: 16,
  },
  recordCard: {
    width: 140,
    borderRadius: 16,
    marginRight: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recordIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordInfo: {},
  recordName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  recordValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 12,
  },
  milestonesContainer: {
    marginBottom: 8,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  milestoneIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  milestoneContent: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  milestoneDescription: {
    fontSize: 14,
    marginBottom: 2,
  },
  milestoneDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  milestoneStatus: {
    paddingLeft: 8,
  },
  timelineContainer: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLeft: {
    width: 40,
    alignItems: 'center',
  },
  timelineLine: {
    position: 'absolute',
    width: 2,
    top: 0,
    bottom: 0,
    left: 20,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    zIndex: 2,
  },
  timelineContent: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  timelineDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  timelineDescription: {
    fontSize: 14,
  },
  timelineValueContainer: {
    marginTop: 8,
  },
  timelineValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyStateCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 8,
  },
  emptyStateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    lineHeight: 22,
  },
  emptyStateButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 8,
  },
  emptyStateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  noDataContentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  noDataIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  noDataTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  noDataMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  noDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noDataButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
}); 