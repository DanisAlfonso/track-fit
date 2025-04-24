import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, FlatList, Animated, Dimensions, Platform, TouchableWithoutFeedback, Vibration, AppState, AppStateStatus } from 'react-native';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';
import { useWorkout } from '@/context/WorkoutContext';
import { getWeightUnitPreference, WeightUnit, kgToLb, lbToKg } from '../(tabs)/profile';
import { useTheme } from '@/context/ThemeContext';

type Exercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  exercise_order: number;
  primary_muscle: string;
  category: string;
};

type Set = {
  id?: number;
  set_number: number;
  reps: number;
  weight: number;
  rest_time: number;
  completed: boolean;
  training_type?: 'heavy' | 'moderate' | 'light'; // New field for rep range categorization
  notes: string;
};

type WorkoutExercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  completedSets: number;
  exercise_order: number;
  primary_muscle: string;
  category: string;
  sets_data: Set[];
  notes: string;
  originalIndex?: number; // Optional property to store the original index
};

// Add SortOption type, similar to routine details screen
type SortOption = 'default' | 'muscle' | 'category';

// Add this new type to track field interaction
type TouchedFields = {
  reps: boolean;
  weight: boolean;
};

// Define training type options
const TRAINING_TYPES = [
  { value: 'heavy', label: 'Heavy', description: '1-5 reps', color: '#6F74DD' },
  { value: 'moderate', label: 'Moderate', description: '6-12 reps', color: '#FFB300' },
  { value: 'light', label: 'Light', description: '13+ reps', color: '#4CAF50' },
];

