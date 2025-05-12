import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useWorkoutDatabase } from './useWorkoutDatabase';
import { useToast } from '@/context/ToastContext';
import { useWorkout } from '@/context/WorkoutContext';
import { WeightUnit, getWeightUnitPreference, kgToLb, lbToKg } from '@/app/(tabs)/profile';

// Types
export type Exercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  exercise_order: number;
  primary_muscle: string;
  category: string;
};

export type Set = {
  id?: number;
  set_number: number;
  reps: number;
  weight: number;
  rest_time: number;
  completed: boolean;
  training_type?: 'heavy' | 'moderate' | 'light';
  notes: string;
};

export type WorkoutExercise = {
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
  originalIndex?: number;
};

// Sort option for exercise display
export type SortOption = 'default' | 'muscle' | 'category';

export function useWorkoutSession(routineId?: string | string[], existingWorkoutId?: string | string[]) {
  // State for workout data
  const [routineName, setRoutineName] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [workoutId, setWorkoutId] = useState<number | null>(null);
  const [previousWorkoutData, setPreviousWorkoutData] = useState<Map<number, { reps: number, weight: number }[]>>(new Map());
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [workoutDuration, setWorkoutDuration] = useState(0);
  
  // Refs for timers and app state
  const workoutStartTime = useRef<number | null>(null);
  const workoutTimer = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastBackgroundTime = useRef<number | null>(null);
  const lastSaveAttempt = useRef<number>(0);
  const saveInProgress = useRef<boolean>(false);
  
  // App state tracking
  const [appStateEvents, setAppStateEvents] = useState<{background: number, foreground: number}>({
    background: 0,
    foreground: 0
  });

  // Get hooks
  const { showToast } = useToast();
  const { 
    startWorkout: startGlobalWorkout, 
    endWorkout: endGlobalWorkout,
    pauseWorkout: minimizeWorkout,
    activeWorkout,
    resumeWorkout
  } = useWorkout();
  
  const {
    isLoading: dbLoading, 
    saveWorkoutProgress: dbSaveWorkoutProgress, 
    refreshWorkoutDataFromDatabase: dbRefreshWorkoutData, 
    resumeExistingWorkout: dbResumeExistingWorkout, 
    loadRoutineExercises: dbLoadRoutineExercises,
    createNewWorkout: dbCreateNewWorkout,
    workoutStartTime: dbWorkoutStartTime
  } = useWorkoutDatabase();

  // Load weight unit preference
  useEffect(() => {
    const loadWeightUnitPreference = async () => {
      const unit = await getWeightUnitPreference();
      setWeightUnit(unit);
    };
    
    loadWeightUnitPreference();
  }, []);

  // Load routine exercises
  useEffect(() => {
    if (routineId) {
      loadRoutineExercises();
    }
    
    return () => {
      if (workoutTimer.current) {
        clearInterval(workoutTimer.current);
      }
    };
  }, [routineId]);

  // Check if resuming existing workout
  useEffect(() => {
    if (existingWorkoutId && !workoutStarted) {
      console.log("Resuming workout with ID:", existingWorkoutId);
      resumeExistingWorkout(Number(existingWorkoutId));
    }
  }, [existingWorkoutId]);

  // Periodically save workout progress
  useEffect(() => {
    let autoSaveTimer: number | null = null;
    
    if (workoutId && workoutStarted) {
      // Auto-save every 30 seconds instead of 2 minutes
      autoSaveTimer = setInterval(() => {
        // Only attempt to save if not currently saving and if it's been at least 10 seconds since last attempt
        // Reduced from 30 seconds to ensure more frequent saves
        const now = Date.now();
        if (!saveInProgress.current && now - lastSaveAttempt.current >= 10000) {
          console.log('Auto-saving workout progress...');
          saveWorkoutProgress(false).catch(error => {
            console.error('Auto-save failed:', error);
          });
        }
      }, 30 * 1000); // 30 seconds instead of 2 minutes
    }
    
    return () => {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
      }
    };
  }, [workoutId, workoutStarted]);

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
        handleRefreshFromDatabase(workoutId)
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

  // Utility functions
  const formatWeight = (weight: number): string => {
    if (weightUnit === 'lb') {
      // Display in pounds, converting from kg (stored value)
      return `${kgToLb(weight).toFixed(1)} lb`;
    }
    // Display in kg
    return `${weight} kg`;
  };

  const getStoredWeight = (inputWeight: number): number => {
    // Always store weights in kg in the database
    if (weightUnit === 'lb') {
      // Convert from pounds to kg for storage
      return lbToKg(inputWeight);
    }
    return inputWeight;
  };

  // Main functions
  const loadRoutineExercises = async () => {
    if (!routineId) return;
    
    setIsLoading(true);
    
    try {
      const id = parseInt(String(routineId), 10);
      const result = await dbLoadRoutineExercises(id);
      
      setRoutineName(result.routineName);
      setExercises(result.exercises);
      setPreviousWorkoutData(result.previousWorkoutData);
    } catch (error) {
      console.error('Error loading routine:', error);
      showToast('Failed to load routine', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const resumeExistingWorkout = async (workoutId: number) => {
    setIsLoading(true);
    
    try {
      const result = await dbResumeExistingWorkout(workoutId);
      
      // Set workout details
      setRoutineName(result.workoutData.routineName);
      setWorkoutId(workoutId);
      setWorkoutStarted(true);
      workoutStartTime.current = result.workoutData.workoutStartTime;
      
      setExercises(result.exercises);
      
      // Register with global workout context
      resumeWorkout();
      
    } catch (error) {
      console.error('Error resuming workout:', error);
      showToast('Failed to resume workout', 'error');
      return false;
    } finally {
      setIsLoading(false);
    }
    
    return true;
  };

  const startWorkout = async () => {
    if (!routineId) return false;
    
    // Check if there's already an active workout in the context
    if (activeWorkout.id) {
      // Show a toast notification to alert the user
      showToast('You already have a workout in progress. Please finish or cancel it before starting a new one.', 'error');
      return false;
    }
    
    setIsSaving(true);
    
    try {
      const id = parseInt(String(routineId), 10);
      const newWorkoutId = await dbCreateNewWorkout(id, routineName);
      
      setWorkoutId(newWorkoutId);
      setWorkoutStarted(true);
      
      // Register with global workout context
      startGlobalWorkout(newWorkoutId, routineName);
      
      showToast('Your workout has begun. Track your progress as you go!', 'success');
      return true;
    } catch (error) {
      console.error('Error starting workout:', error);
      showToast('Failed to start workout. Please try again.', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Save workout progress
  const saveWorkoutProgress = async (isUrgent: boolean = false): Promise<void> => {
    if (!workoutId) return;
    return dbSaveWorkoutProgress(workoutId, exercises, isUrgent);
  };

  // Save a set
  const saveSet = (exerciseIndex: number, updatedSet: Set) => {
    // Create a copy of the exercises array
    const updatedExercises = [...exercises];
    
    // Get the selected exercise
    const exercise = updatedExercises[exerciseIndex];
    
    // Find the set to update
    const setIndex = exercise.sets_data.findIndex(set => set.set_number === updatedSet.set_number);
    if (setIndex === -1) return;
    
    // Check if the set was previously incomplete and is now complete
    const wasCompleted = exercise.sets_data[setIndex].completed;
    const isNowCompleted = updatedSet.completed;
    
    // Update the set in the exercise
    exercise.sets_data[setIndex] = updatedSet;
    
    // If set was completed, increment the completedSets counter
    if (!wasCompleted && isNowCompleted) {
      exercise.completedSets += 1;
    } else if (wasCompleted && !isNowCompleted) {
      // If set was uncompleted, decrement the counter
      exercise.completedSets -= 1;
    }
    
    // Update the exercises state
    setExercises(updatedExercises);
    
    // Save to database
    saveWorkoutProgress();
    
    return updatedSet.rest_time;
  };

  // Add a new set to an exercise
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

  // Remove a set from an exercise
  const removeSet = (exerciseIndex: number) => {
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[exerciseIndex];
    
    // Don't allow removing sets if there's only one left
    if (exercise.sets_data.length <= 1) {
      showToast('Each exercise must have at least one set', 'error');
      return false;
    }
    
    // Check if the last set is completed
    const lastSet = exercise.sets_data[exercise.sets_data.length - 1];
    if (lastSet.completed) {
      showToast('Cannot remove a completed set. Only incomplete sets can be removed.', 'error');
      return false;
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
    return true;
  };

  // Update exercise notes
  const updateExerciseNotes = (exerciseIndex: number, notes: string) => {
    const updatedExercises = [...exercises];
    updatedExercises[exerciseIndex].notes = notes;
    setExercises(updatedExercises);
  };

  // Refresh workout data from database
  const handleRefreshFromDatabase = async (workoutId: number) => {
    try {
      const updatedExercises = await dbRefreshWorkoutData(workoutId, exercises);
      if (updatedExercises !== exercises) {
        setExercises(updatedExercises);
      }
    } catch (error) {
      console.error('Error refreshing workout data:', error);
    }
  };

  // Minimize workout and save progress
  const minimizeWorkoutAndSave = async () => {
    if (!workoutId) return;
    
    try {
      await saveWorkoutProgress(true);
      minimizeWorkout();
      return true;
    } catch (error) {
      console.error('Failed to save workout:', error);
      minimizeWorkout(); // Still minimize even if save failed
      return false;
    }
  };

  // Calculate progress percentage
  const calculateProgressPercentage = useCallback(() => {
    if (exercises.length === 0) return 0;
    
    const totalSets = exercises.reduce((sum, exercise) => sum + exercise.sets_data.length, 0);
    const completedSets = exercises.reduce((sum, exercise) => 
      sum + exercise.sets_data.filter(set => set.completed).length, 0);
    
    return totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  }, [exercises]);

  // Return object with all hooks and functions
  return {
    // State
    routineName,
    exercises,
    isLoading,
    isSaving,
    setIsSaving,
    workoutStarted,
    workoutId,
    previousWorkoutData,
    weightUnit,
    workoutStartTime,
    workoutDuration,
    
    // Methods
    formatWeight,
    getStoredWeight,
    loadRoutineExercises,
    startWorkout,
    saveWorkoutProgress,
    saveSet,
    addSet,
    removeSet,
    updateExerciseNotes,
    minimizeWorkoutAndSave,
    calculateProgressPercentage,
    setWorkoutDuration,
    
    // New method to add a new exercise to the current workout
    addExerciseToWorkout: async (exerciseId: number, exerciseName: string, primaryMuscle: string, category: string) => {
      if (!workoutId || !workoutStarted) {
        showToast('No active workout to add exercise to', 'error');
        return false;
      }
      
      try {
        // Create a new exercise entry to add to the current workout
        const newExercise: WorkoutExercise = {
          routine_exercise_id: -1, // Will be replaced with actual ID after saving
          exercise_id: exerciseId,
          name: exerciseName,
          sets: 3, // Default of 3 sets
          completedSets: 0,
          exercise_order: exercises.length + 1,
          primary_muscle: primaryMuscle,
          category: category,
          sets_data: [],
          notes: ''
        };
        
        // Create 3 default sets
        for (let i = 1; i <= 3; i++) {
          newExercise.sets_data.push({
            set_number: i,
            reps: 0,
            weight: 0,
            rest_time: 60, // Default 60 seconds rest
            completed: false,
            notes: ''
          });
        }
        
        // Add the new exercise to the state
        const updatedExercises = [...exercises, newExercise];
        setExercises(updatedExercises);
        
        // Save to database to persist the changes
        await saveWorkoutProgress(true);
        
        showToast(`${exerciseName} added to workout`, 'success');
        return true;
      } catch (error) {
        console.error('Error adding exercise to workout:', error);
        showToast('Failed to add exercise to workout', 'error');
        return false;
      }
    }
  };
} 