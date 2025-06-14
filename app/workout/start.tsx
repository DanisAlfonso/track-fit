import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, FlatList, Animated, Dimensions, Platform, TouchableWithoutFeedback, Vibration, AppState, AppStateStatus } from 'react-native';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useWorkoutDatabase } from '@/hooks/useWorkoutDatabase';
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
import { FinishWorkoutModal } from '@/components/FinishWorkoutModal';
import { RestTimer } from '@/components/RestTimer';
import { useWorkoutSession, WorkoutExercise, Set, SortOption } from '@/hooks/useWorkoutSession';
import { AddExerciseSheet } from '@/components/AddExerciseSheet';

// Import new components and utils
import { DefaultExerciseList } from '@/components/workout/DefaultExerciseList';
import { GroupedExerciseList } from '@/components/workout/GroupedExerciseList';
import { formatDuration, getMuscleColor } from '@/utils/workoutUtils';

// Add TouchedFields type to track field interaction
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
  const [showingMenu, setShowingMenu] = useState<number | null>(null);
  
  // New state for exercise picker sheet
  const [addExerciseSheetVisible, setAddExerciseSheetVisible] = useState(false);

  // Use the workout session hook
  const {
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
    saveDismissedRestTimer,
    loadDismissedRestTimer,
    addExerciseToWorkout
  } = useWorkoutSession(routineId, existingWorkoutId);
  
  // Get workout context functions
  const { pauseWorkout } = useWorkout();

  // UI state
  const [selectedExercise, setSelectedExercise] = useState<number | null>(null);
  const [setModalVisible, setSetModalVisible] = useState(false);
  const [currentSet, setCurrentSet] = useState<Set>({
    set_number: 1,
    reps: 0,
    weight: 0,
    rest_time: 60, // Default 60 seconds rest
    completed: false,
    notes: '',
    training_type: 'moderate' // Default training type
  });
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({ reps: false, weight: false });
  const [selectedSetIndex, setSelectedSetIndex] = useState<number>(0);
  const [sortOption, setSortOption] = useState<SortOption>('default');
  
  // Rest timer related state
  const [isResting, setIsResting] = useState(false);
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const [activeRestExercise, setActiveRestExercise] = useState<string | null>(null);
  const [showBottomSheetTimer, setShowBottomSheetTimer] = useState(true);
  const [finishConfirmationVisible, setFinishConfirmationVisible] = useState(false);
  const [overflowMenuVisible, setOverflowMenuVisible] = useState(false);
  const [musclePopupVisible, setMusclePopupVisible] = useState(false);
  
  // Add state for dismissed rest timer
  const [dismissedRestTimer, setDismissedRestTimer] = useState<{
    exerciseName: string;
    duration: number;
    startTime: number;
    originalDuration: number;
  } | null>(null);
  
  // Add state to track if we're resuming a timer
  const [resumingTimer, setResumingTimer] = useState(false);
  
  // Add state to track original duration for resumed timers
  const [resumedTimerOriginalDuration, setResumedTimerOriginalDuration] = useState<number | undefined>(undefined);
  
  // Animation value for floating rest button
  const floatingRestAnimation = useRef(new Animated.Value(0)).current;
  
  // Replace the scrollToMuscle function to use a callback instead of direct ref access
  const [scrollToMuscleCallback, setScrollToMuscleCallback] = useState<((muscle: string) => void) | null>(null);
  
  // Real-time countdown for dismissed timer
  const [dismissedTimerRemaining, setDismissedTimerRemaining] = useState(0);
  
  // Auto-start workout if skipReady is 'true'
  useEffect(() => {
    if (skipReady === 'true' && routineId && !workoutStarted && !existingWorkoutId && !isLoading) {
      startWorkout();
    }
  }, [skipReady, routineId, workoutStarted, existingWorkoutId, isLoading]);

  // Load dismissed rest timer state when workout is started or resumed
  useEffect(() => {
    if (workoutStarted && workoutId) {
      loadDismissedRestTimer().then(timerData => {
        if (timerData) {
          // Check if the timer is still valid (not expired)
          const elapsed = Math.floor((Date.now() - timerData.startTime) / 1000);
          const remaining = Math.max(0, timerData.duration - elapsed);
          
          if (remaining > 0) {
            // Update the timer with current remaining time
            setDismissedRestTimer({
              ...timerData,
              duration: remaining,
              startTime: Date.now()
            });
          } else {
            // Timer has expired, clear it from database
            saveDismissedRestTimer(null);
          }
        }
      }).catch(error => {
        console.error('Error loading dismissed rest timer:', error);
      });
    }
  }, [workoutStarted, workoutId]);

  // Separate effect to handle animation when dismissedRestTimer changes
  useEffect(() => {
    if (dismissedRestTimer) {
      // Animate in the floating button
      Animated.spring(floatingRestAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      // Reset animation value when timer is cleared
      floatingRestAnimation.setValue(0);
    }
  }, [dismissedRestTimer]);

  // When leaving the screen, handle minimization
  useEffect(() => {
    return () => {
      // Only minimize if we have an active workout and we're not finishing
      if (workoutId && workoutStarted) {
        minimizeWorkoutAndSave();
      }
      
      // Clean up animation
      floatingRestAnimation.removeAllListeners();
    };
  }, [workoutId, workoutStarted]);

  const openSetModal = (exerciseIndex: number, setIndex: number) => {
    // Save current exercise and set
    setSelectedExercise(exerciseIndex);
    setSelectedSetIndex(setIndex);
    
    const exercise = exercises[exerciseIndex];
    
    // Check if there's a next exercise to show in the rest timer
    let nextExerciseName = null;
    
    if (setIndex < exercise.sets_data.length - 1) {
      // If there are more sets in this exercise, the next exercise is the same
      nextExerciseName = exercise.name;
    } else if (exerciseIndex < exercises.length - 1) {
      // If this is the last set of this exercise, get the next exercise
      nextExerciseName = exercises[exerciseIndex + 1].name;
    }
    
    setActiveRestExercise(nextExerciseName);
    
    // Get the current set data
    const setData = exercise.sets_data[setIndex];
    
    // If set is already completed, just edit it without showing timer afterward
    if (setData.completed) {
      setShowBottomSheetTimer(false);
    } else {
      setShowBottomSheetTimer(true);
    }
    
    // Pre-populate with previous performance data if available and current set is empty
    let updatedSetData = { ...setData };
    
    if (!setData.completed && setData.reps === 0 && setData.weight === 0) {
      // Check if we have previous workout data for this exercise
      if (previousWorkoutData.has(exercise.routine_exercise_id)) {
        const prevSets = previousWorkoutData.get(exercise.routine_exercise_id)!;
        if (prevSets.length > setIndex) {
          // Use the corresponding set from previous workout
          const prevSetData = prevSets[setIndex];
          updatedSetData = {
            ...setData,
            reps: prevSetData.reps,
            weight: prevSetData.weight
          };
        } else if (prevSets.length > 0) {
          // If no corresponding set, use the last available set from previous workout
          const lastPrevSet = prevSets[prevSets.length - 1];
          updatedSetData = {
            ...setData,
            reps: lastPrevSet.reps,
            weight: lastPrevSet.weight
          };
        }
      }
    }
    
    setCurrentSet(updatedSetData);
    
    // Show the set modal
    setSetModalVisible(true);
  };

  const handleSaveSet = (updatedSet: Set) => {
    if (selectedExercise === null) return;
    
    // Save the set using the hook function
    const restTime = saveSet(selectedExercise, updatedSet);
    
    // Start rest timer if set is completed and has rest time
    if (updatedSet.completed && restTime && restTime > 0) {
      startRestTimer(restTime);
    }
  };

  // Handle rest timer dismissal
  const handleRestTimerDismissed = (exerciseName: string, remainingTime: number) => {
    const timerData = {
      exerciseName,
      duration: remainingTime, // Store the remaining time, not the original duration
      startTime: Date.now(),
      originalDuration: currentSet.rest_time // Store the original duration from currentSet
    };
    
    setDismissedRestTimer(timerData);
    
    // Save to database
    saveDismissedRestTimer(timerData).catch(error => {
      console.error('Error saving dismissed rest timer:', error);
    });
  };

  // Handle resuming dismissed rest timer
  const resumeRestTimer = () => {
    if (!dismissedRestTimer) return;
    
    const remaining = dismissedTimerRemaining;
    
    if (remaining > 0) {
      // Resume with remaining time - start standalone timer directly
      setCurrentSet(prev => ({ 
        ...prev, 
        rest_time: remaining
      }));
      setActiveRestExercise(dismissedRestTimer.exerciseName);
      setResumedTimerOriginalDuration(dismissedRestTimer.originalDuration);
      setResumingTimer(true);
      setIsResting(true);
      // Don't open the modal, just start the timer
    }
    
    setDismissedRestTimer(null);
    
    // Clear from database
    saveDismissedRestTimer(null).catch(error => {
      console.error('Error clearing dismissed rest timer:', error);
    });
  };

  // Clear dismissed timer when it expires
  useEffect(() => {
    if (!dismissedRestTimer) return;
    
    const timer = setTimeout(() => {
      setDismissedRestTimer(null);
      
      // Clear from database when timer expires
      saveDismissedRestTimer(null).catch(error => {
        console.error('Error clearing expired dismissed rest timer:', error);
      });
    }, dismissedRestTimer.duration * 1000);
    
    return () => clearTimeout(timer);
  }, [dismissedRestTimer]);

  // Real-time countdown for dismissed timer
  useEffect(() => {
    if (!dismissedRestTimer) {
      setDismissedTimerRemaining(0);
      return;
    }
    
    const updateRemaining = () => {
      const elapsed = Math.floor((Date.now() - dismissedRestTimer.startTime) / 1000);
      const remaining = Math.max(0, dismissedRestTimer.duration - elapsed);
      setDismissedTimerRemaining(remaining);
      
      if (remaining <= 0) {
        setDismissedRestTimer(null);
        
        // Clear from database when timer reaches 0
        saveDismissedRestTimer(null).catch(error => {
          console.error('Error clearing expired dismissed rest timer:', error);
        });
      }
    };
    
    // Update immediately
    updateRemaining();
    
    // Update every second
    const interval = setInterval(updateRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [dismissedRestTimer]);

  // Handle closing the set modal
  const handleSetBottomSheetClose = () => {
    setSetModalVisible(false);
    setIsResting(false);
  };

  const finishWorkout = async () => {
    // Make sure to save progress before finishing
    await saveWorkoutProgress(true);
    
    // Show the confirmation modal
    setFinishConfirmationVisible(true);
  };

  // Memoize the duration change handler
  const handleDurationChange = useCallback((duration: number) => {
    setWorkoutDuration(duration);
  }, []); // No dependencies needed as setWorkoutDuration is stable

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
  const renderExerciseItem = useCallback(({ item, index, muscleColor }: { item: WorkoutExercise; index: number; muscleColor?: string }) => {
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
  }, [workoutStarted, weightUnit, showingMenu, setShowingMenu, openSetModal, updateExerciseNotes, addSet, removeSet]);

  // Modify minimizeWorkoutAndNavigate to save data before minimizing
  const minimizeWorkoutAndNavigate = async () => {
    if (!workoutId) return;
    
    minimizeWorkoutAndSave().then(() => {
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
  
  // Start the rest timer with the specified duration
  const startRestTimer = (duration: number) => {
    // No need to control the visibility here as the SetBottomSheet handles the timer
    setIsResting(true);
  };
  
  // Skip the rest timer - we don't need to control visibility here either
  const skipRestTimer = () => {
    setIsResting(false);
  };
  
  // Add extra time to the rest timer
  const addRestTime = (seconds: number) => {
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
        // No need to call setExercises, as this is managed by the hook
      }
    }
    
    // Save the updated rest time to the database
    saveWorkoutProgress().catch(error => {
      console.error('Failed to save updated rest time:', error);
    });
  };

  // Go back to simpler approach with ScrollView reference
  const muscleScrollViewRef = useRef<ScrollView>(null);
  
  // References to position of each muscle group section
  const musclePositions = useRef<Record<string, number>>({});
  
  // Function to measure and store position of muscle groups
  const measureMusclePosition = (muscle: string, y: number) => {
    musclePositions.current[muscle] = y;
  };
  
  // Function to scroll to a specific muscle group
  const scrollToMuscle = (muscle: string) => {
    console.log(`Attempting to scroll to ${muscle}, position: ${musclePositions.current[muscle]}`);
    
    if (muscleScrollViewRef.current && musclePositions.current[muscle] !== undefined) {
      // Add console for debugging
      console.log(`Scrolling to ${muscle} at position ${musclePositions.current[muscle]}`);
      
      // Add a small delay to ensure UI is ready
      setTimeout(() => {
        muscleScrollViewRef.current?.scrollTo({
          y: musclePositions.current[muscle],
          animated: true,
        });
      }, 100);
    } else {
      console.log('Cannot scroll: ScrollView ref or position undefined');
      console.log('ScrollView ref:', muscleScrollViewRef.current);
      console.log('Position:', musclePositions.current[muscle]);
    }
  };
  
  // Function to handle muscle selection from the popup
  const handleMuscleSelect = (muscle: string) => {
    setMusclePopupVisible(false);
    
    // Add a small delay to ensure the popup is closed before scrolling
    setTimeout(() => {
      scrollToMuscle(muscle);
    }, 100);
  };

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

  // Function to handle adding an exercise to the workout
  const handleAddExercise = (exerciseId: number, name: string, primaryMuscle: string, category: string) => {
    addExerciseToWorkout(exerciseId, name, primaryMuscle, category);
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
        onAddExercise={() => setAddExerciseSheetVisible(true)}
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

      {/* --- Add Exercise Sheet --- */}
      <AddExerciseSheet
        visible={addExerciseSheetVisible}
        onClose={() => setAddExerciseSheetVisible(false)}
        onSelectExercise={handleAddExercise}
        colors={colors}
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
          {/* Conditionally render exercise list based on sort option */}
          {sortOption === 'default' ? (
            <DefaultExerciseList 
              exercises={exercises}
              renderExerciseItem={renderExerciseItem}
            />
          ) : (
            <GroupedExerciseList
              exercises={exercises}
              groupingType={sortOption}
              renderExerciseItem={renderExerciseItem}
              getMuscleColor={getMuscleColor}
              onMeasureGroupPosition={measureMusclePosition}
              colors={colors}
              scrollViewRef={muscleScrollViewRef}
            />
          )}

          {/* Add Exercise Button Container - Now only contains Finish Workout */}
          <View style={[styles.addExerciseButtonContainer, { 
            backgroundColor: currentTheme === 'dark' ? 'rgba(18, 18, 18, 0.9)' : 'rgba(248, 248, 248, 0.9)',
            borderTopColor: colors.border
          }]}>
            <TouchableOpacity 
              style={styles.finishButtonFullWidth}
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

          {/* Floating Resume Rest Button */}
          {dismissedRestTimer && (
            <Animated.View style={[
              styles.floatingRestButtonContainer,
              {
                transform: [
                  {
                    translateY: floatingRestAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [100, 0],
                    }),
                  },
                  {
                    scale: floatingRestAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
                opacity: floatingRestAnimation,
              }
            ]}>
              <TouchableOpacity
                style={[styles.floatingRestButton, { 
                  backgroundColor: colors.primary,
                  shadowColor: colors.primary,
                }]}
                onPress={resumeRestTimer}
                activeOpacity={0.8}
              >
                <View style={styles.floatingRestContent}>
                  <View style={styles.floatingRestIconSection}>
                    <FontAwesome5 name="play" size={16} color="white" />
                    <View style={styles.floatingRestProgressRing}>
                      <Progress.Circle 
                        size={32}
                        progress={dismissedTimerRemaining / dismissedRestTimer.originalDuration}
                        color="white"
                        unfilledColor="rgba(255, 255, 255, 0.3)"
                        borderWidth={0}
                        thickness={2}
                        showsText={false}
                      />
                      <Text style={styles.floatingRestProgressText}>
                        {dismissedTimerRemaining}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.floatingRestTextSection}>
                    <Text style={styles.floatingRestTitle}>Resume Rest</Text>
                    <Text style={styles.floatingRestSubtitle}>
                      {dismissedRestTimer.exerciseName} • {Math.floor(dismissedTimerRemaining / 60)}:{(dismissedTimerRemaining % 60).toString().padStart(2, '0')}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Standalone Rest Timer for resumed timers */}
          {isResting && !setModalVisible && (
            <RestTimer
              key={resumingTimer ? `resumed-timer-${currentSet.rest_time}` : 'standalone-timer'}
              visible={true}
              duration={currentSet.rest_time}
              isResumed={resumingTimer}
              originalDuration={resumedTimerOriginalDuration}
              onComplete={() => {
                setIsResting(false);
                setResumingTimer(false);
                setResumedTimerOriginalDuration(undefined);
                showToast('Rest time complete!', 'success');
              }}
              onSkip={() => {
                setIsResting(false);
                setResumingTimer(false);
                setResumedTimerOriginalDuration(undefined);
              }}
              onDismiss={(remainingTime) => {
                // Handle dismissal - same logic as before
                if (activeRestExercise) {
                  handleRestTimerDismissed(activeRestExercise, remainingTime);
                }
                setIsResting(false);
                setResumingTimer(false);
                setResumedTimerOriginalDuration(undefined);
              }}
              onAddTime={(seconds) => {
                setCurrentSet(prev => ({
                  ...prev,
                  rest_time: prev.rest_time + seconds
                }));
              }}
              exerciseName={activeRestExercise || undefined}
            />
          )}
        </>
      )}
      
      <SetBottomSheet 
        visible={setModalVisible}
        onClose={handleSetBottomSheetClose}
        onSave={handleSaveSet}
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
        nextExerciseName={activeRestExercise || undefined}
        onRestTimerDismissed={handleRestTimerDismissed}
      />
      
      {/* Use the FinishWorkoutModal component */}
      <FinishWorkoutModal
        visible={finishConfirmationVisible}
        onClose={() => setFinishConfirmationVisible(false)}
        workoutId={workoutId}
        workoutDuration={workoutDuration}
        exercises={exercises}
        isSaving={isSaving}
        onSavingChange={setIsSaving}
        onSaveProgress={saveWorkoutProgress}
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
  addExerciseButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addExerciseButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
    marginRight: 8,
  },
  addExerciseButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  addExerciseButtonIcon: {
    marginRight: 8,
  },
  addExerciseButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  finishButton: {
    flex: 1,
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
    padding: 14,
  },
  finishButtonIcon: {
    marginRight: 8,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Add styles for header menu button
  headerMenuButton: {
    marginRight: 16,
    padding: 8,
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
  // Update to full width finish button
  finishButtonFullWidth: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  // Floating Resume Rest Button styles
  floatingRestButtonContainer: {
    position: 'absolute',
    bottom: 100, // Position above the finish button
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  floatingRestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    maxWidth: 320,
    width: '100%',
  },
  floatingRestContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  floatingRestIconSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  floatingRestProgressRing: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  floatingRestProgressText: {
    position: 'absolute',
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  floatingRestTextSection: {
    flex: 1,
  },
  floatingRestTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginBottom: 2,
  },
  floatingRestSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});