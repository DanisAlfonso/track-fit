import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, FlatList, Animated, Dimensions, Platform, TouchableWithoutFeedback } from 'react-native';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';
import { useWorkout } from '@/context/WorkoutContext';
import { getWeightUnitPreference, WeightUnit, kgToLb, lbToKg } from '../(tabs)/profile';

type Exercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  exercise_order: number;
};

type Set = {
  id?: number;
  set_number: number;
  reps: number;
  weight: number;
  rest_time: number;
  completed: boolean;
  notes: string;
};

type WorkoutExercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  completedSets: number;
  exercise_order: number;
  sets_data: Set[];
  notes: string;
};

// Add this new type to track field interaction
type TouchedFields = {
  reps: boolean;
  weight: boolean;
};

export default function StartWorkoutScreen() {
  const { routineId, workoutId: existingWorkoutId } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const workoutStartTime = useRef<number | null>(null);
  const workoutTimer = useRef<NodeJS.Timeout | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const timerAnimation = useRef(new Animated.Value(0)).current;

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
      workoutTimer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - workoutStartTime.current!) / 1000);
        setWorkoutDuration(elapsed);
      }, 1000);
    }
    return () => {
      if (workoutTimer.current) {
        clearInterval(workoutTimer.current);
      }
    };
  }, [workoutStarted]);

  // When leaving the screen, handle minimization
  useEffect(() => {
    return () => {
      // Only minimize if we have an active workout and we're not finishing
      if (workoutId && workoutStarted) {
        // Save progress before minimizing
        saveWorkoutProgress().then(() => {
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
      console.log("Attempting to resume workout:", workoutId);
      const db = await getDatabase();
      
      // Get the workout details
      const workout = await db.getFirstAsync<{
        id: number;
        name: string;
        routine_id: number;
        date: number;
        duration: number;
        routine_name: string;
      }>(
        `SELECT w.id, w.name, w.routine_id, w.date, w.duration, r.name as routine_name 
         FROM workouts w
         JOIN routines r ON w.routine_id = r.id
         WHERE w.id = ? AND w.completed_at IS NULL`,
        [workoutId]
      );
      
      console.log("Found workout:", workout);
      
      if (!workout) {
        Alert.alert('Error', 'Workout not found or already completed');
        router.replace({ pathname: '/(tabs)/routines' });
        return;
      }
      
      // Set workout state
      setWorkoutId(workoutId);
      setRoutineName(workout.routine_name);
      setWorkoutStarted(true);
      workoutStartTime.current = workout.date;
      setWorkoutDuration(workout.duration || 0);
      
      // Resume global workout context
      resumeWorkout();
      
      // Load workout exercises from database
      console.log("Loading workout exercises for routine:", workout.routine_id);
      
      // First check if we already have exercises recorded
      const existingExercises = await db.getAllAsync<{
        id: number;
        workout_id: number;
        exercise_id: number;
        sets_completed: number;
        notes: string;
      }>(
        `SELECT * FROM workout_exercises WHERE workout_id = ?`,
        [workoutId]
      );
      
      console.log("Found existing exercises:", existingExercises.length);
      
      // If we have workout_exercises entries, load them with their sets
      if (existingExercises.length > 0) {
        const loadedExercises: WorkoutExercise[] = [];
        
        for (const exerciseRecord of existingExercises) {
          // Get exercise details
          const exercise = await db.getFirstAsync<{
            id: number;
            name: string;
          }>(
            `SELECT id, name FROM exercises WHERE id = ?`,
            [exerciseRecord.exercise_id]
          );
          
          if (!exercise) continue;
          
          // Get routine exercise details for order and sets
          const routineExercise = await db.getFirstAsync<{
            id: number;
            order_num: number;
            sets: number;
          }>(
            `SELECT id, order_num, sets FROM routine_exercises 
             WHERE routine_id = ? AND exercise_id = ?`,
            [workout.routine_id, exerciseRecord.exercise_id]
          );
          
          if (!routineExercise) continue;
          
          // Get sets for this exercise
          const sets = await db.getAllAsync<Set>(
            `SELECT id, set_number, reps, weight, rest_time, completed, notes
             FROM sets
             WHERE workout_exercise_id = ?
             ORDER BY set_number`,
            [exerciseRecord.id]
          );
          
          console.log(`Exercise ${exercise.name}: found ${sets.length} sets`);
          
          // If we have fewer sets than expected, add the missing ones
          const allSets = [...sets];
          
          if (sets.length < routineExercise.sets) {
            for (let i = sets.length + 1; i <= routineExercise.sets; i++) {
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
          
          loadedExercises.push({
            routine_exercise_id: routineExercise.id,
            exercise_id: exercise.id,
            name: exercise.name,
            sets: Math.max(routineExercise.sets, allSets.length), // Use the larger value
            completedSets: exerciseRecord.sets_completed,
            exercise_order: routineExercise.order_num,
            sets_data: allSets,
            notes: exerciseRecord.notes || ''
          });
        }
        
        // Sort exercises by order
        loadedExercises.sort((a, b) => a.exercise_order - b.exercise_order);
        setExercises(loadedExercises);
        console.log(`Loaded ${loadedExercises.length} exercises with their sets`);
      } else {
        // If no exercises found, load from routine definition
        const exerciseResults = await db.getAllAsync<{
          id: number;
          exercise_id: number;
          name: string;
          sets: number;
          order_num: number;
        }>(
          `SELECT re.id, re.exercise_id, e.name, re.sets, re.order_num
           FROM routine_exercises re
           JOIN exercises e ON re.exercise_id = e.id
           WHERE re.routine_id = ?
           ORDER BY re.order_num`,
          [workout.routine_id]
        );
        
        console.log("Loading from routine definition, found:", exerciseResults.length);
        
        if (exerciseResults.length > 0) {
          const workoutExercises: WorkoutExercise[] = exerciseResults.map(exercise => ({
            routine_exercise_id: exercise.id,
            exercise_id: exercise.exercise_id,
            name: exercise.name,
            sets: exercise.sets,
            completedSets: 0,
            exercise_order: exercise.order_num,
            sets_data: Array.from({ length: exercise.sets }, (_, i) => ({
              set_number: i + 1,
              reps: 0,
              weight: 0,
              rest_time: 60,
              completed: false,
              notes: ''
            })),
            notes: ''
          }));
          
          setExercises(workoutExercises);
        }
      }
      
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
        
        // Get routine exercises
        const exerciseResults = await db.getAllAsync<Exercise>(
          `SELECT re.id as routine_exercise_id, e.id as exercise_id, e.name, re.sets, re.order_num as exercise_order
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
                        `UPDATE sets SET reps = ?, weight = ?, completed = ?, notes = ? WHERE id = ?`,
                        [set.reps, set.weight, set.completed ? 1 : 0, set.notes || '', set.id]
                      );
                    } else {
                      // Create new set
                      const result = await db.runAsync(
                        `INSERT INTO sets (workout_exercise_id, set_number, reps, weight, rest_time, completed, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                          workoutExerciseId, 
                          set.set_number, 
                          set.reps, 
                          set.weight, 
                          set.rest_time || 60, 
                          set.completed ? 1 : 0, 
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

  const renderExerciseItem = ({ item, index }: { item: WorkoutExercise, index: number }) => {
    // Calculate exercise completion percentage
    const totalSets = item.sets_data.length;
    const completedSets = item.sets_data.filter(set => set.completed).length;
    const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
    
    // Function to render set items with the correct exercise index
    const renderExerciseSetItem = (setItem: Set, setIndex: number) => {
      return (
        <TouchableOpacity 
          style={[
            styles.setItem, 
            { 
              backgroundColor: setItem.completed ? colors.success + '22' : colors.card,
              borderColor: setItem.completed ? colors.success : colors.border,
              borderWidth: 1.5,
            }
          ]}
          onPress={() => {
            if (workoutStarted) {
              openSetModal(index, setIndex);
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
        borderLeftColor: progress === 100 ? colors.success : colors.primary,
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
        
        <View style={[styles.setsContainer, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)' }]}>
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
                onPress={() => addSet(index)}
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
                  onPress={() => removeSet(index)}
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
              backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
            }]}
            placeholder="Add notes for this exercise..."
            placeholderTextColor={colors.subtext}
            value={item.notes}
            onChangeText={(text) => updateExerciseNotes(index, text)}
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
      setCurrentSet({...currentSet, reps: parseInt(value) || 0});
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

  // Function to save workout progress to the database
  const saveWorkoutProgress = async () => {
    if (!workoutId) return;
    
    try {
      const db = await getDatabase();
      
      // Update workout duration and notes
      const now = new Date();
      const durationMs = now.getTime() - new Date(workoutStartTime.current!).getTime();
      const durationSec = Math.floor(durationMs / 1000);
      
      await db.runAsync(
        'UPDATE workouts SET duration = ?, notes = ? WHERE id = ?',
        [durationSec, workoutNotes, workoutId]
      );
      
      // Save each exercise and its sets
      for (const exercise of exercises) {
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
                `UPDATE sets SET reps = ?, weight = ?, completed = ?, notes = ? WHERE id = ?`,
                [set.reps, set.weight, set.completed ? 1 : 0, set.notes || '', set.id]
              );
            } else {
              // Create new set
              const result = await db.runAsync(
                `INSERT INTO sets (workout_exercise_id, set_number, reps, weight, rest_time, completed, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                  workoutExerciseId, 
                  set.set_number, 
                  set.reps, 
                  set.weight, 
                  set.rest_time || 60, 
                  set.completed ? 1 : 0, 
                  set.notes || ''
                ]
              );
              
              // Update the set with its ID
              set.id = Number(result.lastInsertRowId);
            }
          }
        }
      }
      
      console.log('Workout progress saved successfully');
    } catch (error) {
      console.error('Error saving workout progress:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
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
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: routineName,
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          // Add minimize button in header
          headerRight: () => (
            workoutStarted ? (
              <TouchableOpacity 
                onPress={minimizeWorkoutAndNavigate}
                style={styles.minimizeButton}
              >
                <FontAwesome name="minus-circle" size={24} color={colors.primary} />
              </TouchableOpacity>
            ) : null
          ),
        }}
      />
      
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
              
              <TextInput
                style={[styles.workoutNotes, { 
                  color: colors.text, 
                  borderColor: colors.border,
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                placeholder="Add notes for this workout..."
                placeholderTextColor={colors.subtext}
                value={workoutNotes}
                onChangeText={setWorkoutNotes}
                multiline
              />
            </View>
          </View>
          
          <FlatList
            data={exercises}
            renderItem={renderExerciseItem}
            keyExtractor={(item) => `exercise-${item.routine_exercise_id}`}
            contentContainerStyle={styles.exerciseList}
          />
          
          <View style={[styles.finishButtonContainer, { 
            backgroundColor: theme === 'dark' ? 'rgba(18, 18, 18, 0.9)' : 'rgba(248, 248, 248, 0.9)',
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
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
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
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
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
              <Text style={[styles.inputLabel, { color: colors.text }]}>Rest Time (seconds)</Text>
              <TextInput
                style={[styles.input, { 
                  color: colors.text, 
                  borderColor: colors.border,
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                keyboardType="number-pad"
                value={currentSet.rest_time.toString()}
                onChangeText={(text) => setCurrentSet({...currentSet, rest_time: parseInt(text) || 0})}
                placeholder="60"
                placeholderTextColor={colors.subtext}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Notes</Text>
              <TextInput
                style={[styles.modalNotesInput, { 
                  color: colors.text, 
                  borderColor: colors.border,
                  backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
                }]}
                value={currentSet.notes}
                onChangeText={(text) => setCurrentSet({...currentSet, notes: text})}
                placeholder="Add notes for this set..."
                placeholderTextColor={colors.subtext}
                multiline
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
}); 