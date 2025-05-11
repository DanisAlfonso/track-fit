import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, FlatList, Animated, Dimensions, Platform, TouchableWithoutFeedback, Vibration, AppState, AppStateStatus } from 'react-native';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { getDatabase } from '@/utils/database';
import { useWorkout } from '@/context/WorkoutContext';
import { getWeightUnitPreference, kgToLb, lbToKg, WeightUnit } from '@/app/(tabs)/profile';
import { format } from 'date-fns';
import { useToast } from '@/context/ToastContext';
import { useTheme } from '@/context/ThemeContext';
import WorkoutTimer from '@/components/WorkoutTimer';
import * as Progress from 'react-native-progress'; // Import the progress library
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { SetBottomSheet } from '@/components/SetBottomSheet';
import Svg, { Circle, Path } from 'react-native-svg';
import { ExerciseCard } from '@/components/ExerciseCard';
import { StartWorkoutPrompt } from '@/components/StartWorkoutPrompt';
import { MuscleGroupPopup } from '@/components/MuscleGroupPopup';
import { SortOptionsModal } from '@/components/SortOptionsModal';
import { HeaderTitle } from '@/components/HeaderTitle';

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
  const { routineId, workoutId: existingWorkoutId, skipReady } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme(); // Keep getting theme
  const { showToast } = useToast();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme]; // Get colors this way
  const workoutStartTime = useRef<number | null>(null);
  const workoutTimer = useRef<NodeJS.Timeout | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const appStateRef = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);
  const lastSaveAttempt = useRef<number>(0);
  const saveInProgress = useRef<boolean>(false);
  const [appStateEvents, setAppStateEvents] = useState<{background: number, foreground: number}>({
    background: 0,
    foreground: 0
  });
  const [showingMenu, setShowingMenu] = useState<number | null>(null);

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
  // Add state for finish workout confirmation modal
  const [finishConfirmationVisible, setFinishConfirmationVisible] = useState(false);
  const [restTimerCountdown, setRestTimerCountdown] = useState(0);
  const [restTimerDuration, setRestTimerDuration] = useState(0);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState(false);
  const [restModalVisible, setRestModalVisible] = useState(false);
  const [activeRestExercise, setActiveRestExercise] = useState<string | null>(null);
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [musclePopupVisible, setMusclePopupVisible] = useState(false);
  const [showBottomSheetTimer, setShowBottomSheetTimer] = useState(true);
  
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

  useEffect(() => {
    loadRoutineExercises();
    return () => {
      if (workoutTimer.current) {
        clearInterval(workoutTimer.current);
      }
    };
  }, [routineId]);
  
  // Auto-start workout if skipReady is 'true'
  useEffect(() => {
    if (skipReady === 'true' && routineId && !workoutStarted && !existingWorkoutId && !isLoading) {
      startWorkout();
    }
  }, [skipReady, routineId, workoutStarted, existingWorkoutId, isLoading]);

  // Periodically save workout progress even if app stays in foreground
  useEffect(() => {
    let autoSaveTimer: number | null = null;
    
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
      
      // Create a map for quick lookup of routine exercises by exercise_id
      const routineExerciseMap = new Map();
      routineExercises.forEach(re => {
        routineExerciseMap.set(re.exercise_id, re);
      });
      
      // Create a map for saved workout exercises and their sets
      const workoutExerciseMap = new Map();
      for (const exerciseRecord of exerciseRecords) {
        // Get all sets for this workout exercise
        const sets = await db.getAllAsync<Set>(
          `SELECT id, set_number, reps, weight, rest_time, completed, training_type, notes
           FROM sets
           WHERE workout_exercise_id = ?
           ORDER BY set_number`,
          [exerciseRecord.id]
        );
        
        workoutExerciseMap.set(exerciseRecord.exercise_id, {
          record: exerciseRecord,
          sets: sets
        });
      }
      
      // Create workout exercises list using ALL routine exercises as the base
      const workoutExercises: WorkoutExercise[] = routineExercises.map(re => {
        // Check if we have saved data for this exercise
        const savedExercise = workoutExerciseMap.get(re.exercise_id);
        
        // Create default sets data
        let sets_data: Set[] = [];
        let completedSets = 0;
        let notes = '';
        
        if (savedExercise) {
          // Use saved notes if available
          notes = savedExercise.record.notes || '';
          completedSets = savedExercise.record.sets_completed || 0;
          
          // Create a full array of sets
          for (let i = 1; i <= re.sets; i++) {
            // Look for existing set
            const existingSet = savedExercise.sets.find((s: Set) => s.set_number === i);
            
            if (existingSet) {
              sets_data.push({
                ...existingSet,
                completed: !!existingSet.completed,
                notes: existingSet.notes || ''
              });
            } else {
              // Create a new default set
              sets_data.push({
                set_number: i,
                reps: 0,
                weight: 0,
                rest_time: 60,
                completed: false,
                notes: ''
              });
            }
          }
        } else {
          // No saved data - create default sets
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
        }
        
        return {
          routine_exercise_id: re.id,
          exercise_id: re.exercise_id,
          name: re.name,
          sets: re.sets,
          completedSets: completedSets,
          exercise_order: re.order_num,
          primary_muscle: re.primary_muscle,
          category: re.category,
          sets_data: sets_data,
          notes: notes
        };
      });
      
      // Sort workout exercises by order number
      workoutExercises.sort((a, b) => a.exercise_order - b.exercise_order);
      
      setExercises(workoutExercises);
      
      // Register with global workout context
      resumeWorkout();
      
    } catch (error) {
      console.error('Error resuming workout:', error);
      showToast('Failed to resume workout', 'error');
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
        showToast('Routine not found', 'error');
        router.back();
      }
    } catch (error) {
      console.error('Error loading routine exercises:', error);
      showToast('Failed to load routine exercises', 'error');
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
    
    // Check if there's already an active workout in the context
    if (activeWorkout.id) {
      // Show a toast notification to alert the user
      showToast('You already have a workout in progress. Please finish or cancel it before starting a new one.', 'error');
      
      // Navigate to the existing workout
      router.push({
        pathname: "/workout/start",
        params: { workoutId: activeWorkout.id }
      });
      return;
    }
    
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
      
      showToast('Your workout has begun. Track your progress as you go!', 'success');
    } catch (error) {
      console.error('Error starting workout:', error);
      showToast('Failed to start workout. Please try again.', 'error');
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

  const saveSet = (updatedSet: Set) => {
    if (selectedExercise === null) return;
    
    // Validate reps
    if (!updatedSet.reps || updatedSet.reps < 1) {
      showToast('Please enter at least 1 repetition for this set.', 'error');
      return;
    }
    
    // Validate weight directly from the state value
    if (updatedSet.weight <= 0) { 
      showToast(`Please enter a weight value greater than 0 ${weightUnit}.`, 'error');
      return;
    }
    
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[selectedExercise];
    
    // Find the set index
    const setIndex = exercise.sets_data.findIndex(s => s.set_number === updatedSet.set_number);
    if (setIndex === -1) return;
    
    // Store the weight in kg in the database, regardless of display preference
    const convertedWeight = getStoredWeight(updatedSet.weight);
    
    // Update the set
    exercise.sets_data[setIndex] = {
      ...updatedSet,
      weight: convertedWeight, // Store in kg
      completed: true
    };
    
    // Update completed sets count
    exercise.completedSets = exercise.sets_data.filter(s => s.completed).length;
    
    setExercises(updatedExercises);
    
    // Set flag to show timer in bottom sheet
    setShowBottomSheetTimer(true);
    
    // Save progress to database immediately after saving a set
    saveWorkoutProgress().catch(error => {
      console.error('Failed to save set data:', error);
    });
  };

  // Add this function to handle close events from the SetBottomSheet
  const handleSetBottomSheetClose = () => {
    console.log('Bottom sheet close requested');
    setSetModalVisible(false);
    // Reset the timer flag when modal is closed
    setShowBottomSheetTimer(false);
  };

  const updateExerciseNotes = (exerciseIndex: number, notes: string) => {
    const updatedExercises = [...exercises];
    updatedExercises[exerciseIndex].notes = notes;
    setExercises(updatedExercises);
  };

  const finishWorkout = async () => {
    if (!workoutId) return;
    
    // Show the confirmation modal instead of toast
    setFinishConfirmationVisible(true);
  };
  
  // Add new function to handle the confirmed workout completion
  const confirmFinishWorkout = async () => {
    setIsSaving(true);
    try {
      // First save all incomplete sets
      await saveWorkoutProgress(true);
      
      // Then mark the workout as complete
      await saveWorkoutCompletion();
      
      // Clear the active workout from global context
      endGlobalWorkout();
    } catch (error) {
      console.error('Error finishing workout:', error);
      showToast('Failed to save workout. Please try again.', 'error');
    } finally {
      setIsSaving(false);
      setFinishConfirmationVisible(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours > 0 ? `${hours}:` : ''}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Memoize the duration change handler
  const handleDurationChange = useCallback((duration: number) => {
    setWorkoutDuration(duration);
  }, []); // No dependencies needed as setWorkoutDuration is stable

  // Memoize the progress calculation (assuming it's defined elsewhere or inline)
  const calculateProgressPercentage = useCallback(() => {
    if (exercises.length === 0) return 0;
    
    const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets_data.length, 0);
    const completedSets = exercises.reduce((sum, exercise) => 
      sum + exercise.sets_data.filter(set => set.completed).length, 0);
    
    return totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  }, [exercises]);

  // Memoized function to render the circular progress
  const renderCircularProgress = useCallback(() => {
    const progress = calculateProgressPercentage();
    const progressValue = progress / 100; // Convert percentage to 0-1 range

    return (
      <View style={styles.circularProgressContainer}>
        <Progress.Circle 
          size={24} // Small size for header
          progress={progressValue}
          color={progress === 100 ? colors.success : colors.primary}
          unfilledColor={colors.border} // Use border color for unfilled track
          borderWidth={0} // No outer border
          thickness={3} // Thickness of the progress ring
          showsText={false} // Don't show text inside the circle itself
        />
        <Text style={[styles.circularProgressText, { color: colors.text }]}>
          {progress.toFixed(0)}%
        </Text>
      </View>
    );
  }, [calculateProgressPercentage, colors]); // Depends on the calculation and colors

  // Memoize the custom header title component function
  const renderHeaderTitle = useCallback(() => (
    <HeaderTitle
      workoutStarted={workoutStarted}
      workoutStartTime={workoutStartTime}
      onDurationChange={handleDurationChange}
      renderCircularProgress={renderCircularProgress()}
    />
  ), [workoutStarted, workoutStartTime, handleDurationChange, renderCircularProgress]);

  // Simplify the renderExerciseItem function to use the ExerciseCard component
  const renderExerciseItem = ({ item, index, muscleColor }: { item: WorkoutExercise, index: number, muscleColor?: string }) => {
    return (
      <ExerciseCard
        item={item}
        index={index}
        muscleColor={muscleColor}
        workoutStarted={workoutStarted}
        onOpenSetModal={openSetModal}
        onUpdateNotes={updateExerciseNotes}
        onAddSet={addSet}
        onRemoveSet={removeSet}
        weightUnit={weightUnit}
        showingMenu={showingMenu}
        onToggleMenu={setShowingMenu}
      />
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
    
    showToast(`Set ${nextSetNumber} added to ${exercise.name}`, 'success');
  };
  
  // Function to remove the last set from an exercise
  const removeSet = (exerciseIndex: number) => {
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[exerciseIndex];
    
    // Don't allow removing sets if there's only one left
    if (exercise.sets_data.length <= 1) {
      showToast('Each exercise must have at least one set', 'error');
      return;
    }
    
    // Check if the last set is completed
    const lastSet = exercise.sets_data[exercise.sets_data.length - 1];
    if (lastSet.completed) {
      showToast('Cannot remove a completed set. Only incomplete sets can be removed.', 'error');
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
    
    showToast(`Last set removed from ${exercise.name}`, 'success');
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
            'UPDATE workouts SET duration = ? WHERE id = ?',
            [durationSec, workoutId]
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
    showToast('Time to do your next set!', 'info');
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
        y: musclePositions.current[muscle], // Adjust offset as needed if header changes height
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
      
      // If app was in background for more than 5 minutes, just refresh the workout data
      // Do NOT end the workout automatically regardless of time spent in background
      if (lastBackgroundTime.current && workoutId && workoutStarted) {
        console.log('App was in background, refreshing workout data');
        
        // Recalculate workout duration based on actual start time
        if (workoutStartTime.current) {
          const elapsed = Math.floor((now - workoutStartTime.current) / 1000);
          setWorkoutDuration(elapsed);
        }
        
        // Reload workout data from database to ensure we have latest state
        refreshWorkoutDataFromDatabase(workoutId)
          .catch(error => {
            console.error('Failed to refresh workout data:', error);
          });
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
    return null; // Hide diagnostics panel completely
  };

  // Function to save workout completion details
  const saveWorkoutCompletion = async () => {
    if (!workoutId) return;
    
    try {
      const db = await getDatabase();
      
      // Update workout with completion time and duration
      await db.runAsync(
        'UPDATE workouts SET date = ?, duration = ?, completed_at = ? WHERE id = ?',
        [Date.now(), workoutDuration, Date.now(), workoutId]
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
      
      // Show success message without the button
      showToast('Great job! Your workout has been saved.', 'success', 3000);
      
      setTimeout(() => {
        router.replace(`/workout/${workoutId}`);
      }, 1000); 
    } catch (error) {
      console.error('Error saving workout completion:', error);
      showToast('Failed to save workout. Please try again.', 'error');
      throw error; // Re-throw to be caught by the caller
    }
  };

  // Add useEffect to handle tapping outside the menu to dismiss it
  useEffect(() => {
    const handlePressOutside = () => {
      if (showingMenu !== null) {
        setShowingMenu(null);
      }
    };

    // Add event listener for tap outside
    const subscription = Dimensions.addEventListener('change', handlePressOutside);

    return () => {
      subscription.remove();
    };
  }, [showingMenu]);

  // Updated function to handle sort option selection from menu
  const handleSortSelection = (option: SortOption) => {
    setSortOption(option);
    setOverflowMenuVisible(false);
    if (option === 'muscle') {
      // Open muscle popup if muscle sort is selected
      setMusclePopupVisible(true);
    } else {
      setMusclePopupVisible(false);
    }
  };

  // Function to handle muscle selection from the popup
  const handleMuscleSelect = (muscle: string) => {
    scrollToMuscle(muscle);
    setMusclePopupVisible(false);
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
          headerTitle: renderHeaderTitle,
          headerTintColor: colors.text,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setOverflowMenuVisible(true)}
              style={styles.headerMenuButton}
            >
              <FontAwesome5 name="ellipsis-v" size={18} color={colors.text} />
            </TouchableOpacity>
          ),
          // Change alignment to center
          headerTitleAlign: 'center',
        }}
      />

      <SortOptionsModal
        visible={overflowMenuVisible}
        sortOption={sortOption}
        onSelect={handleSortSelection}
        onClose={() => setOverflowMenuVisible(false)}
        colors={colors}
      />

      {/* --- Muscle Group Popup Modal --- */}
      <MuscleGroupPopup
        visible={musclePopupVisible}
        muscleGroups={muscleGroups}
        onSelect={handleMuscleSelect}
        onClose={() => setMusclePopupVisible(false)}
        getMuscleColor={getMuscleColor}
      />

      {!workoutStarted && skipReady !== 'true' ? (
        <StartWorkoutPrompt
          routineName={routineName}
          exerciseCount={exercises.length}
          setCount={exercises.reduce((sum, exercise) => sum + exercise.sets_data.length, 0)}
          isSaving={isSaving}
          onStart={startWorkout}
        />
      ) : (
        <>
          {/* workoutStatusContainer View is removed entirely */}

          {/* Conditional rendering for exercises based on sortOption */}
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

          {/* Finish Button remains */} 
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
                colors={[colors.primary, colors.secondary]}
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
      
      <SetBottomSheet 
        visible={setModalVisible}
        onClose={handleSetBottomSheetClose}
        onSave={saveSet}
        currentSet={currentSet}
        exerciseName={selectedExercise !== null ? exercises[selectedExercise].name : undefined}
        weightUnit={weightUnit}
        previousPerformance={selectedExercise !== null && 
          previousWorkoutData.has(exercises[selectedExercise].routine_exercise_id) && 
          previousWorkoutData.get(exercises[selectedExercise].routine_exercise_id)![selectedSetIndex] ?
          previousWorkoutData.get(exercises[selectedExercise].routine_exercise_id)![selectedSetIndex] :
          undefined
        }
        showRestTimer={showBottomSheetTimer}
      />
      
      {renderDiagnostics()}
      
      {/* Add the ConfirmationModal */}
      <ConfirmationModal
        visible={finishConfirmationVisible}
        title="Finish Workout"
        message="Are you sure you want to finish your workout? All progress will be saved."
        confirmText="Finish"
        cancelText="Cancel"
        confirmStyle="primary"
        icon="check-circle"
        onConfirm={confirmFinishWorkout}
        onCancel={() => setFinishConfirmationVisible(false)}
      />
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
    marginLeft: 12, 
    maxWidth: 100, 
  },
  progressBarBackground: {
    height: 5, // Smaller height
    backgroundColor: 'rgba(120, 120, 128, 0.2)', // Neutral background
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 1, // Smaller margin
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10, // Smaller text
    fontWeight: '500',
    textAlign: 'right',
    lineHeight: 12, // Adjust line height
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
    paddingHorizontal: 16,
    paddingTop: 16, // Add padding if needed after removing header elements
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
  progressCircleContainer: {
    width: 36,
    height: 36,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Keep these styles for backwards compatibility
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
    borderRadius: 12,
    marginRight: 10,
    width: 100,
    height: 85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  completedGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  setContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  setHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
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
  trainingTypeTag: {
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    borderLeftWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  trainingTypeTagText: {
    fontSize: 11,
    fontWeight: '600',
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
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  historyIcon: {
    marginRight: 6,
  },
  historyButtonText: {
    fontWeight: '600',
    fontSize: 14,
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
    borderRadius: 8,
    marginLeft: 4,
    shadowColor: 'rgba(0,0,0,0.1)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 2,
    elevation: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  cardMenuContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  cardMenuButton: {
    padding: 8,
  },
  menuPopup: {
    position: 'absolute',
    top: 35,
    right: 0,
    width: 150,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  menuIcon: {
    marginRight: 10,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Add styles for header menu button
  headerMenuButton: {
    marginRight: 16,
    padding: 8,
  },

  // Add styles for the new workout status container
  workoutStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  overflowMenu: {
    position: 'absolute',
    top: (Platform.OS === 'ios' ? 44 : 0) + 5, // Adjust based on actual header height
    right: 10,
    width: 200,
    borderRadius: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
    opacity: 0.7,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 16,
  },

  // Styles for Muscle Group Popup
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  musclePopup: {
    width: '85%',
    maxHeight: '70%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  musclePopupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    // Use colors.border here
  },
  musclePopupItemText: {
    fontSize: 16,
    marginLeft: 10,
  },
  popupCloseButton: {
    marginTop: 15,
    paddingVertical: 10,
    alignItems: 'center',
  },
  popupCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Add styles for the custom header title container
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // Remove flex: 1 and marginRight, let React Navigation handle centering
  },
  
  // Styles for the circular progress in the header
  circularProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12, // Space between timer and progress
  },
  circularProgressText: {
    fontSize: 11, // Small text
    fontWeight: '500',
    marginLeft: 5, // Space between circle and text
  },

  // Header specific progress bar styles
  headerProgressBarContainer: {
    flex: 1, // Allow it to take available space
    marginLeft: 12, 
    maxWidth: 100, // Keep it relatively small in header
  },
  headerProgressBarBackground: {
    height: 5, // Smaller height for header
    backgroundColor: 'rgba(120, 120, 128, 0.2)', 
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 1, 
  },
  headerProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  headerProgressText: {
    fontSize: 12, 
    marginLeft: 8,
  },

});