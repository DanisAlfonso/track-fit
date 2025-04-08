import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, TextInput, Modal, FlatList } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';

type Exercise = {
  id: number;
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
  id: number;
  name: string;
  sets: number;
  completedSets: number;
  exercise_order: number;
  sets_data: Set[];
  notes: string;
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
          `SELECT re.id, e.name, re.sets, re.order_num as exercise_order
           FROM routine_exercises re
           JOIN exercises e ON re.exercise_id = e.id
           WHERE re.routine_id = ?
           ORDER BY re.order_num`,
          [id]
        );
        
        // Convert to workout exercises with completed sets
        const workoutExercises: WorkoutExercise[] = exerciseResults.map(exercise => {
          // Create default sets data
          const sets_data: Set[] = [];
          for (let i = 1; i <= exercise.sets; i++) {
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
    setCurrentSet(exercises[exerciseIndex].sets_data[setIndex]);
    setSetModalVisible(true);
  };

  const saveSet = () => {
    if (selectedExercise === null) return;
    
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
                'UPDATE workouts SET date = ?, duration = ?, notes = ? WHERE id = ?',
                [Date.now(), workoutDuration, workoutNotes, workoutId]
              );
              
              // Save completed exercises and sets
              for (const exercise of exercises) {
                // Insert workout exercise
                const exerciseResult = await db.runAsync(
                  'INSERT INTO workout_exercises (workout_id, exercise_id, sets_completed, notes) VALUES (?, ?, ?, ?)',
                  [workoutId, exercise.id, exercise.completedSets, exercise.notes]
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
                { text: 'OK', onPress: () => router.back() }
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

  const renderExerciseItem = ({ item, index }: { item: WorkoutExercise, index: number }) => (
    <View style={[styles.exerciseItem, { backgroundColor: colors.card }]}>
      <View style={styles.exerciseHeader}>
        <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.exerciseSets, { color: colors.subtext }]}>
          Sets: {item.completedSets}/{item.sets}
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
          </TouchableOpacity>
        )}
        keyExtractor={(set) => `set-${set.set_number}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.setsList}
      />
      
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
        keyExtractor={(item) => `exercise-${item.id}`}
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {selectedExercise !== null ? exercises[selectedExercise].name : ''} - Set {currentSet.set_number}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Reps</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                keyboardType="number-pad"
                value={currentSet.reps.toString()}
                onChangeText={(text) => setCurrentSet({...currentSet, reps: parseInt(text) || 0})}
                placeholder="0"
                placeholderTextColor={colors.subtext}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Weight (kg)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                keyboardType="number-pad"
                value={currentSet.weight.toString()}
                onChangeText={(text) => setCurrentSet({...currentSet, weight: parseFloat(text) || 0})}
                placeholder="0"
                placeholderTextColor={colors.subtext}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Rest Time (seconds)</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
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
                style={[styles.notesInput, { color: colors.text, borderColor: colors.border }]}
                value={currentSet.notes}
                onChangeText={(text) => setCurrentSet({...currentSet, notes: text})}
                placeholder="Add notes for this set..."
                placeholderTextColor={colors.subtext}
                multiline
              />
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.background }]}
                onPress={() => setSetModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={saveSet}
              >
                <Text style={[styles.modalButtonText, { color: 'white' }]}>Save</Text>
              </TouchableOpacity>
            </View>
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
    borderRadius: 5,
    padding: 8,
    minHeight: 60,
  },
  startButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exerciseList: {
    padding: 16,
  },
  exerciseItem: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseSets: {
    fontSize: 14,
  },
  setsList: {
    marginBottom: 10,
  },
  setItem: {
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
    minWidth: 100,
    borderWidth: 1,
  },
  setNumber: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  setDetails: {
    flexDirection: 'column',
  },
  setDetail: {
    fontSize: 12,
  },
  setNotes: {
    fontSize: 10,
    marginTop: 2,
  },
  exerciseNotes: {
    marginTop: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 8,
    minHeight: 40,
  },
  finishButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    margin: 16,
  },
  finishButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 