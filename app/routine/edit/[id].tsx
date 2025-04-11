import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';
import * as SQLite from 'expo-sqlite';

type Exercise = {
  id: number;
  name: string;
  category: string;
  primary_muscle: string;
};

type RoutineExerciseResult = {
  id: number; // routine_exercise_id
  exercise_id: number;
  name: string;
  sets: number;
  exercise_order: number;
};

type RoutineExercise = {
  id: number; // exercise_id
  name: string;
  sets: number;
  exercise_order: number;
  routine_exercise_id: number;
};

export default function EditRoutineScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<RoutineExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    loadRoutineDetails();
    loadExercises();
  }, [id]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = exercises.filter(exercise => 
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exercise.primary_muscle.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredExercises(filtered);
    } else {
      setFilteredExercises(exercises);
    }
  }, [searchQuery, exercises]);

  const loadRoutineDetails = async () => {
    if (!id) return;
    
    try {
      const db = await getDatabase();
      const routineId = parseInt(String(id), 10);
      
      // Get routine details
      const routineResult = await db.getFirstAsync<{ name: string; description: string | null }>(
        'SELECT name, description FROM routines WHERE id = ?',
        [routineId]
      );
      
      if (routineResult) {
        setName(routineResult.name);
        setDescription(routineResult.description || '');
        
        // Get routine exercises
        const exerciseResults = await db.getAllAsync<RoutineExerciseResult>(
          `SELECT re.id, e.id as exercise_id, e.name, re.sets, re.order_num as exercise_order
           FROM routine_exercises re
           JOIN exercises e ON re.exercise_id = e.id
           WHERE re.routine_id = ?
           ORDER BY re.order_num`,
          [routineId]
        );
        
        // Map the exercise results to our component state type
        const mappedExercises: RoutineExercise[] = exerciseResults.map(ex => ({
          id: ex.exercise_id, // This is the actual exercise ID
          name: ex.name,
          sets: ex.sets,
          exercise_order: ex.exercise_order,
          routine_exercise_id: ex.id // Keep the routine_exercise_id for reference
        }));
        
        setSelectedExercises(mappedExercises);
      } else {
        Alert.alert('Error', 'Routine not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading routine details:', error);
      Alert.alert('Error', 'Failed to load routine details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadExercises = async () => {
    try {
      const db = await getDatabase();
      const results = await db.getAllAsync<Exercise>('SELECT id, name, category, primary_muscle FROM exercises ORDER BY name');
      setExercises(results);
      setFilteredExercises(results);
    } catch (error) {
      console.error('Error loading exercises:', error);
      Alert.alert('Error', 'Failed to load exercises. Please try again.');
    }
  };

  const addExerciseToRoutine = (exercise: Exercise) => {
    const newExercise: RoutineExercise = {
      id: exercise.id,
      name: exercise.name,
      sets: 3, // Default sets
      exercise_order: selectedExercises.length,
      routine_exercise_id: 0 // This will be assigned by the database when saved
    };
    
    setSelectedExercises([...selectedExercises, newExercise]);
  };

  const removeExerciseFromRoutine = (index: number) => {
    const updatedExercises = [...selectedExercises];
    updatedExercises.splice(index, 1);
    
    // Update order numbers
    updatedExercises.forEach((exercise, idx) => {
      exercise.exercise_order = idx;
    });
    
    setSelectedExercises(updatedExercises);
  };

  const updateExerciseSets = (index: number, sets: number) => {
    if (sets < 1) return;
    
    const updatedExercises = [...selectedExercises];
    updatedExercises[index].sets = sets;
    setSelectedExercises(updatedExercises);
  };

  const saveRoutine = async () => {
    if (!id || !name.trim()) {
      Alert.alert('Error', 'Please enter a routine name');
      return;
    }
    
    if (selectedExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise to your routine');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const db = await getDatabase();
      const routineId = parseInt(String(id), 10);
      
      // Update the routine
      await db.runAsync(
        'UPDATE routines SET name = ?, description = ? WHERE id = ?',
        [name.trim(), description.trim() || null, routineId]
      );
      
      // Delete existing routine exercises - this is necessary since we need to recreate the entire order
      await db.runAsync(
        'DELETE FROM routine_exercises WHERE routine_id = ?',
        [routineId]
      );
      
      // Insert all the exercises in the current selection
      for (const exercise of selectedExercises) {
        await db.runAsync(
          'INSERT INTO routine_exercises (routine_id, exercise_id, order_num, sets) VALUES (?, ?, ?, ?)',
          [routineId, exercise.id, exercise.exercise_order, exercise.sets]
        );
      }
      
      Alert.alert('Success', 'Routine updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating routine:', error);
      Alert.alert('Error', 'Failed to update routine. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <TouchableOpacity 
      style={[styles.exerciseItem, { backgroundColor: colors.card }]}
      onPress={() => addExerciseToRoutine(item)}
    >
      <View style={styles.exerciseInfo}>
        <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.exerciseDetails, { color: colors.subtext }]}>
          {item.category} • {item.primary_muscle}
        </Text>
      </View>
      <FontAwesome name="plus-circle" size={20} color={colors.primary} />
    </TouchableOpacity>
  );

  const renderSelectedExerciseItem = ({ item, index }: { item: RoutineExercise, index: number }) => (
    <View style={[styles.selectedExerciseItem, { backgroundColor: colors.card }]}>
      <View style={styles.selectedExerciseInfo}>
        <Text style={[styles.selectedExerciseName, { color: colors.text }]}>{item.name}</Text>
        <View style={styles.setsContainer}>
          <Text style={[styles.setsLabel, { color: colors.subtext }]}>Sets:</Text>
          <View style={styles.setsControls}>
            <TouchableOpacity 
              style={[styles.setsButton, { backgroundColor: colors.background }]}
              onPress={() => updateExerciseSets(index, item.sets - 1)}
            >
              <FontAwesome name="minus" size={12} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.setsValue, { color: colors.text }]}>{item.sets}</Text>
            <TouchableOpacity 
              style={[styles.setsButton, { backgroundColor: colors.background }]}
              onPress={() => updateExerciseSets(index, item.sets + 1)}
            >
              <FontAwesome name="plus" size={12} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => removeExerciseFromRoutine(index)}
      >
        <FontAwesome name="trash" size={16} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Stack.Screen 
          options={{
            title: "Edit Routine",
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading routine...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: "Edit Routine",
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerRight: () => (
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={saveRoutine}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Routine Details</Text>
          
          <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter routine name"
              placeholderTextColor={colors.subtext}
              value={name}
              onChangeText={setName}
            />
          </View>
          
          <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter routine description"
              placeholderTextColor={colors.subtext}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>
        
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected Exercises</Text>
          
          {selectedExercises.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
              <FontAwesome name="list" size={24} color={colors.subtext} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                No exercises added yet. Select exercises from the list below.
              </Text>
            </View>
          ) : (
            <View style={styles.selectedExercisesList}>
              {selectedExercises.map((exercise, index) => (
                <View key={index}>
                  {renderSelectedExerciseItem({ item: exercise, index })}
                </View>
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Exercises</Text>
          
          <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
            <FontAwesome name="search" size={16} color={colors.subtext} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search exercises..."
              placeholderTextColor={colors.subtext}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          
          <View style={styles.exercisesList}>
            {filteredExercises.map((exercise) => (
              <View key={exercise.id}>
                {renderExerciseItem({ item: exercise })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
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
  formSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  inputContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    padding: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  exercisesList: {
    marginBottom: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  exerciseDetails: {
    fontSize: 14,
  },
  selectedExercisesList: {
    marginBottom: 12,
  },
  selectedExerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedExerciseInfo: {
    flex: 1,
  },
  selectedExerciseName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  setsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setsLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  setsControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setsButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  setsValue: {
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 8,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 