export default function StartWorkoutScreen() {
  const { routineId, workoutId: existingWorkoutId } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const workoutStartTime = useRef<number | null>(null);
  const workoutTimer = useRef<NodeJS.Timeout | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const timerAnimation = useRef(new Animated.Value(0)).current;
  const appStateRef = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);
  const lastSaveAttempt = useRef<number>(0);
  const saveInProgress = useRef<boolean>(false);
  const [appStateEvents, setAppStateEvents] = useState<{background: number, foreground: number}>({
    background: 0,
    foreground: 0
  });

  // Get workout context functions
  const { 
    startWorkout: startGlobalWorkout, 
    endWorkout: endGlobalWorkout,
    pauseWorkout: minimizeWorkout,
    activeWorkout,
    resumeWorkout
  } = useWorkout();

  const [routineName, setRoutineName] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<number | null>(null);
  const [setModalVisible, setSetModalVisible] = useState(false);
  const [currentSet, setCurrentSet] = useState<Set>({
    set_number: 1,
    reps: 0,
    weight: 0,
    rest_time: 60, // Default 60 seconds rest
    completed: false,
    notes: ''
  });
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({ reps: false, weight: false });
  const [previousWorkoutData, setPreviousWorkoutData] = useState<Map<number, { reps: number, weight: number }[]>>(new Map());
  const [selectedSetIndex, setSelectedSetIndex] = useState<number>(0);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [isResting, setIsResting] = useState(false);
  const [restTimeRemaining, setRestTimeRemaining] = useState(0);
  const [initialRestTime, setInitialRestTime] = useState(0);
  const [restPercent, setRestPercent] = useState(100);
  const restTimeoutFlash = useRef(new Animated.Value(0)).current;
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const restStartTimeRef = useRef<number>(0);
  const restEndTimeRef = useRef<number>(0);
  
  // Load user's weight unit preference
  useEffect(() => {
    const loadWeightUnitPreference = async () => {
      const unit = await getWeightUnitPreference();
      setWeightUnit(unit);
    };
    
    loadWeightUnitPreference();
  }, []);

  // Format weight based on user preference
  const formatWeight = (weight: number): string => {
    if (weightUnit === 'lb') {
      // Display in pounds, converting from kg (stored value)
      return `${kgToLb(weight).toFixed(1)} lb`;
    }
    // Display in kg
    return `${weight} kg`;
  };

  // Convert input weight based on unit
  const getStoredWeight = (inputWeight: number): number => {
    // Always store weights in kg in the database
    if (weightUnit === 'lb') {
      // Convert from pounds to kg for storage
      return lbToKg(inputWeight);
    }
    return inputWeight;
  };

  // Animation pulse for timer
  useEffect(() => {
    if (workoutStarted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(timerAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      timerAnimation.setValue(0);
    }
    
    return () => {
      timerAnimation.setValue(0);
    };
  }, [workoutStarted]);

  useEffect(() => {
    loadRoutineExercises();
    return () => {
      if (workoutTimer.current) {
        clearInterval(workoutTimer.current);
      }
    };
  }, [routineId]);

  // Update workout duration every second
  useEffect(() => {
    if (workoutStarted && workoutStartTime.current) {
      // Use a more reliable method to track time that accounts for background state
      const calculateElapsedTime = () => {
        if (!workoutStartTime.current) return;
        
        const elapsed = Math.floor((Date.now() - workoutStartTime.current) / 1000);
        setWorkoutDuration(elapsed);
      };
      
      // Initial calculation
      calculateElapsedTime();
      
      // Set up interval
      workoutTimer.current = setInterval(calculateElapsedTime, 1000);
    }
    return () => {
      if (workoutTimer.current) {
        clearInterval(workoutTimer.current);
        workoutTimer.current = null;
      }
    };
  }, [workoutStarted]);

  // Periodically save workout progress even if app stays in foreground
  useEffect(() => {
    let autoSaveTimer: NodeJS.Timeout | null = null;
    
    if (workoutId && workoutStarted) {
      // Auto-save every 2 minutes
      autoSaveTimer = setInterval(() => {
        // Only attempt to save if not currently saving and if it's been at least 30 seconds since last attempt
        const now = Date.now();
        if (!saveInProgress.current && now - lastSaveAttempt.current >= 30000) {
          console.log('Auto-saving workout progress...');
          saveWorkoutProgress(false).catch(error => {
            console.error('Auto-save failed:', error);
          });
        }
      }, 2 * 60 * 1000); // 2 minutes
    }
    
    return () => {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
      }
    };
  }, [workoutId, workoutStarted]);

  // When leaving the screen, handle minimization
  useEffect(() => {
    return () => {
      // Only minimize if we have an active workout and we're not finishing
      if (workoutId && workoutStarted) {
        // Save progress before minimizing
        saveWorkoutProgress(true).then(() => {
          minimizeWorkout();
        }).catch(error => {
          console.error('Failed to save workout:', error);
          minimizeWorkout(); // Still minimize even if save failed
        });
      }
      
      if (workoutTimer.current) {
        clearInterval(workoutTimer.current);
      }
    };
  }, [workoutId, workoutStarted]);

  // Check if we're resuming an existing workout
  useEffect(() => {
    if (existingWorkoutId && !workoutStarted) {
      console.log("Resuming workout with ID:", existingWorkoutId);
      resumeExistingWorkout(Number(existingWorkoutId));
    }
  }, [existingWorkoutId]);

  const resumeExistingWorkout = async (workoutId: number) => {
    setIsLoading(true);
    
    try {
      const db = await getDatabase();
      
      // Get the workout details
      const workout = await db.getFirstAsync<{ 
        routine_id: number; 
        name: string; 
        date: number;
        notes: string | null;
      }>(
        'SELECT routine_id, name, date, notes FROM workouts WHERE id = ?',
        [workoutId]
      );
      
      if (!workout) {
        throw new Error('Workout not found');
      }
      
      // Set workout details
      setRoutineName(workout.name);
      setWorkoutId(workoutId);
      setWorkoutStarted(true);
      setWorkoutNotes(workout.notes || '');
      workoutStartTime.current = workout.date;
      
      // Load workout exercises and sets
      const exerciseRecords = await db.getAllAsync<{
        id: number;
        exercise_id: number;
        sets_completed: number;
        notes: string | null;
      }>(
        'SELECT id, exercise_id, sets_completed, notes FROM workout_exercises WHERE workout_id = ?',
        [workoutId]
      );
      
      // Get all routine exercises for this routine (will be used in both cases)
      const routineExercises = await db.getAllAsync<{
        id: number;
        exercise_id: number;
        sets: number;
        order_num: number;
        primary_muscle: string;
        category: string;
        name: string;
      }>(
        `SELECT re.id, re.exercise_id, re.sets, re.order_num, e.primary_muscle, e.category, e.name
         FROM routine_exercises re
         JOIN exercises e ON re.exercise_id = e.id
         WHERE re.routine_id = ?
         ORDER BY re.order_num`,
        [workout.routine_id]
      );
      
      if (routineExercises.length === 0) {
        throw new Error('No exercises found for this routine');
      }
      
      let workoutExercises: WorkoutExercise[] = [];
      
      if (exerciseRecords.length === 0) {
        // No exercises have been saved yet for this workout - use routine exercises as a template
        console.log('No saved workout exercises found - using routine exercises as template');
        
        workoutExercises = routineExercises.map(re => {
          // Create default sets data
          const sets_data: Set[] = [];
          
          for (let i = 1; i <= re.sets; i++) {
            sets_data.push({
              set_number: i,
              reps: 0,
              weight: 0,
              rest_time: 60,
              completed: false,
              notes: ''
            });
          }
          
          return {
            routine_exercise_id: re.id,
            exercise_id: re.exercise_id,
            name: re.name,
            sets: re.sets,
            completedSets: 0,
            exercise_order: re.order_num,
            primary_muscle: re.primary_muscle,
            category: re.category,
            sets_data: sets_data,
            notes: ''
          };
        });
      } else {
        // Create map of exercise_id to routine_exercise for quick lookup
        const routineExerciseMap = new Map();
        routineExercises.forEach(re => {
          routineExerciseMap.set(re.exercise_id, re);
        });
        
        // Create workout exercises with completed sets
        workoutExercises = [];
        
        for (const exerciseRecord of exerciseRecords) {
          // Get the corresponding routine exercise
          const routineExercise = routineExerciseMap.get(exerciseRecord.exercise_id);
          
          if (!routineExercise) {
            console.warn(`Routine exercise not found for exercise_id ${exerciseRecord.exercise_id}`);
            continue;
          }
          
          // Get all sets for this workout exercise
          const sets = await db.getAllAsync<Set>(
            `SELECT id, set_number, reps, weight, rest_time, completed, training_type, notes
             FROM sets
             WHERE workout_exercise_id = ?
             ORDER BY set_number`,
            [exerciseRecord.id]
          );
          
          // Create a full array of sets, ensuring we have the correct number
          const allSets: Set[] = [];
          for (let i = 1; i <= routineExercise.sets; i++) {
            // Look for existing set
            const existingSet = sets.find(s => s.set_number === i);
            
            if (existingSet) {
              allSets.push(existingSet);
            } else {
              // Create a new default set
              allSets.push({
                set_number: i,
                reps: 0,
                weight: 0,
                rest_time: 60,
                completed: false,
                notes: ''
              });
            }
          }
          
          // Add the workout exercise
          workoutExercises.push({
            routine_exercise_id: routineExercise.id,
            exercise_id: exerciseRecord.exercise_id,
            name: routineExercise.name,
            sets: routineExercise.sets,
            completedSets: exerciseRecord.sets_completed || 0,
            exercise_order: routineExercise.order_num,
            primary_muscle: routineExercise.primary_muscle,
            category: routineExercise.category,
            sets_data: allSets,
            notes: exerciseRecord.notes || ''
          });
        }
      }
      
      // Sort workout exercises by order number
      workoutExercises.sort((a, b) => a.exercise_order - b.exercise_order);
      
      setExercises(workoutExercises);
      
      // Register with global workout context
      resumeWorkout();
      
    } catch (error) {
      console.error('Error resuming workout:', error);
      Alert.alert('Error', 'Failed to resume workout');
      router.replace({ pathname: '/(tabs)/routines' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoutineExercises = async () => {
    if (!routineId) return;
    
    setIsLoading(true);
    
    try {
      const db = await getDatabase();
      const id = parseInt(String(routineId), 10);
      
      // Get routine name
      const routineResult = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM routines WHERE id = ?',
        [id]
      );
      
      if (routineResult) {
        setRoutineName(routineResult.name);
        
        // Get routine exercises - Added primary_muscle and category to query
        const exerciseResults = await db.getAllAsync<Exercise>(
          `SELECT re.id as routine_exercise_id, e.id as exercise_id, e.name, re.sets, re.order_num as exercise_order,
           e.primary_muscle, e.category
           FROM routine_exercises re
           JOIN exercises e ON re.exercise_id = e.id
           WHERE re.routine_id = ?
           ORDER BY re.order_num`,
          [id]
        );
        
        // Load previous workout data for this routine if available
        await loadPreviousWorkoutData(id, exerciseResults);
        
        // Convert to workout exercises with completed sets
        const workoutExercises: WorkoutExercise[] = exerciseResults.map(exercise => {
          // Create default sets data
          const sets_data: Set[] = [];
          const previousSets = previousWorkoutData.get(exercise.routine_exercise_id) || [];
          
          for (let i = 1; i <= exercise.sets; i++) {
            // Use previous workout data if available for this set
            const previousSet = previousSets[i-1];
            sets_data.push({
              set_number: i,
              reps: 0,
              weight: 0,
              rest_time: 60, // Default 60 seconds rest
              completed: false,
              notes: ''
            });
          }
          
          return {
            ...exercise,
            completedSets: 0,
            sets_data,
            notes: ''
          };
        });
        
        setExercises(workoutExercises);
      } else {
        Alert.alert('Error', 'Routine not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading routine exercises:', error);
      Alert.alert('Error', 'Failed to load routine exercises');
    } finally {
      setIsLoading(false);
    }
  };

  // Load previous workout data for reference
  const loadPreviousWorkoutData = async (routineId: number, exercises: Exercise[]) => {
    try {
      const db = await getDatabase();
      
      // Get the most recent completed workout for this routine
      const recentWorkout = await db.getFirstAsync<{ id: number }>(
        `SELECT id FROM workouts 
         WHERE routine_id = ? AND completed_at IS NOT NULL 
         ORDER BY date DESC LIMIT 1`,
        [routineId]
      );
      
      if (!recentWorkout) return;
      
      const workoutData = new Map<number, { reps: number, weight: number }[]>();
      
      // For each exercise, get the sets data from the most recent workout
      for (const exercise of exercises) {
        const workoutExercise = await db.getFirstAsync<{ id: number }>(
          `SELECT we.id 
           FROM workout_exercises we
           WHERE we.workout_id = ? AND we.exercise_id = ?`,
          [recentWorkout.id, exercise.exercise_id]
        );
        
        if (workoutExercise) {
          const sets = await db.getAllAsync<{ set_number: number, reps: number, weight: number }>(
            `SELECT set_number, reps, weight FROM sets
             WHERE workout_exercise_id = ? AND completed = 1
             ORDER BY set_number`,
            [workoutExercise.id]
          );
          
          if (sets.length > 0) {
            workoutData.set(exercise.routine_exercise_id, sets);
          }
        }
      }
      
      setPreviousWorkoutData(workoutData);
    } catch (error) {
      console.error('Error loading previous workout data:', error);
      // Don't alert the user - this is just supplemental data
    }
  };

  const startWorkout = async () => {
    if (!routineId) return;
    
    setIsSaving(true);
    
    try {
      const db = await getDatabase();
      const id = parseInt(String(routineId), 10);
      
      // Create a new workout
      const result = await db.runAsync(
        'INSERT INTO workouts (routine_id, name, date) VALUES (?, ?, ?)',
        [id, routineName, Date.now()]
      );
      
      const newWorkoutId = result.lastInsertRowId;
      setWorkoutId(newWorkoutId);
      setWorkoutStarted(true);
      workoutStartTime.current = Date.now();
      
      // Register with global workout context
      startGlobalWorkout(newWorkoutId, routineName);
      
      Alert.alert('Workout Started', 'Your workout has begun. Track your progress as you go!');
    } catch (error) {
      console.error('Error starting workout:', error);
      Alert.alert('Error', 'Failed to start workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const openSetModal = (exerciseIndex: number, setIndex: number) => {
    if (!workoutStarted) return;
    
    setSelectedExercise(exerciseIndex);
    setSelectedSetIndex(setIndex);
    const exercise = exercises[exerciseIndex];
    const currentSetData = {...exercise.sets_data[setIndex]};
    
    // Check if previous performance data exists for this exercise and set
    if (previousWorkoutData.has(exercise.routine_exercise_id) && 
        previousWorkoutData.get(exercise.routine_exercise_id)![setIndex]) {
      
      const prevSet = previousWorkoutData.get(exercise.routine_exercise_id)![setIndex];
      
      // Only pre-fill values if they haven't been changed already
      if (currentSetData.reps === 0) {
        currentSetData.reps = prevSet.reps;
        
        // Suggest training type based on rep count
        if (!currentSetData.training_type) {
          if (prevSet.reps <= 5) {
            currentSetData.training_type = 'heavy';
          } else if (prevSet.reps <= 12) {
            currentSetData.training_type = 'moderate';
          } else {
            currentSetData.training_type = 'light';
          }
        }
      }
      
      if (currentSetData.weight === 0) {
        currentSetData.weight = prevSet.weight;
      }
    }
    
    setCurrentSet(currentSetData);
    
    // Reset touched fields state when opening modal
    setTouchedFields({ reps: false, weight: false });
    
    setSetModalVisible(true);
  };

  const saveSet = () => {
    if (selectedExercise === null) return;
    
    // Set all fields as touched when attempting to save
    setTouchedFields({ reps: true, weight: true });
    
    // Validate reps and weight
    if (currentSet.reps === 0) {
      Alert.alert('Invalid Input', 'Please enter at least 1 repetition for this set.');
      return;
    }
    
    if (currentSet.weight === 0) {
      Alert.alert('Invalid Input', `Please enter a weight value greater than 0 ${weightUnit}.`);
      return;
    }
    
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[selectedExercise];
    
    // Find the set index
    const setIndex = exercise.sets_data.findIndex(s => s.set_number === currentSet.set_number);
    if (setIndex === -1) return;
    
    // If no training type is selected, automatically categorize based on rep count
    if (!currentSet.training_type) {
      if (currentSet.reps <= 5) {
        currentSet.training_type = 'heavy';
      } else if (currentSet.reps <= 12) {
        currentSet.training_type = 'moderate';
      } else {
        currentSet.training_type = 'light';
      }
    }
    
    // Store the weight in kg in the database, regardless of display preference
    const convertedWeight = getStoredWeight(currentSet.weight);
    
    // Update the set
    exercise.sets_data[setIndex] = {
      ...currentSet,
      weight: convertedWeight, // Store in kg
      completed: true
    };
    
    // Update completed sets count
    exercise.completedSets = exercise.sets_data.filter(s => s.completed).length;
    
    setExercises(updatedExercises);
    setSetModalVisible(false);
    
    // Start the rest timer based on the set's rest time
    startRestTimer(currentSet.rest_time);
    
    // Save progress to database immediately after saving a set
    saveWorkoutProgress().catch(error => {
      console.error('Failed to save set data:', error);
    });
    
    // Check if all sets are completed
    if (exercise.completedSets === exercise.sets) {
      // If this was the last exercise and all sets are completed
      if (selectedExercise === exercises.length - 1 && 
          updatedExercises.every(e => e.completedSets === e.sets)) {
        finishWorkout();
      }
    }
  };

  const updateExerciseNotes = (exerciseIndex: number, notes: string) => {
    const updatedExercises = [...exercises];
    updatedExercises[exerciseIndex].notes = notes;
    setExercises(updatedExercises);
  };

  const finishWorkout = async () => {
    if (!workoutId) return;
    
    Alert.alert(
      'Finish Workout',
      'Are you sure you want to finish this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Finish', 
          style: 'destructive',
          onPress: async () => {
            setIsSaving(true);
            
            try {
              const db = await getDatabase();
              
              // Update workout with completion time and duration
              await db.runAsync(
                'UPDATE workouts SET date = ?, duration = ?, notes = ?, completed_at = ? WHERE id = ?',
                [Date.now(), workoutDuration, workoutNotes, Date.now(), workoutId]
              );
              
              // Save completed exercises and sets
              for (const exercise of exercises) {
                // Skip exercises with no sets or all sets are empty
                const hasCompletedSets = exercise.sets_data.some(set => set.completed);
                const hasAnySetData = exercise.sets_data.some(set => set.reps > 0 || set.weight > 0);
                
                if (!hasCompletedSets && !hasAnySetData) {
                  continue; // Skip this exercise entirely
                }
                
                // Ensure the workout_exercise record exists
                let workoutExerciseId = null;
                const existingExercise = await db.getFirstAsync<{id: number}>(
                  `SELECT id FROM workout_exercises WHERE workout_id = ? AND exercise_id = ?`,
                  [workoutId, exercise.exercise_id]
                );
                
                if (existingExercise) {
                  workoutExerciseId = existingExercise.id;
                  // Update existing workout exercise
                  await db.runAsync(
                    `UPDATE workout_exercises SET sets_completed = ?, notes = ? WHERE id = ?`,
                    [exercise.completedSets, exercise.notes || '', workoutExerciseId]
                  );
                } else {
                  // Create new workout exercise record
                  const result = await db.runAsync(
                    `INSERT INTO workout_exercises (workout_id, exercise_id, sets_completed, notes) VALUES (?, ?, ?, ?)`,
                    [workoutId, exercise.exercise_id, exercise.completedSets, exercise.notes || '']
                  );
                  workoutExerciseId = Number(result.lastInsertRowId);
                }
                
                // Save all sets for this exercise
                if (workoutExerciseId && exercise.sets_data) {
                  for (const set of exercise.sets_data) {
                    if (set.id) {
                      // Update existing set
                      await db.runAsync(
                        `UPDATE sets SET reps = ?, weight = ?, completed = ?, training_type = ?, notes = ? WHERE id = ?`,
                        [set.reps, set.weight, set.completed ? 1 : 0, set.training_type || null, set.notes || '', set.id]
                      );
                    } else {
                      // Create new set
                      const result = await db.runAsync(
                        `INSERT INTO sets (workout_exercise_id, set_number, reps, weight, rest_time, completed, training_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          workoutExerciseId, 
                          set.set_number, 
                          set.reps, 
                          set.weight, 
                          set.rest_time || 60, 
                          set.completed ? 1 : 0,
                          set.training_type || null,
                          set.notes || ''
                        ]
                      );
                      
                      // Update the set with its ID
                      set.id = Number(result.lastInsertRowId);
                    }
                  }
                }
              }
              
              // Clear the global workout
              endGlobalWorkout();
              
              Alert.alert('Workout Completed', 'Great job! Your workout has been saved.', [
                { 
                  text: 'OK', 
                  onPress: () => {
                    // Navigate to the History screen instead of Routines
                    router.replace({ pathname: '/history' });
                  }
                }
              ]);
            } catch (error) {
              console.error('Error finishing workout:', error);
              Alert.alert('Error', 'Failed to save workout. Please try again.');
            } finally {
              setIsSaving(false);
            }
          }
        }
      ]
    );
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours > 0 ? `${hours}:` : ''}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate overall workout progress percentage
  const calculateProgressPercentage = () => {
    if (exercises.length === 0) return 0;
    
    const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets_data.length, 0);
    const completedSets = exercises.reduce((sum, exercise) => 
      sum + exercise.sets_data.filter(set => set.completed).length, 0);
    
    return totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  };

  const renderProgressBar = () => {
    const progress = calculateProgressPercentage();
    
    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View 
            style={[
              styles.progressBarFill, 
              { 
                width: `${progress}%`, 
                backgroundColor: progress === 100 ? colors.success : colors.primary 
              }
            ]} 
          />
        </View>
        <Text style={[styles.progressText, { color: colors.text }]}>
          {progress.toFixed(0)}% Complete
        </Text>
      </View>
    );
  };

  const renderExerciseItem = ({ item, index, muscleColor }: { item: WorkoutExercise, index: number, muscleColor?: string }) => {
    // Calculate exercise completion percentage
    const totalSets = item.sets_data.length;
    const completedSets = item.sets_data.filter(set => set.completed).length;
    const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    
    // Use the muscle color if provided, otherwise use the default primary/success color
    const borderColor = progress === 100 
      ? colors.success 
      : (muscleColor || colors.primary);

    // Use the original index if it exists (for grouped views), otherwise use the provided index
    const exerciseIndex = item.originalIndex !== undefined ? item.originalIndex : index;

    // Function to render set items with the correct exercise index
    const renderExerciseSetItem = (setItem: Set, setIndex: number) => {
      // Get training type display
      const getTrainingTypeColor = () => {
        if (!setItem.training_type) return colors.border;
        switch(setItem.training_type) {
          case 'heavy': return '#6F74DD';  // Blue/purple for heavy sets
          case 'moderate': return '#FFB300'; // Orange for moderate sets
          case 'light': return '#4CAF50';  // Green for light sets
          default: return colors.border;
        }
      };
      
      return (
        <TouchableOpacity 
          style={[
            styles.setItem, 
            { 
              backgroundColor: setItem.completed ? colors.success + '22' : colors.card,
              borderColor: setItem.completed ? 
                (setItem.training_type ? getTrainingTypeColor() : colors.success) : 
                colors.border,
              borderWidth: 1.5,
            }
          ]}
          onPress={() => {
            if (workoutStarted) {
              openSetModal(exerciseIndex, setIndex);
            }
          }}
          disabled={!workoutStarted}
          activeOpacity={0.7}
        >
          <View style={styles.setContent}>
            <Text style={[styles.setText, { color: colors.text }]}>
              SET {setItem.set_number}
            </Text>
            {setItem.completed ? (
              <>
                <Text style={[styles.setDetail, { color: colors.text, fontWeight: '600' }]}>
                  {setItem.reps} reps
                </Text>
                <Text style={[styles.setDetail, { color: colors.text }]}>
                  {weightUnit === 'lb' ? `${kgToLb(setItem.weight).toFixed(1)} lb` : `${setItem.weight} kg`}
                </Text>
                {setItem.training_type && (
                  <View style={[styles.trainingTypeBadge, { backgroundColor: getTrainingTypeColor() + '30' }]}>
                    <Text style={[styles.trainingTypeBadgeText, { color: getTrainingTypeColor() }]}>
                      {setItem.training_type.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <FontAwesome name="check" size={14} color={colors.success} style={styles.completedIcon} />
              </>
            ) : (
              <Text style={[styles.tapToLog, { color: colors.primary }]}>
                Tap to log
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <View style={[styles.exerciseItem, { 
        backgroundColor: colors.card,
        borderLeftWidth: 4,
        borderLeftColor: borderColor,
      }]}>
        <View style={[styles.exerciseHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.exerciseTitleArea}>
            <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.exerciseSets, { color: completedSets === totalSets ? colors.success : colors.subtext }]}>
              {completedSets}/{totalSets} sets completed
            </Text>
          </View>
          
          <View style={styles.exerciseHeaderRight}>
            {/* Mini progress bar */}
            <View style={styles.miniProgressContainer}>
              <View style={styles.miniProgressBackground}>
                <View 
                  style={[
                    styles.miniProgressFill, 
                    { 
                      width: `${progress}%`, 
                      backgroundColor: progress === 100 ? colors.success : colors.primary 
                    }
                  ]} 
                />
              </View>
            </View>
            
            <TouchableOpacity
              style={[styles.exerciseHistoryButton, { borderColor: colors.primary }]}
              onPress={() => router.push(`/exercise/history/${item.exercise_id}`)}
            >
              <FontAwesome name="history" size={14} color={colors.primary} style={styles.historyIcon} />
              <Text style={[styles.historyButtonText, { color: colors.primary }]}>History</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={[styles.setsContainer, { backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)' }]}>
          <Text style={[styles.setsLabel, { color: colors.subtext }]}>Sets</Text>
          
          <FlatList
            data={item.sets_data}
            renderItem={({ item: setItem, index: setIndex }) => {
              return renderExerciseSetItem(setItem, setIndex);
            }}
            keyExtractor={(set) => `set-${set.set_number}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.setsList}
            contentContainerStyle={styles.setsListContent}
          />
          
          {workoutStarted && (
            <View style={styles.setsManagementContainer}>
              <TouchableOpacity
                style={styles.setManagementButton}
                onPress={() => addSet(exerciseIndex)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primary + 'E6']}
                  style={styles.setManagementGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <FontAwesome5 name="plus" size={14} color="#fff" style={styles.setManagementIcon} />
                  <Text style={styles.setManagementButtonText}>Add Set</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              {item.sets_data.length > 1 && (
                <TouchableOpacity
                  style={styles.setManagementButton}
                  onPress={() => removeSet(exerciseIndex)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.error + 'DD', colors.error]}
                    style={styles.setManagementGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <FontAwesome5 name="minus" size={14} color="#fff" style={styles.setManagementIcon} />
                    <Text style={styles.setManagementButtonText}>Remove Set</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        
        <View style={styles.exerciseNotes}>
          <Text style={[styles.notesLabel, { color: colors.subtext }]}>Exercise Notes</Text>
          <TextInput
            style={[styles.notesInput, { 
              color: colors.text, 
              borderColor: colors.border,
              backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
            }]}
            placeholder="Add notes for this exercise..."
            placeholderTextColor={colors.subtext}
            value={item.notes}
            onChangeText={(text) => updateExerciseNotes(exerciseIndex, text)}
            multiline
          />
        </View>
      </View>
    );
  };

  // Function to add a new set to an exercise
  const addSet = (exerciseIndex: number) => {
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[exerciseIndex];
    
    // Determine the next set number
    const nextSetNumber = exercise.sets_data.length + 1;
    
    // Check if previous performance data exists for this set number
    let defaultReps = 0;
    let defaultWeight = 0;
    
    // If there's previous data for the last set, use that as default for the new set
    if (previousWorkoutData.has(exercise.routine_exercise_id)) {
      const prevSets = previousWorkoutData.get(exercise.routine_exercise_id)!;
      if (prevSets.length > 0) {
        // Use the last set's data as a starting point, or the matching set if available
        const prevSet = nextSetNumber <= prevSets.length 
          ? prevSets[nextSetNumber - 1] 
          : prevSets[prevSets.length - 1];
        
        defaultReps = prevSet.reps;
        defaultWeight = prevSet.weight;
      }
    }
    
    // Add a new set to the exercise with defaults from previous workout if available
    exercise.sets_data.push({
      set_number: nextSetNumber,
      reps: defaultReps,
      weight: defaultWeight,
      rest_time: 60, // Default 60 seconds rest
      completed: false,
      notes: ''
    });
    
    // Update the total number of sets for the exercise
    exercise.sets = exercise.sets_data.length;
    
    setExercises(updatedExercises);
    
    // Save progress to database after adding a set
    saveWorkoutProgress().catch(error => {
      console.error('Failed to save after adding set:', error);
    });
    
    Alert.alert('Set Added', `Set ${nextSetNumber} added to ${exercise.name}`);
  };
  
  // Function to remove the last set from an exercise
  const removeSet = (exerciseIndex: number) => {
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[exerciseIndex];
    
    // Don't allow removing sets if there's only one left
    if (exercise.sets_data.length <= 1) {
      Alert.alert('Cannot Remove', 'Each exercise must have at least one set');
      return;
    }
    
    // Check if the last set is completed
    const lastSet = exercise.sets_data[exercise.sets_data.length - 1];
    if (lastSet.completed) {
      Alert.alert('Cannot Remove', 'Cannot remove a completed set. Only incomplete sets can be removed.');
      return;
    }
    
    // Remove the last set
    exercise.sets_data.pop();
    
    // Update the total number of sets for the exercise
    exercise.sets = exercise.sets_data.length;
    
    // Update completed sets count if needed
    exercise.completedSets = exercise.sets_data.filter(s => s.completed).length;
    
    setExercises(updatedExercises);
    
    // Save progress to database after removing a set
    saveWorkoutProgress().catch(error => {
      console.error('Failed to save after removing set:', error);
    });
    
    Alert.alert('Set Removed', `Last set removed from ${exercise.name}`);
  };

  // Modify minimizeWorkoutAndNavigate to save data before minimizing
  const minimizeWorkoutAndNavigate = async () => {
    if (!workoutId) return;
    
    saveWorkoutProgress().then(() => {
      minimizeWorkout();
      router.back();
    }).catch(error => {
      console.error('Failed to save workout:', error);
      minimizeWorkout();
      router.back();
    });
  };

  // Function to handle input changes and track which fields have been touched
  const handleInputChange = (field: keyof TouchedFields, value: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    
    if (field === 'reps') {
      const repCount = parseInt(value) || 0;
      
      // Automatically suggest a training type based on rep count
      let suggestedType = currentSet.training_type;
      if (repCount > 0) {
        if (repCount <= 5) {
          suggestedType = 'heavy';
        } else if (repCount <= 12) {
          suggestedType = 'moderate';
        } else {
          suggestedType = 'light';
        }
      }
      
      setCurrentSet({...currentSet, reps: repCount, training_type: suggestedType});
    } else if (field === 'weight') {
      setCurrentSet({...currentSet, weight: parseFloat(value) || 0});
    }
  };

  // Update the display of previous performance
  const displayPreviousPerformance = () => {
    if (selectedExercise === null || 
        !previousWorkoutData.has(exercises[selectedExercise].routine_exercise_id) || 
        !previousWorkoutData.get(exercises[selectedExercise].routine_exercise_id)![selectedSetIndex]) {
      return null;
    }
    
    const prevSetData = previousWorkoutData.get(exercises[selectedExercise].routine_exercise_id)![selectedSetIndex];
    const displayWeight = weightUnit === 'lb' ? 
      `${kgToLb(prevSetData.weight).toFixed(1)} lb` : 
      `${prevSetData.weight} kg`;
    
    return (
      <View style={[styles.previousPerformanceCard, { backgroundColor: colors.primary + '15' }]}>
        <Text style={[styles.previousPerformanceTitle, { color: colors.subtext }]}>
          Previous Performance
        </Text>
        <Text style={[styles.previousPerformanceData, { color: colors.text }]}>
          {prevSetData.reps} reps × {displayWeight}
        </Text>
        <Text style={[styles.previousPerformanceHint, { color: colors.subtext }]}>
          Try to match or exceed your previous performance!
        </Text>
      </View>
    );
  };

  // Function to save workout progress to the database with retry logic
  const saveWorkoutProgress = async (isUrgent: boolean = false): Promise<void> => {
    if (!workoutId) return;
    
    // Mark that a save attempt is in progress
    saveInProgress.current = true;
    lastSaveAttempt.current = Date.now();
    
    try {
      const db = await getDatabase();
      
      // Update workout duration and notes
      const now = Date.now();
      const durationMs = now - workoutStartTime.current!;
      const durationSec = Math.floor(durationMs / 1000);
      
      // Save progress with retry logic
      const saveWithRetry = async (retryCount = 0, maxRetries = isUrgent ? 5 : 3) => {
        try {
          // First update the main workout record
          await db.runAsync(
            'UPDATE workouts SET duration = ?, notes = ? WHERE id = ?',
            [durationSec, workoutNotes, workoutId]
          );
          
          // Save each exercise and its sets
          for (const exercise of exercises) {
            // Skip exercises with no sets or all sets are empty
            const hasCompletedSets = exercise.sets_data.some(set => set.completed);
            const hasAnySetData = exercise.sets_data.some(set => set.reps > 0 || set.weight > 0);
            
            if (!hasCompletedSets && !hasAnySetData && !exercise.notes) {
              continue; // Skip this exercise entirely
            }
            
            // Ensure the workout_exercise record exists
            let workoutExerciseId = null;
            const existingExercise = await db.getFirstAsync<{id: number}>(
              `SELECT id FROM workout_exercises WHERE workout_id = ? AND exercise_id = ?`,
              [workoutId, exercise.exercise_id]
            );
            
            if (existingExercise) {
              workoutExerciseId = existingExercise.id;
              // Update existing workout exercise
              await db.runAsync(
                `UPDATE workout_exercises SET sets_completed = ?, notes = ? WHERE id = ?`,
                [exercise.completedSets, exercise.notes || '', workoutExerciseId]
              );
            } else {
              // Create new workout exercise record
              const result = await db.runAsync(
                `INSERT INTO workout_exercises (workout_id, exercise_id, sets_completed, notes) VALUES (?, ?, ?, ?)`,
                [workoutId, exercise.exercise_id, exercise.completedSets, exercise.notes || '']
              );
              workoutExerciseId = Number(result.lastInsertRowId);
            }
            
            // Save all sets for this exercise
            if (workoutExerciseId && exercise.sets_data) {
              for (const set of exercise.sets_data) {
                try {
                  // Skip empty sets that haven't been completed
                  if (!set.completed && set.reps === 0 && set.weight === 0 && !set.notes) {
                    continue;
                  }
                  
                  if (set.id) {
                    // Update existing set
                    await db.runAsync(
                      `UPDATE sets SET reps = ?, weight = ?, completed = ?, training_type = ?, rest_time = ?, notes = ? WHERE id = ?`,
                      [set.reps, set.weight, set.completed ? 1 : 0, set.training_type || null, set.rest_time || 60, set.notes || '', set.id]
                    );
                  } else {
                    // Create new set
                    const result = await db.runAsync(
                      `INSERT INTO sets (workout_exercise_id, set_number, reps, weight, rest_time, completed, training_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        workoutExerciseId, 
                        set.set_number, 
                        set.reps, 
                        set.weight, 
                        set.rest_time || 60, 
                        set.completed ? 1 : 0,
                        set.training_type || null,
                        set.notes || ''
                      ]
                    );
                    
                    // Update the set with its ID
                    set.id = Number(result.lastInsertRowId);
                  }
                } catch (setError) {
                  console.error('Error saving set:', setError);
                  // Continue with other sets even if one fails
                }
              }
            }
          }
          console.log('Workout progress saved successfully');
        } catch (error) {
          console.error(`Error saving workout progress (attempt ${retryCount + 1}):`, error);
          if (retryCount < maxRetries) {
            // Wait a bit before retrying, with exponential backoff
            const delay = Math.min(500 * Math.pow(2, retryCount), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
            return saveWithRetry(retryCount + 1, maxRetries);
          } else {
            throw error;
          }
        }
      };
      
      await saveWithRetry();
    } catch (error) {
      console.error('Error saving workout progress after retries:', error);
      // Even though we had an error, we don't want to alert during normal saving
    } finally {
      saveInProgress.current = false;
    }
  };

  // Organize exercises by muscle groups for rendering (similar to routine details screen)
  const muscleGroups = useMemo(() => {
    const groups: Record<string, WorkoutExercise[]> = {};
    
    exercises.forEach(exercise => {
      const muscle = exercise.primary_muscle || 'Other';
      if (!groups[muscle]) {
        groups[muscle] = [];
      }
      groups[muscle].push({
        ...exercise,
        // Store the original index in the exercises array
        originalIndex: exercises.findIndex(e => e.routine_exercise_id === exercise.routine_exercise_id)
      });
    });
    
    return groups;
  }, [exercises]);

  // Organize exercises by category for rendering (similar to routine details screen)
  const exerciseCategories = useMemo(() => {
    const categories: Record<string, WorkoutExercise[]> = {};
    
    exercises.forEach(exercise => {
      const category = exercise.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({
        ...exercise,
        // Store the original index in the exercises array
        originalIndex: exercises.findIndex(e => e.routine_exercise_id === exercise.routine_exercise_id)
      });
    });
    
    return categories;
  }, [exercises]);

  // Helper function to get color based on muscle group (similar to routine details screen)
  const getMuscleColor = (muscle: string) => {
    const muscleColors: Record<string, string> = {
      'Chest': '#E91E63',
      'Back': '#3F51B5',
      'Shoulders': '#009688',
      'Biceps': '#FF5722',
      'Triceps': '#FF9800',
      'Legs': '#8BC34A',
      'Quadriceps': '#8BC34A',
      'Hamstrings': '#CDDC39',
      'Calves': '#FFEB3B',
      'Glutes': '#FFC107',
      'Abs': '#00BCD4',
      'Core': '#00BCD4',
      'Forearms': '#795548',
      'Traps': '#9C27B0',
      'Full Body': '#607D8B',
    };
    
    return muscleColors[muscle] || '#4CAF50';
  };

  // Run a smooth animation frame loop when resting
  useEffect(() => {
    if (isResting && restTimeRemaining > 0) {
      // Set start and end time references for precise timing
      const now = Date.now();
      restStartTimeRef.current = now;
      restEndTimeRef.current = now + (restTimeRemaining * 1000);
      
      // Clear any existing animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Function to update both timer and progress bar
      const updateRestTimer = () => {
        const now = Date.now();
        
        // If time is up, complete the rest
        if (now >= restEndTimeRef.current) {
          setRestTimeRemaining(0);
          setRestPercent(0);
          notifyRestComplete();
          return;
        }
        
        // Calculate remaining time and percentage precisely
        const totalDuration = restEndTimeRef.current - restStartTimeRef.current;
        const elapsed = now - restStartTimeRef.current;
        const remaining = restEndTimeRef.current - now;
        const percent = Math.max(0, (remaining / totalDuration) * 100);
        
        // Update state with precise values
        setRestTimeRemaining(Math.ceil(remaining / 1000)); // Round up to nearest second
        setRestPercent(percent);
        
        // Continue the animation loop
        animationFrameRef.current = requestAnimationFrame(updateRestTimer);
      };
      
      // Start the animation loop
      animationFrameRef.current = requestAnimationFrame(updateRestTimer);
    }
    
    return () => {
      // Clean up the animation frame on unmount
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isResting]);
  
  // Function to notify user that rest time is complete
  const notifyRestComplete = () => {
    // Cancel any existing animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Vibrate the device - note this may not work in Expo Go
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        Vibration.vibrate(500);
      } catch (error) {
        console.log('Vibration may not work in Expo Go');
      }
    }
    
    // Visual notification with flash animation
    Animated.sequence([
      Animated.timing(restTimeoutFlash, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(restTimeoutFlash, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(restTimeoutFlash, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(restTimeoutFlash, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
    
    // Stop the rest timer after a short delay to show the completion
    setTimeout(() => {
      setIsResting(false);
    }, 600);
    
    // Show alert to user
    Alert.alert(
      'Rest Complete',
      'Time to do your next set!',
      [{ text: 'OK' }]
    );
  };
  
  // Start the rest timer with the specified duration
  const startRestTimer = (duration: number) => {
    // Cancel any existing animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Reset rest timer states
    setRestTimeRemaining(duration);
    setInitialRestTime(duration);
    setRestPercent(100);
    restTimeoutFlash.setValue(0);
    
    // Calculate exact start and end times
    const now = Date.now();
    restStartTimeRef.current = now;
    restEndTimeRef.current = now + (duration * 1000);
    
    // Start the rest timer
    setIsResting(true);
  };
  
  // Skip the rest timer
  const skipRestTimer = () => {
    // Cancel any existing animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    setIsResting(false);
  };
  
  // Add extra time to the rest timer
  const addRestTime = (seconds: number) => {
    // Update the end time reference with the additional time
    restEndTimeRef.current += (seconds * 1000);
    
    // Update the initial rest time for progress calculation
    const newTotalDuration = restEndTimeRef.current - restStartTimeRef.current;
    setInitialRestTime(newTotalDuration / 1000);
    
    
    // Calculate the new rest time
    const newRestTime = currentSet.rest_time + seconds;
    
    // Update currentSet state
    setCurrentSet(prev => ({
      ...prev,
      rest_time: newRestTime
    }));
    
    // We also need to update the exercises array to reflect this change
    if (selectedExercise !== null) {
      const updatedExercises = [...exercises];
      const exercise = updatedExercises[selectedExercise];
      
      // Find the set index that matches the current set
      const setIndex = exercise.sets_data.findIndex(s => s.set_number === currentSet.set_number);
      
      if (setIndex !== -1) {
        // Update the rest_time in the exercises array
        exercise.sets_data[setIndex].rest_time = newRestTime;
        setExercises(updatedExercises);
        
      }
    }
    
    // Save the updated rest time to the database
    saveWorkoutProgress().catch(error => {
      console.error('Failed to save updated rest time:', error);
    });
    
    // The animation loop will automatically update the display on next frame
  };

  // Reference to the scroll view for muscle groups
  const muscleScrollViewRef = useRef<ScrollView>(null);
  
  // References to position of each muscle group section
  const musclePositions = useRef<Record<string, number>>({});
  
  // Track scroll position to show/hide navigation bar
  const [scrollY, setScrollY] = useState(0);
  
  // Function to scroll to a specific muscle group
  const scrollToMuscle = (muscle: string) => {
    if (muscleScrollViewRef.current && musclePositions.current[muscle] !== undefined) {
      muscleScrollViewRef.current.scrollTo({
        y: musclePositions.current[muscle] - 60, // Adjust for header
        animated: true,
      });
    }
  };
  
  // Function to measure and store position of muscle groups
  const measureMusclePosition = (muscle: string, y: number) => {
    musclePositions.current[muscle] = y;
  };

  // Handle app state changes
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    const now = Date.now();
    
    if (appStateRef.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      // App is going to background
      console.log('App is going to background, saving workout state...');
      lastBackgroundTime.current = now;
      
      setAppStateEvents(prev => ({
        ...prev,
        background: prev.background + 1
      }));
      
      // Save workout progress immediately when app goes to background
      if (workoutId && workoutStarted) {
        saveWorkoutProgress(true).catch(error => {
          console.error('Failed to save workout before going to background:', error);
        });
      }
    } else if (nextAppState === 'active' && appStateRef.current.match(/inactive|background/)) {
      // App is coming back to foreground
      console.log('App is returning to foreground');
      
      setAppStateEvents(prev => ({
        ...prev,
        foreground: prev.foreground + 1
      }));
      
      // If app was in background for more than 5 minutes, refresh the workout data
      if (lastBackgroundTime.current && (now - lastBackgroundTime.current > 5 * 60 * 1000)) {
        console.log('App was in background for a long time, refreshing workout data');
        
        if (workoutId && workoutStarted) {
          // Recalculate workout duration based on actual start time
          if (workoutStartTime.current) {
            const elapsed = Math.floor((now - workoutStartTime.current) / 1000);
            setWorkoutDuration(elapsed);
          }
          
          // Reload workout data from database to ensure we have latest state
          if (workoutId) {
            refreshWorkoutDataFromDatabase(workoutId)
              .catch(error => {
                console.error('Failed to refresh workout data:', error);
              });
          }
        }
      }
    }
    
    appStateRef.current = nextAppState;
  }, [workoutId, workoutStarted]);
  
  // Set up AppState change listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  // Function to reload workout data from database
  const refreshWorkoutDataFromDatabase = async (workoutId: number) => {
    try {
      console.log('Refreshing workout data from database for workout', workoutId);
      const db = await getDatabase();
      
      // Get all workout exercises
      const exerciseRecords = await db.getAllAsync<{
        id: number;
        exercise_id: number;
        sets_completed: number;
        notes: string | null;
      }>('SELECT id, exercise_id, sets_completed, notes FROM workout_exercises WHERE workout_id = ?', [workoutId]);
      
      // Temp map to store workout exercise records by exercise_id
      const exerciseMap = new Map();
      for (const record of exerciseRecords) {
        exerciseMap.set(record.exercise_id, record);
      }
      
      // Update exercises with latest data from database
      const updatedExercises = [...exercises];
      let dataChanged = false;
      
      for (let i = 0; i < updatedExercises.length; i++) {
        const exercise = updatedExercises[i];
        const dbRecord = exerciseMap.get(exercise.exercise_id);
        
        if (dbRecord) {
          // Update notes
          if (exercise.notes !== (dbRecord.notes || '')) {
            exercise.notes = dbRecord.notes || '';
            dataChanged = true;
          }
          
          // Get all sets for this exercise
          const sets = await db.getAllAsync<Set>(
            `SELECT id, set_number, reps, weight, rest_time, completed, training_type, notes
             FROM sets
             WHERE workout_exercise_id = ?
             ORDER BY set_number`,
            [dbRecord.id]
          );
          
          if (sets.length > 0) {
            // Map existing sets by set_number for comparison
            const existingSetsMap = new Map();
            exercise.sets_data.forEach(set => {
              existingSetsMap.set(set.set_number, set);
            });
            
            // Update sets with data from database
            const updatedSets: Set[] = [];
            let setsChanged = false;
            
            for (const dbSet of sets) {
              const existingSet = existingSetsMap.get(dbSet.set_number);
              
              if (existingSet) {
                // Check if any properties have changed
                if (existingSet.reps !== dbSet.reps || 
                    existingSet.weight !== dbSet.weight ||
                    existingSet.completed !== !!dbSet.completed ||
                    existingSet.training_type !== dbSet.training_type ||
                    existingSet.notes !== (dbSet.notes || '')) {
                  setsChanged = true;
                }
                
                // Update with latest data from database
                updatedSets.push({
                  ...dbSet,
                  completed: !!dbSet.completed,
                  notes: dbSet.notes || ''
                });
              } else {
                // New set added in database
                updatedSets.push({
                  ...dbSet,
                  completed: !!dbSet.completed,
                  notes: dbSet.notes || ''
                });
                setsChanged = true;
              }
            }
            
            // Add any missing sets from the original data
            for (const existingSet of exercise.sets_data) {
              if (!sets.some(s => s.set_number === existingSet.set_number)) {
                updatedSets.push(existingSet);
                setsChanged = true;
              }
            }
            
            // Sort sets by set_number
            updatedSets.sort((a, b) => a.set_number - b.set_number);
            
            if (setsChanged) {
              exercise.sets_data = updatedSets;
              exercise.completedSets = updatedSets.filter(s => s.completed).length;
              dataChanged = true;
            }
          }
        }
      }
      
      // Only update state if data has changed
      if (dataChanged) {
        console.log('Workout data refreshed with changes');
        setExercises(updatedExercises);
      } else {
        console.log('No changes detected in workout data');
      }
      
    } catch (error) {
      console.error('Error refreshing workout data:', error);
      throw error;
    }
  };

  // Render a diagnostic display for development mode
  const renderDiagnostics = () => {
    if (!__DEV__ || !workoutStarted) return null;
    
    return (
      <View style={{
        position: 'absolute',
        bottom: 120,
        left: 16,
        right: 16,
        backgroundColor: colors.primary + '20',
        padding: 12,
        borderRadius: 12,
        zIndex: 999,
      }}>
        <Text style={{ color: colors.text, fontWeight: 'bold', marginBottom: 4 }}>
          App State Diagnostics
        </Text>
        <Text style={{ color: colors.text, fontSize: 12, marginBottom: 2 }}>
          Background events: {appStateEvents.background}
        </Text>
        <Text style={{ color: colors.text, fontSize: 12, marginBottom: 2 }}>
          Foreground events: {appStateEvents.foreground}
        </Text>
        <Text style={{ color: colors.text, fontSize: 12, marginBottom: 2 }}>
          Last save: {lastSaveAttempt.current ? new Date(lastSaveAttempt.current).toLocaleTimeString() : 'Never'}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
        <Stack.Screen 
          options={{
            title: "Loading Workout",
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading workout details...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: routineName || "Start Workout",
          headerTintColor: colors.text,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerRight: () => (
            workoutStarted && (
              <TouchableOpacity 
                style={styles.minimizeButton}
                onPress={minimizeWorkoutAndNavigate}
              >
                <FontAwesome name="compress" size={18} color={colors.primary} />
              </TouchableOpacity>
            )
          ),
        }}
      />
      
      {/* Rest Timer Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isResting}
        onRequestClose={skipRestTimer}
      >
        <View style={styles.restModalOverlay}>
          <Animated.View 
            style={[
              styles.restModalContent, 
              { 
                backgroundColor: restTimeoutFlash.interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.card, colors.primary + '30']
                }) 
              }
            ]}
          >
            <View style={styles.restTimerHeader}>
              <Text style={[styles.restTimerTitle, { color: colors.text }]}>Rest Time</Text>
              <TouchableOpacity onPress={skipRestTimer}>
                <FontAwesome name="times" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.restTimerClock}>
              <Text style={[styles.restTimerCountdown, { color: colors.text }]}>
                {Math.floor(restTimeRemaining / 60)}:{(restTimeRemaining % 60).toString().padStart(2, '0')}
              </Text>
            </View>
            
            <View style={styles.restProgressBarContainer}>
              <View 
                style={[
                  styles.restProgressBarFill, 
                  { 
                    backgroundColor: colors.primary,
                    width: `${restPercent}%`,
                  }
                ]} 
              />
            </View>
            
            <View style={styles.restTimerActions}>
              <TouchableOpacity 
                style={[styles.restTimerButton, { backgroundColor: colors.primary + '30' }]}
                onPress={() => addRestTime(30)}
              >
                <Text style={[styles.restTimerButtonText, { color: colors.primary }]}>+30s</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.restTimerButton, { backgroundColor: colors.primary + '30' }]}
                onPress={() => addRestTime(60)}
              >
                <Text style={[styles.restTimerButtonText, { color: colors.primary }]}>+1m</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.skipRestButton, { backgroundColor: colors.error + '20' }]}
                onPress={skipRestTimer}
              >
                <Text style={[styles.skipRestText, { color: colors.error }]}>Skip</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
      
      {!workoutStarted ? (
        <View style={styles.startWorkoutContainer}>
          <View style={styles.startWorkoutContent}>
            <FontAwesome name="trophy" size={48} color={colors.primary} style={styles.startWorkoutIcon} />
            <Text style={[styles.startWorkoutTitle, { color: colors.text }]}>Ready to Begin?</Text>
            <Text style={[styles.startWorkoutDescription, { color: colors.subtext }]}>
              You're about to start "{routineName}" with {exercises.length} exercises and {
                exercises.reduce((sum, exercise) => sum + exercise.sets_data.length, 0)
              } total sets.
            </Text>
            
            <TouchableOpacity 
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={startWorkout}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <FontAwesome name="play-circle" size={20} color="white" style={styles.startButtonIcon} />
                  <Text style={styles.startButtonText}>Start Workout</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.workoutInfo}>
              <View style={styles.workoutStatusRow}>
                <View style={styles.timerContainer}>
                  <Animated.View style={[
                    styles.timerIcon,
                    { 
                      backgroundColor: colors.primary + '22',
                      opacity: timerAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1]
                      })
                    }
                  ]}>
                    <FontAwesome name="clock-o" size={16} color={colors.primary} />
                  </Animated.View>
                  <Text style={[styles.workoutDuration, { color: colors.text }]}>
                    {formatDuration(workoutDuration)}
                  </Text>
                </View>
                
                {renderProgressBar()}
              </View>
              
              {/* Add sorting options */}
              <View style={styles.sortOptions}>
                <TouchableOpacity 
                  style={[
                    styles.sortButton, 
                    sortOption === 'default' && [styles.sortButtonActive, { borderColor: colors.primary }]
                  ]}
                  onPress={() => setSortOption('default')}
                >
                  <Text 
                    style={[
                      styles.sortButtonText, 
                      { color: sortOption === 'default' ? colors.primary : colors.subtext }
                    ]}
                  >
                    Order
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.sortButton, 
                    sortOption === 'muscle' && [styles.sortButtonActive, { borderColor: colors.primary }]
                  ]}
                  onPress={() => setSortOption('muscle')}
                >
                  <Text 
                    style={[
                      styles.sortButtonText, 
                      { color: sortOption === 'muscle' ? colors.primary : colors.subtext }
                    ]}
                  >
                    Muscle
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[
                    styles.sortButton, 
                    sortOption === 'category' && [styles.sortButtonActive, { borderColor: colors.primary }]
                  ]}
                  onPress={() => setSortOption('category')}
                >
                  <Text 
                    style={[
                      styles.sortButtonText, 
                      { color: sortOption === 'category' ? colors.primary : colors.subtext }
                    ]}
                  >
                    Category
                  </Text>
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={[styles.workoutNotes, { 
                  color: colors.text, 
                  borderColor: colors.border,
                  backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                placeholder="Add notes for this workout..."
                placeholderTextColor={colors.subtext}
                value={workoutNotes}
                onChangeText={setWorkoutNotes}
                multiline
              />
            </View>
          </View>
          
          {/* Quick muscle group navigation */}
          {sortOption === 'muscle' && Object.keys(muscleGroups).length > 1 && (
            <View style={[styles.muscleNavContainer, { 
              backgroundColor: currentTheme === 'dark' ? 'rgba(30, 30, 35, 0.95)' : 'rgba(248, 248, 248, 0.95)',
              borderColor: colors.border,
              marginTop: 12,
            }]}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.muscleNavContent}
              >
                {Object.keys(muscleGroups).map((muscle) => (
                  <TouchableOpacity
                    key={`nav-${muscle}`}
                    style={[
                      styles.muscleNavItem,
                      { 
                        borderColor: getMuscleColor(muscle),
                        backgroundColor: currentTheme === 'dark' ? 'rgba(45, 45, 50, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                      }
                    ]}
                    onPress={() => scrollToMuscle(muscle)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.muscleNavDot, { backgroundColor: getMuscleColor(muscle) }]} />
                    <Text style={[styles.muscleNavText, { color: colors.text }]}>
                      {muscle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Replace FlatList with conditional rendering based on sortOption */}
          {sortOption === 'default' && (
            <FlatList
              data={exercises}
              renderItem={renderExerciseItem}
              keyExtractor={(item) => `exercise-${item.routine_exercise_id}`}
              contentContainerStyle={styles.exerciseList}
            />
          )}
          
          {sortOption === 'muscle' && (
            <ScrollView 
              ref={muscleScrollViewRef}
              contentContainerStyle={styles.exerciseList}
              onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
              scrollEventThrottle={16}
            >
              {Object.entries(muscleGroups).map(([muscle, muscleExercises]) => (
                <View 
                  key={muscle} 
                  style={styles.exerciseGroup}
                  onLayout={(event) => {
                    const { y } = event.nativeEvent.layout;
                    measureMusclePosition(muscle, y);
                  }}
                >
                  <View style={[styles.groupHeader, { 
                    backgroundColor: colors.card, 
                    borderLeftColor: getMuscleColor(muscle),
                    borderLeftWidth: 4 
                  }]}>
                    <Text style={[styles.groupTitle, { color: colors.text }]}>{muscle}</Text>
                    <Text style={[styles.groupCount, { color: colors.subtext }]}>
                      {muscleExercises.length} exercise{muscleExercises.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {muscleExercises.map((exercise, index) => (
                    <View key={`${exercise.routine_exercise_id}`}>
                      {renderExerciseItem({ 
                        item: exercise, 
                        index,
                        muscleColor: getMuscleColor(muscle) 
                      })}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
          
          {sortOption === 'category' && (
            <ScrollView contentContainerStyle={styles.exerciseList}>
              {Object.entries(exerciseCategories).map(([category, categoryExercises]) => (
                <View key={category} style={styles.exerciseGroup}>
                  <View style={[styles.groupHeader, { backgroundColor: colors.card }]}>
                    <Text style={[styles.groupTitle, { color: colors.text }]}>{category}</Text>
                    <Text style={[styles.groupCount, { color: colors.subtext }]}>
                      {categoryExercises.length} exercise{categoryExercises.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  {categoryExercises.map((exercise, index) => (
                    <View key={`${exercise.routine_exercise_id}`}>
                      {renderExerciseItem({ item: exercise, index })}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          )}
          
          <View style={[styles.finishButtonContainer, { 
            backgroundColor: currentTheme === 'dark' ? 'rgba(18, 18, 18, 0.9)' : 'rgba(248, 248, 248, 0.9)',
            borderTopColor: colors.border
          }]}>
            <TouchableOpacity 
              style={styles.finishButton}
              onPress={finishWorkout}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.success, colors.success === Colors.light.success ? '#3a9d3d' : '#3a9d3d']}
                style={styles.finishButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isSaving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <FontAwesome5 name="check-circle" size={20} color="white" style={styles.finishButtonIcon} />
                    <Text style={styles.finishButtonText}>Finish Workout</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      )}
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={setModalVisible}
        onRequestClose={() => setSetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedExercise !== null 
                  ? `${exercises[selectedExercise].name} - Set ${currentSet.set_number}` 
                  : 'Log Set'}
              </Text>
              <TouchableOpacity 
                onPress={() => setSetModalVisible(false)}
                hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
                style={styles.closeButton} 
              >
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Show previous performance data if available */}
            {displayPreviousPerformance()}
            
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Reps</Text>
                <Text style={[styles.requiredIndicator, { color: colors.error }]}>*</Text>
              </View>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    color: colors.text, 
                    borderColor: touchedFields.reps && currentSet.reps === 0 ? colors.error : colors.border,
                    backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                  }
                ]}
                keyboardType="number-pad"
                value={currentSet.reps === 0 ? '' : currentSet.reps.toString()}
                onChangeText={(text) => handleInputChange('reps', text)}
                placeholder="Enter reps"
                placeholderTextColor={colors.subtext}
              />
              {touchedFields.reps && currentSet.reps === 0 && (
                <Text style={[styles.inputError, { color: colors.error }]}>
                  Required: Enter at least 1 rep
                </Text>
              )}
            </View>
            
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Weight ({weightUnit})</Text>
                <Text style={[styles.requiredIndicator, { color: colors.error }]}>*</Text>
              </View>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    color: colors.text, 
                    borderColor: touchedFields.weight && currentSet.weight === 0 ? colors.error : colors.border,
                    backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                  }
                ]}
                keyboardType="decimal-pad"
                value={currentSet.weight === 0 ? '' : currentSet.weight.toString()}
                onChangeText={(text) => handleInputChange('weight', text)}
                placeholder={`Enter weight in ${weightUnit}`}
                placeholderTextColor={colors.subtext}
              />
              {touchedFields.weight && currentSet.weight === 0 && (
                <Text style={[styles.inputError, { color: colors.error }]}>
                  Required: Enter weight greater than 0
                </Text>
              )}
            </View>
            
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelContainer}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Training Type</Text>
                <Text style={[styles.optionalIndicator, { color: colors.subtext }]}>Optional</Text>
              </View>
              <View style={[styles.trainingTypeContainer, { borderColor: colors.border, borderRadius: 8, borderWidth: 1 }]}>
                {TRAINING_TYPES.map((type, index) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.trainingTypeButton,
                      { 
                        backgroundColor: currentSet.training_type === type.value 
                          ? type.color + '30' 
                          : 'transparent',
                        borderColor: colors.border,
                        borderLeftWidth: index > 0 ? 1 : 0,
                        borderRadius: 0,
                      }
                    ]}
                    onPress={() => setCurrentSet({...currentSet, training_type: type.value as 'heavy' | 'moderate' | 'light'})}
                  >
                    <Text style={[
                      styles.trainingTypeText, 
                      { 
                        color: currentSet.training_type === type.value 
                          ? type.color 
                          : colors.text,
                        fontWeight: currentSet.training_type === type.value ? 'bold' : 'normal',  
                      }
                    ]}>
                      {type.label}
                    </Text>
                    <Text style={[
                      styles.trainingTypeDescription, 
                      { 
                        color: currentSet.training_type === type.value 
                          ? type.color 
                          : colors.subtext,
                      }
                    ]}>
                      {type.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.trainingTypeHint, { color: colors.subtext }]}>
                Categorize by intensity to track progress separately
              </Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Rest Time (seconds)</Text>
              <TextInput
                style={[styles.input, { 
                  color: colors.text, 
                  borderColor: colors.border,
                  backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                keyboardType="number-pad"
                value={currentSet.rest_time.toString()}
                onChangeText={(text) => setCurrentSet({...currentSet, rest_time: parseInt(text) || 0})}
                placeholder="60"
                placeholderTextColor={colors.subtext}
              />
            </View>
            
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={saveSet}
            >
              <FontAwesome name="save" size={18} color="white" style={styles.saveButtonIcon} />
              <Text style={styles.saveButtonText}>Save Set</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {renderDiagnostics()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  startWorkoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  startWorkoutContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  startWorkoutIcon: {
    marginBottom: 24,
  },
  startWorkoutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  startWorkoutDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  workoutInfo: {
    marginBottom: 10,
  },
  workoutStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  workoutDuration: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    flex: 1,
    marginLeft: 16,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  workoutNotes: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 60,
    fontSize: 15,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonIcon: {
    marginRight: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseList: {
    padding: 16,
    paddingBottom: 100, // Give extra padding at bottom for finish button
  },
  exerciseItem: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  exerciseTitleArea: {
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  exerciseSets: {
    fontSize: 14,
    fontWeight: '500',
  },
  exerciseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  miniProgressContainer: {
    width: 80,
    marginRight: 10,
  },
  miniProgressBackground: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  setsContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  setsLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  setsList: {
    marginBottom: 8,
  },
  setsListContent: {
    paddingRight: 16,
  },
  setItem: {
    borderRadius: 10,
    marginRight: 10,
    width: 100,
    height: 85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  setContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  setText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  setDetail: {
    fontSize: 13,
    marginBottom: 2,
  },
  tapToLog: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  completedIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setsManagementContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  setManagementButton: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 12,
    overflow: 'hidden', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  setManagementGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  setManagementIcon: {
    marginRight: 6,
  },
  setManagementButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  exerciseNotes: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 40,
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 450,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    maxHeight: '90%',
  },
  closeButton: {
    padding: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  requiredIndicator: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  optionalIndicator: {
    fontSize: 12,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  inputError: {
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  modalNotesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  previousPerformance: {
    marginTop: 6,
  },
  previousPerformanceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  previousPerformanceCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  previousPerformanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  previousPerformanceData: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  previousPerformanceHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  minimizeButton: {
    marginRight: 16,
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  exerciseHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  historyButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  historyIcon: {
    marginRight: 4,
  },
  finishButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  finishButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  finishButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  finishButtonIcon: {
    marginRight: 8,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sortOptions: {
    flexDirection: 'row',
    marginBottom: 8,
    justifyContent: 'center',
    marginTop: 8,
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortButtonActive: {
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  exerciseGroup: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupCount: {
    fontSize: 12,
  },
  // Rest Timer Styles
  restModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  restModalContent: {
    width: '80%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  restTimerHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  restTimerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  restTimerClock: {
    marginBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 16,
    minWidth: 160,
    alignItems: 'center',
  },
  restTimerCountdown: {
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  restProgressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 24,
  },
  restProgressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  restTimerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  restTimerButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  restTimerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipRestButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  skipRestText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  restTimerNote: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  trainingTypeContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  trainingTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainingTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  trainingTypeDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  trainingTypeHint: {
    fontSize: 12,
    marginTop: 4,
    
  },
  trainingTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  trainingTypeBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  muscleNavContainer: {
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  muscleNavContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  muscleNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  muscleNavDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  muscleNavText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Diagnostic display styles
  diagnosticContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(100, 100, 255, 0.15)',
    padding: 12,
    borderRadius: 12,
    zIndex: 999,
  },
  diagnosticTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  diagnosticText: {
    fontSize: 12,
    marginBottom: 2,
  },
})