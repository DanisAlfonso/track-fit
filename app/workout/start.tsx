import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, FlatList } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';

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
  const { routineId } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const workoutStartTime = useRef<number | null>(null);
  const workoutTimer = useRef<NodeJS.Timeout | null>(null);
  const [workoutDuration, setWorkoutDuration] = useState(0);

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
      Alert.alert('Invalid Input', 'Please enter a weight value greater than 0 kg.');
      return;
    }
    
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[selectedExercise];
    
    // Find the set index
    const setIndex = exercise.sets_data.findIndex(s => s.set_number === currentSet.set_number);
    if (setIndex === -1) return;
    
    // Update the set
    exercise.sets_data[setIndex] = {
      ...currentSet,
      completed: true
    };
    
    // Update completed sets count
    exercise.completedSets = exercise.sets_data.filter(s => s.completed).length;
    
    setExercises(updatedExercises);
    setSetModalVisible(false);
    
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
                // Insert workout exercise
                const exerciseResult = await db.runAsync(
                  'INSERT INTO workout_exercises (workout_id, exercise_id, sets_completed, notes) VALUES (?, ?, ?, ?)',
                  [workoutId, exercise.exercise_id, exercise.completedSets, exercise.notes]
                );
                
                const workoutExerciseId = exerciseResult.lastInsertRowId;
                
                // Insert sets
                for (const set of exercise.sets_data) {
                  if (set.completed) {
                    await db.runAsync(
                      'INSERT INTO sets (workout_exercise_id, set_number, reps, weight, rest_time, completed, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                      [workoutExerciseId, set.set_number, set.reps, set.weight, set.rest_time, 1, set.notes]
                    );
                  }
                }
              }
              
              Alert.alert('Workout Completed', 'Great job! Your workout has been saved.', [
                { 
                  text: 'OK', 
                  onPress: () => {
                    // Navigate directly to the History tab
                    router.replace('/(tabs)/workouts');
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

  const renderSetItem = ({ item, index }: { item: Set, index: number }) => (
    <TouchableOpacity 
      style={[
        styles.setItem, 
        { 
          backgroundColor: item.completed ? colors.success : colors.card,
          borderColor: colors.border
        }
      ]}
      onPress={() => openSetModal(index, index)}
      disabled={!workoutStarted}
    >
      <Text style={[styles.setNumber, { color: colors.text }]}>Set {item.set_number}</Text>
      {item.completed ? (
        <View style={styles.setDetails}>
          <Text style={[styles.setDetail, { color: colors.text }]}>
            {item.reps} reps @ {item.weight} kg
          </Text>
          {item.notes ? (
            <Text style={[styles.setNotes, { color: colors.subtext }]} numberOfLines={1}>
              {item.notes}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.setDetail, { color: colors.subtext }]}>Tap to complete</Text>
      )}
    </TouchableOpacity>
  );

  // Function to handle input changes and track which fields have been touched
  const handleInputChange = (field: keyof TouchedFields, value: string) => {
    setTouchedFields(prev => ({ ...prev, [field]: true }));
    
    if (field === 'reps') {
      setCurrentSet({...currentSet, reps: parseInt(value) || 0});
    } else if (field === 'weight') {
      setCurrentSet({...currentSet, weight: parseFloat(value) || 0});
    }
  };

  const renderExerciseItem = ({ item, index }: { item: WorkoutExercise, index: number }) => (
    <View style={[styles.exerciseItem, { backgroundColor: colors.card }]}>
      <View style={styles.exerciseHeader}>
        <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.exerciseSets, { color: colors.subtext }]}>
          Sets: {item.completedSets}/{item.sets_data.length}
        </Text>
      </View>
      
      <FlatList
        data={item.sets_data}
        renderItem={({ item: setItem, index: setIndex }) => (
          <TouchableOpacity 
            style={[
              styles.setItem, 
              { 
                backgroundColor: setItem.completed ? colors.success : colors.card,
                borderColor: colors.border
              }
            ]}
            onPress={() => openSetModal(index, setIndex)}
            disabled={!workoutStarted}
          >
            <Text style={[styles.setNumber, { color: colors.text }]}>Set {setItem.set_number}</Text>
            {setItem.completed ? (
              <View style={styles.setDetails}>
                <Text style={[styles.setDetail, { color: colors.text }]}>
                  {setItem.reps} reps @ {setItem.weight} kg
                </Text>
                {setItem.notes ? (
                  <Text style={[styles.setNotes, { color: colors.subtext }]} numberOfLines={1}>
                    {setItem.notes}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={[styles.setDetail, { color: colors.subtext }]}>Tap to complete</Text>
            )}
            
            {/* Show previous performance data if available */}
            {!setItem.completed && previousWorkoutData.has(item.routine_exercise_id) && previousWorkoutData.get(item.routine_exercise_id)![setIndex] && (
              <View style={styles.previousPerformance}>
                <Text style={[styles.previousPerformanceText, { color: colors.subtext }]}>
                  Last: {previousWorkoutData.get(item.routine_exercise_id)![setIndex].reps} reps @ {previousWorkoutData.get(item.routine_exercise_id)![setIndex].weight} kg
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        keyExtractor={(set) => `set-${set.set_number}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.setsList}
      />
      
      {workoutStarted && (
        <View style={styles.setsManagementContainer}>
          <TouchableOpacity
            style={[styles.setManagementButton, { backgroundColor: colors.primary }]}
            onPress={() => addSet(index)}
          >
            <FontAwesome name="plus" size={14} color="#fff" style={styles.setManagementIcon} />
            <Text style={styles.setManagementButtonText}>Add Set</Text>
          </TouchableOpacity>
          
          {item.sets_data.length > 1 && (
            <TouchableOpacity
              style={[styles.setManagementButton, { backgroundColor: colors.error }]}
              onPress={() => removeSet(index)}
            >
              <FontAwesome name="minus" size={14} color="#fff" style={styles.setManagementIcon} />
              <Text style={styles.setManagementButtonText}>Remove Set</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <View style={styles.exerciseNotes}>
        <TextInput
          style={[styles.notesInput, { color: colors.text, borderColor: colors.border }]}
          placeholder="Add notes for this exercise..."
          placeholderTextColor={colors.subtext}
          value={item.notes}
          onChangeText={(text) => updateExerciseNotes(index, text)}
          multiline
        />
      </View>
    </View>
  );

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
    
    Alert.alert('Set Removed', `Last set removed from ${exercise.name}`);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Stack.Screen 
          options={{
            title: "Start Workout",
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading workout...</Text>
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
        }}
      />
      
      <View style={styles.header}>
        {workoutStarted ? (
          <View style={styles.workoutInfo}>
            <Text style={[styles.workoutDuration, { color: colors.text }]}>
              Duration: {formatDuration(workoutDuration)}
            </Text>
            <TextInput
              style={[styles.workoutNotes, { color: colors.text, borderColor: colors.border }]}
              placeholder="Add notes for this workout..."
              placeholderTextColor={colors.subtext}
              value={workoutNotes}
              onChangeText={setWorkoutNotes}
              multiline
            />
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.startButton, { backgroundColor: colors.primary }]}
            onPress={startWorkout}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.startButtonText}>Start Workout</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      
      <FlatList
        data={exercises}
        renderItem={renderExerciseItem}
        keyExtractor={(item) => `exercise-${item.routine_exercise_id}`}
        contentContainerStyle={styles.exerciseList}
      />
      
      {workoutStarted && (
        <TouchableOpacity 
          style={[styles.finishButton, { backgroundColor: colors.success }]}
          onPress={finishWorkout}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.finishButtonText}>Finish Workout</Text>
          )}
        </TouchableOpacity>
      )}
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={setModalVisible}
        onRequestClose={() => setSetModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedExercise !== null ? exercises[selectedExercise].name : ''} - Set {currentSet.set_number}
              </Text>
              <TouchableOpacity 
                onPress={() => setSetModalVisible(false)}
                hitSlop={{ top: 20, right: 20, bottom: 20, left: 20 }}
              >
                <FontAwesome name="times" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {/* Show previous performance data if available */}
            {selectedExercise !== null && 
             previousWorkoutData.has(exercises[selectedExercise].routine_exercise_id) && 
             previousWorkoutData.get(exercises[selectedExercise].routine_exercise_id)![currentSet.set_number - 1] && (
              <View style={styles.previousPerformanceCard}>
                <Text style={[styles.previousPerformanceTitle, { color: colors.text }]}>
                  Previous Performance
                </Text>
                <Text style={[styles.previousPerformanceData, { color: colors.primary }]}>
                  {previousWorkoutData.get(exercises[selectedExercise].routine_exercise_id)![currentSet.set_number - 1].reps} reps @ {previousWorkoutData.get(exercises[selectedExercise].routine_exercise_id)![currentSet.set_number - 1].weight} kg
                </Text>
                <Text style={[styles.previousPerformanceHint, { color: colors.subtext }]}>
                  These values have been pre-filled for you
                </Text>
              </View>
            )}
            
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
                    backgroundColor: colors.background 
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
                <Text style={[styles.inputLabel, { color: colors.text }]}>Weight (kg)</Text>
                <Text style={[styles.requiredIndicator, { color: colors.error }]}>*</Text>
              </View>
              <TextInput
                style={[
                  styles.input, 
                  { 
                    color: colors.text, 
                    borderColor: touchedFields.weight && currentSet.weight === 0 ? colors.error : colors.border,
                    backgroundColor: colors.background 
                  }
                ]}
                keyboardType="number-pad"
                value={currentSet.weight === 0 ? '' : currentSet.weight.toString()}
                onChangeText={(text) => handleInputChange('weight', text)}
                placeholder="Enter weight"
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
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
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
                style={[styles.modalNotesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
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
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  workoutInfo: {
    marginBottom: 10,
  },
  workoutDuration: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  workoutNotes: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 60,
    fontSize: 15,
  },
  startButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  exerciseSets: {
    fontSize: 16,
    fontWeight: '500',
  },
  setsList: {
    marginBottom: 16,
  },
  setItem: {
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
    minWidth: 110,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  setNumber: {
    fontWeight: 'bold',
    marginBottom: 6,
    fontSize: 15,
  },
  setDetails: {
    flexDirection: 'column',
  },
  setDetail: {
    fontSize: 14,
  },
  setNotes: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  setsManagementContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  setManagementButton: {
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
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
  notesInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 40,
    fontSize: 15,
  },
  finishButton: {
    padding: 18,
    borderRadius: 10,
    alignItems: 'center',
    margin: 16,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '90%',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  modalNotesInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  previousPerformance: {
    marginTop: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 4,
    borderRadius: 4,
  },
  previousPerformanceText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  previousPerformanceCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  previousPerformanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  previousPerformanceData: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  previousPerformanceHint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
}); 