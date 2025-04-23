import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { formatDate, calculateDuration } from '../../utils/dateUtils';
import { getDatabase } from '../../utils/database';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '@/context/ThemeContext';

// Types
interface Set {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  weight: number;
  reps: number;
  rest_time: number | null;
  notes: string | null;
}

interface ExerciseWithSets {
  id: number;
  exercise_id: number;
  workout_id: number;
  name: string;
  primary_muscle: string;
  sets: Set[];
  notes: string | null;
  expanded: boolean;
  previousData: {
    date: string;
    volume: number;
    maxWeight: number;
  }[];
}

interface PreviousWorkout {
  id: number;
  workout_id: number;
  exercise_id: number;
  sets: Set[];
  date: string;
}

interface WorkoutExercise {
  id: number;
  workout_id: number;
  exercise_id: number;
  notes: string | null;
}

interface Workout {
  id: number;
  routine_id: number;
  routine_name: string;
  date: string;
  completed_at: string | null;
  duration: number | null;
  notes: string | null;
}

// Define SQLite transaction type
type SQLTransaction = {
  executeSql: (
    sqlStatement: string,
    args?: (string | number)[],
    callback?: (transaction: SQLTransaction, resultSet: any) => void,
    errorCallback?: (transaction: SQLTransaction, error: Error) => boolean
  ) => void;
};

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams();
  const workoutId = params.id as string;
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  
  // State
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercisesWithSets, setExercisesWithSets] = useState<ExerciseWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);
  const [previousWorkouts, setPreviousWorkouts] = useState<PreviousWorkout[]>([]);
  const [comparisonStats, setComparisonStats] = useState<{
    volumeChange: number;
    timeChange: number;
    setCount: number;
  }>({
    volumeChange: 0,
    timeChange: 0,
    setCount: 0
  });

  // Load workout details
  useEffect(() => {
    let isMounted = true; // Track component mounted state

    const loadWorkoutDetails = async () => {
      try {
        setLoading(true);
        const db = await getDatabase();
        
        // Load workout info
        const workoutResult = await db.getAllAsync(
          `SELECT w.*, r.name as routine_name 
           FROM workouts w
           LEFT JOIN routines r ON w.routine_id = r.id
           WHERE w.id = ?`,
          [workoutId]
        );
        
        if (workoutResult.length === 0) {
          console.error('Workout not found');
          if (isMounted) setLoading(false);
          return;
        }

        const workoutData = workoutResult[0] as unknown as Workout;
        if (isMounted) setWorkout(workoutData);

        // Load exercises with sets
        await loadExercisesWithSets(workoutData.routine_id);
      } catch (error) {
        console.error('Error loading workout details:', error);
        if (isMounted) setLoading(false);
      }
    };

    const loadExercisesWithSets = async (routineId: number) => {
      if (!isMounted) return;
      
      try {
        const db = await getDatabase();
        
        // Get exercises for this workout
        const exercisesResult = await db.getAllAsync(
          `SELECT we.id, we.exercise_id, we.workout_id, we.notes, e.name, e.primary_muscle
           FROM workout_exercises we
           JOIN exercises e ON we.exercise_id = e.id
           WHERE we.workout_id = ?
           ORDER BY we.id`,
          [workoutId]
        );

        if (exercisesResult.length === 0) {
          if (isMounted) setLoading(false);
          return;
        }

        // Initialize exercises with empty sets
        const exercises = exercisesResult.map((ex: any) => ({
          ...ex,
          sets: [],
          expanded: true,
          previousData: []
        })) as ExerciseWithSets[];

        // Load sets for each exercise and calculate volumes
        let totalSets = 0;
        let calculatedVolume = 0;

        for (const exercise of exercises) {
          if (!isMounted) return;
          
          const setsResult = await db.getAllAsync(
            `SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY set_number`,
            [exercise.id]
          );
          
          const exerciseSets = setsResult as unknown as Set[];
          exercise.sets = exerciseSets;
          
          totalSets += exerciseSets.length;
          const exerciseVolume = exerciseSets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
          calculatedVolume += exerciseVolume;
        }

        if (!isMounted) return;
        
        if (isMounted) {
          // Filter out exercises with no sets
          const exercisesWithData = exercises.filter(exercise => exercise.sets.length > 0);
          setExercisesWithSets(exercisesWithData);
          setTotalVolume(calculatedVolume);
        }

        // Load previous workouts for comparison
        await loadPreviousWorkouts(routineId, exercises, totalSets);
      } catch (error) {
        console.error('Error loading exercises and sets:', error);
        if (isMounted) setLoading(false);
      }
    };

    const loadPreviousWorkouts = async (
      routineId: number,
      exercises: ExerciseWithSets[],
      totalSets: number
    ) => {
      if (!isMounted) return;
      
      try {
        const db = await getDatabase();
        
        // Define types for database results
        interface WorkoutResult {
          id: number;
          date: string;
          completed_at: string | null;
          duration: number | null;
          exercise_id: number;
          workout_exercise_id: number;
        }
        
        // Get previous workouts
        const previousWorkoutsResult = await db.getAllAsync<WorkoutResult>(
          `SELECT w.id, w.date, w.completed_at, w.duration, we.exercise_id, we.id as workout_exercise_id
           FROM workouts w
           JOIN workout_exercises we ON w.id = we.workout_id
           WHERE w.routine_id = ? AND w.id != ? AND w.completed_at IS NOT NULL
           ORDER BY w.date DESC
           LIMIT 10`,
          [routineId, workoutId]
        );

        if (previousWorkoutsResult.length === 0) {
          if (isMounted) processComparisonData(exercises, [], totalSets);
          return;
        }

        const prevWorkouts: PreviousWorkout[] = [];

        // Load sets for each previous workout exercise
        for (const row of previousWorkoutsResult) {
          if (!isMounted) return;
          
          const setsResult = await db.getAllAsync<Set>(
            `SELECT * FROM sets WHERE workout_exercise_id = ?`,
            [row.workout_exercise_id]
          );

          prevWorkouts.push({
            id: row.workout_exercise_id,
            workout_id: row.id,
            exercise_id: row.exercise_id,
            sets: setsResult,
            date: row.date
          });
        }

        if (isMounted) processComparisonData(exercises, prevWorkouts, totalSets);
      } catch (error) {
        console.error('Error loading previous workouts:', error);
        if (isMounted) processComparisonData(exercises, [], totalSets);
      }
    };

    const processComparisonData = async (
      exercises: ExerciseWithSets[],
      previousWorkoutsData: PreviousWorkout[],
      totalSets: number
    ) => {
      if (!isMounted) return;
      
      try {
        if (isMounted) setPreviousWorkouts(previousWorkoutsData);
        
        // Process data for each exercise
        const exercisesWithHistory = exercises.map(exercise => {
          // Get previous data for this exercise
          const previousData = previousWorkoutsData
            .filter(pw => pw.exercise_id === exercise.exercise_id)
            .map(pw => {
              const volume = pw.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
              const maxWeight = pw.sets.reduce((max, set) => Math.max(max, set.weight), 0);
              
              return {
                date: pw.date,
                volume,
                maxWeight
              };
            });
          
          return {
            ...exercise,
            previousData
          };
        });
        
        if (isMounted) {
          // Filter out exercises with no sets before updating state
          const exercisesWithDataAndHistory = exercisesWithHistory.filter(exercise => exercise.sets.length > 0);
          setExercisesWithSets(exercisesWithDataAndHistory);
        }
        
        // Calculate comparison stats with the most recent previous workout
        if (previousWorkoutsData.length > 0 && workout) {
          // Get unique workout IDs
          const uniqueWorkoutIds = Array.from(new Set(previousWorkoutsData.map(pw => pw.workout_id)));
          
          if (uniqueWorkoutIds.length > 0 && isMounted) {
            const db = await getDatabase();
            
            // Get most recent workout ID
            const mostRecentWorkoutId = uniqueWorkoutIds[0];
            
            // Calculate volume for current workout
            const currentVolume = totalVolume;
            
            // Calculate volume for previous workout
            const previousWorkoutExercises = previousWorkoutsData.filter(pw => pw.workout_id === mostRecentWorkoutId);
            const previousVolume = previousWorkoutExercises.reduce((sum, pw) => {
              return sum + pw.sets.reduce((setSum, set) => setSum + (set.weight * set.reps), 0);
            }, 0);
            
            // Calculate volume change percentage
            const volumeChange = previousVolume > 0 
              ? ((currentVolume - previousVolume) / previousVolume) * 100 
              : 0;
            
            // Get previous workout duration
            interface DurationResult {
              duration: number | null;
            }
            
            const durationResult = await db.getAllAsync<DurationResult>(
              `SELECT duration FROM workouts WHERE id = ?`,
              [mostRecentWorkoutId]
            );
            
            if (durationResult.length > 0 && isMounted) {
              const previousDuration = durationResult[0].duration || 0;
              const currentDuration = workout.duration || 0;
              
              // Calculate time change percentage
              const timeChange = previousDuration > 0 
                ? ((currentDuration - previousDuration) / previousDuration) * 100 
                : 0;
              
              if (isMounted) {
                setComparisonStats({
                  volumeChange,
                  timeChange,
                  setCount: totalSets
                });
              }
            }
          }
        }
        
        if (isMounted) setLoading(false);
      } catch (error) {
        console.error('Error processing comparison data:', error);
        if (isMounted) setLoading(false);
      }
    };

    loadWorkoutDetails();

    // Cleanup function to prevent state updates if component unmounts
    return () => {
      isMounted = false;
    };
  }, [workoutId]); // Remove workout from dependency array

  // Toggle exercise expansion
  const toggleExerciseExpansion = (exerciseId: number) => {
    setExercisesWithSets(exercises => 
      exercises.map(ex => 
        ex.id === exerciseId 
          ? {...ex, expanded: !ex.expanded} 
          : ex
      )
    );
  };

  // Calculate volume for a specific exercise
  const calculateExerciseVolume = (exercise: ExerciseWithSets): number => {
    return exercise.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
  };

  // Calculate max weight for an exercise
  const calculateMaxWeight = (exercise: ExerciseWithSets): number => {
    if (exercise.sets.length === 0) return 0;
    return Math.max(...exercise.sets.map(set => set.weight));
  };

  // Find previous exercise data for comparison
  const findPreviousExerciseData = (exerciseId: number): PreviousWorkout | undefined => {
    // Get unique workout IDs, sorted by most recent first
    const uniqueWorkoutIds = Array.from(new Set(
      previousWorkouts
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(pw => pw.workout_id)
    ));
    
    // If there are previous workouts
    if (uniqueWorkoutIds.length > 0) {
      // Get most recent workout ID
      const mostRecentWorkoutId = uniqueWorkoutIds[0];
      
      // Find the exercise from this workout
      return previousWorkouts.find(pw => 
        pw.workout_id === mostRecentWorkoutId && pw.exercise_id === exerciseId
      );
    }
    
    return undefined;
  };

  // Compare current exercise with previous
  const compareWithPrevious = (exercise: ExerciseWithSets): {
    volumeChange: number;
    maxWeightChange: number;
  } => {
    const currentVolume = calculateExerciseVolume(exercise);
    const currentMaxWeight = calculateMaxWeight(exercise);
    
    const previousExercise = findPreviousExerciseData(exercise.exercise_id);
    
    if (!previousExercise) {
      return { volumeChange: 0, maxWeightChange: 0 };
    }
    
    const previousVolume = previousExercise.sets.reduce(
      (sum, set) => sum + (set.weight * set.reps), 0
    );
    
    const previousMaxWeight = previousExercise.sets.length > 0 
      ? Math.max(...previousExercise.sets.map(set => set.weight))
      : 0;
    
    const volumeChange = previousVolume > 0 
      ? ((currentVolume - previousVolume) / previousVolume) * 100
      : 0;
    
    const maxWeightChange = previousMaxWeight > 0
      ? ((currentMaxWeight - previousMaxWeight) / previousMaxWeight) * 100
      : 0;
    
    return { volumeChange, maxWeightChange };
  };

  // Render workout header
  const renderWorkoutHeader = () => {
    if (!workout) return null;
    
    return (
      <View style={styles.workoutHeader}>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.workoutTitle, { color: colors.text }]}>
            {workout.routine_name}
          </Text>
          <Text style={[styles.workoutDate, { color: colors.text }]}>
            {formatDate(workout.date)}
          </Text>
        </View>
        
        {workout.notes && (
          <View style={styles.notesContainer}>
            <Text style={[styles.notesLabel, { color: colors.text }]}>Notes:</Text>
            <Text style={[styles.notesText, { color: colors.text }]}>{workout.notes}</Text>
          </View>
        )}
      </View>
    );
  };

  // Render statistics summary
  const renderStatisticsSummary = () => {
    if (!workout) return null;
    
    return (
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons 
            name="weight-lifter" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {totalVolume.toLocaleString()} kg
          </Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>
            Total Volume
          </Text>
          {comparisonStats.volumeChange !== 0 && (
            <Text 
              style={[
                styles.changeText, 
                { 
                  color: comparisonStats.volumeChange > 0 
                    ? '#4CAF50' 
                    : '#F44336' 
                }
              ]}
            >
              {comparisonStats.volumeChange > 0 ? '+' : ''}
              {comparisonStats.volumeChange.toFixed(1)}%
            </Text>
          )}
        </View>
        
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <Ionicons 
            name="time-outline" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {calculateDuration(workout.duration)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>
            Duration
          </Text>
          {comparisonStats.timeChange !== 0 && (
            <Text 
              style={[
                styles.changeText, 
                { 
                  color: comparisonStats.timeChange < 0 
                    ? '#4CAF50' 
                    : '#F44336' 
                }
              ]}
            >
              {comparisonStats.timeChange > 0 ? '+' : ''}
              {comparisonStats.timeChange.toFixed(1)}%
            </Text>
          )}
        </View>
        
        <View style={[styles.statCard, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons 
            name="repeat" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {exercisesWithSets.reduce((sum, ex) => sum + ex.sets.length, 0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.subtext }]}>
            Total Sets
          </Text>
        </View>
      </View>
    );
  };

  // Render exercises
  const renderExercises = () => {
    return exercisesWithSets.map((exercise) => {
      const { volumeChange, maxWeightChange } = compareWithPrevious(exercise);
      const exerciseVolume = calculateExerciseVolume(exercise);
      const maxWeight = calculateMaxWeight(exercise);
      
      return (
        <View 
          key={exercise.id} 
          style={[styles.exerciseCard, { backgroundColor: colors.card }]}
        >
          <TouchableOpacity 
            style={styles.exerciseHeader} 
            onPress={() => toggleExerciseExpansion(exercise.id)}
          >
            <View style={styles.exerciseInfo}>
              <Text style={[styles.exerciseName, { color: colors.text }]}>
                {exercise.name}
              </Text>
              <Text style={[styles.exerciseMuscle, { color: colors.subtext }]}>
                {exercise.primary_muscle}
              </Text>
            </View>
            
            <View style={styles.exerciseStats}>
              <View style={styles.statItem}>
                <Text style={[styles.statItemLabel, { color: colors.subtext }]}>
                  Volume:
                </Text>
                <Text style={[styles.statItemValue, { color: colors.text }]}>
                  {exerciseVolume.toLocaleString()} kg
                </Text>
                {volumeChange !== 0 && (
                  <Text 
                    style={[
                      styles.miniChangeText, 
                      { 
                        color: volumeChange > 0 
                          ? '#4CAF50' 
                          : '#F44336' 
                      }
                    ]}
                  >
                    {volumeChange > 0 ? '+' : ''}
                    {volumeChange.toFixed(1)}%
                  </Text>
                )}
              </View>
              
              <View style={styles.statItem}>
                <Text style={[styles.statItemLabel, { color: colors.subtext }]}>
                  Max:
                </Text>
                <Text style={[styles.statItemValue, { color: colors.text }]}>
                  {maxWeight} kg
                </Text>
                {maxWeightChange !== 0 && (
                  <Text 
                    style={[
                      styles.miniChangeText, 
                      { 
                        color: maxWeightChange > 0 
                          ? '#4CAF50' 
                          : '#F44336' 
                      }
                    ]}
                  >
                    {maxWeightChange > 0 ? '+' : ''}
                    {maxWeightChange.toFixed(1)}%
                  </Text>
                )}
              </View>
              
              <Ionicons 
                name={exercise.expanded ? 'chevron-up' : 'chevron-down'} 
                size={20} 
                color={colors.subtext}
              />
            </View>
          </TouchableOpacity>
          
          {exercise.expanded && (
            <View style={styles.exerciseDetails}>
              <View style={styles.exerciseActions}>
                <TouchableOpacity
                  style={[styles.historyButton, { backgroundColor: colors.card, borderColor: colors.primary }]}
                  onPress={() => router.push(`/exercise/history/${exercise.exercise_id}`)}
                >
                  <FontAwesome name="history" size={16} color={colors.primary} style={styles.historyIcon} />
                  <Text style={[styles.historyButtonText, { color: colors.primary }]}>View History</Text>
                </TouchableOpacity>
              </View>
              
              {exercise.notes && (
                <View style={styles.exerciseNotes}>
                  <Text style={[styles.exerciseNotesLabel, { color: colors.subtext }]}>
                    Notes:
                  </Text>
                  <Text style={[styles.exerciseNotesText, { color: colors.text }]}>
                    {exercise.notes}
                  </Text>
                </View>
              )}
              
              <View style={styles.setsList}>
                <View style={styles.setHeader}>
                  <Text style={[styles.setText, { color: colors.subtext, flex: 0.5 }]}>Set</Text>
                  <Text style={[styles.setText, { color: colors.subtext, flex: 1 }]}>Weight</Text>
                  <Text style={[styles.setText, { color: colors.subtext, flex: 1 }]}>Reps</Text>
                  <Text style={[styles.setText, { color: colors.subtext, flex: 1.5 }]}>Rest Time</Text>
                </View>
                
                {exercise.sets.map((currentSet, index) => (
                  <View key={currentSet.id} style={styles.setRow}>
                    <Text style={[styles.setText, { color: colors.text, flex: 0.5 }]}>
                      {currentSet.set_number}
                    </Text>
                    <Text style={[styles.setText, { color: colors.text, flex: 1 }]}>
                      {currentSet.weight} kg
                    </Text>
                    <Text style={[styles.setText, { color: colors.text, flex: 1 }]}>
                      {currentSet.reps}
                    </Text>
                    <Text style={[styles.setText, { color: colors.text, flex: 1.5 }]}>
                      {currentSet.rest_time ? `${currentSet.rest_time}s` : '-'}
                    </Text>
                  </View>
                ))}
                
                {/* Display set notes for each set that has notes */}
                {exercise.sets.map(currentSet => (
                  currentSet.notes ? (
                    <View key={`notes-${currentSet.id}`} style={styles.setNotes}>
                      <Text style={[styles.setNotesText, { color: colors.text }]}>
                        Set {currentSet.set_number} notes: {currentSet.notes}
                      </Text>
                    </View>
                  ) : null
                ))}
              </View>
            </View>
          )}
        </View>
      );
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: "Workout Details",
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading workout details...
            </Text>
          </View>
        ) : (
          <>
            {renderWorkoutHeader()}
            {renderStatisticsSummary()}
            <View style={styles.exercisesContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Exercises
              </Text>
              {renderExercises()}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  workoutHeader: {
    marginBottom: 20,
  },
  headerTitleContainer: {
    marginBottom: 8,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  workoutDate: {
    fontSize: 14,
    marginTop: 4,
  },
  notesContainer: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '31%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  exercisesContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  exerciseCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  exerciseMuscle: {
    fontSize: 12,
    marginTop: 2,
  },
  exerciseStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    marginRight: 14,
    alignItems: 'flex-end',
  },
  statItemLabel: {
    fontSize: 11,
  },
  statItemValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  miniChangeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  exerciseDetails: {
    padding: 16,
    paddingTop: 0,
  },
  exerciseNotes: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  exerciseNotesLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  exerciseNotesText: {
    fontSize: 12,
  },
  chartContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  chart: {
    borderRadius: 8,
    marginVertical: 8,
  },
  setsList: {
    marginTop: 8,
  },
  setHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  setText: {
    fontSize: 14,
  },
  setNotes: {
    marginTop: 4,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  setNotesText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  exerciseActions: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyIcon: {
    marginRight: 6,
  },
}); 