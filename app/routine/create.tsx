import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';

type Exercise = {
  id: number;
  name: string;
  category: string;
  primary_muscle: string;
};

type RoutineExercise = {
  id: number;
  name: string;
  sets: number;
  exercise_order: number;
};

export default function CreateRoutineScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<RoutineExercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    loadExercises();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = exercises.filter(exercise => 
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exercise.primary_muscle && exercise.primary_muscle.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredExercises(filtered);
    } else {
      setFilteredExercises(exercises);
    }
  }, [searchQuery, exercises]);

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
      exercise_order: selectedExercises.length
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
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a routine name');
      return;
    }
    
    if (selectedExercises.length === 0) {
      Alert.alert('Error', 'Please add at least one exercise to your routine');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const db = await getDatabase();
      
      // Insert the routine
      const result = await db.runAsync(
        'INSERT INTO routines (name, description, created_at) VALUES (?, ?, ?)',
        [name.trim(), description.trim() || null, Date.now()]
      );
      
      const routineId = result.lastInsertRowId;
      
      // Insert routine exercises
      for (const exercise of selectedExercises) {
        await db.runAsync(
          'INSERT INTO routine_exercises (routine_id, exercise_id, order_num, sets) VALUES (?, ?, ?, ?)',
          [routineId, exercise.id, exercise.exercise_order, exercise.sets]
        );
      }
      
      Alert.alert('Success', 'Routine created successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving routine:', error);
      Alert.alert('Error', 'Failed to save routine. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getMuscleColor = (muscle?: string) => {
    if (!muscle) return colors.primary;
    
    // Map of muscle groups to colors
    const muscleColors: Record<string, string> = {
      'chest': '#FF6B6B',
      'back': '#48BEFF',
      'shoulders': '#9F7AEA',
      'biceps': '#4CAF50',
      'triceps': '#FF9800',
      'legs': '#FFC107',
      'quadriceps': '#8BC34A',
      'hamstrings': '#CDDC39',
      'calves': '#FFEB3B',
      'glutes': '#FFC107',
      'abs': '#00BCD4',
      'core': '#00BCD4',
      'forearms': '#795548',
      'traps': '#9C27B0',
    };
    
    return muscleColors[muscle.toLowerCase()] || colors.primary;
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: "Create Routine",
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity 
              style={[styles.saveButton, { opacity: isLoading ? 0.7 : 1 }]}
              onPress={saveRoutine}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.primary }]}>Save</Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Routine Details</Text>
          
          <View style={[styles.inputContainer, { 
            backgroundColor: colors.card,
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
          }]}>
            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Name</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter routine name"
              placeholderTextColor={colors.subtext}
              value={name}
              onChangeText={setName}
            />
          </View>
          
          <View style={[styles.inputContainer, { 
            backgroundColor: colors.card,
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
          }]}>
            <Text style={[styles.inputLabel, { color: colors.subtext }]}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter routine description"
              placeholderTextColor={colors.subtext}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
        
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Selected Exercises</Text>
            <Text style={[styles.sectionCount, { color: colors.primary }]}>
              {selectedExercises.length} {selectedExercises.length === 1 ? 'exercise' : 'exercises'}
            </Text>
          </View>
          
          {selectedExercises.length === 0 ? (
            <View style={[styles.emptyContainer, { 
              backgroundColor: colors.card,
              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
            }]}>
              <View style={[styles.emptyIconContainer, { backgroundColor: `${colors.primary}20` }]}>
                <FontAwesome name="list" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No Exercises Added
              </Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                Select exercises from the list below to build your routine.
              </Text>
            </View>
          ) : (
            <View style={styles.selectedExercisesList}>
              {selectedExercises.map((exercise, index) => (
                <View key={index} style={styles.selectedExerciseWrapper}>
                  <View style={styles.selectedExerciseOrderContainer}>
                    <View style={[styles.selectedExerciseOrder, { backgroundColor: colors.primary }]}>
                      <Text style={styles.selectedExerciseOrderText}>{index + 1}</Text>
                    </View>
                    <View style={styles.dragHandle}>
                      <FontAwesome name="bars" size={16} color={colors.subtext} />
                    </View>
                  </View>
                  
                  <View style={[styles.selectedExerciseItem, { 
                    backgroundColor: colors.card,
                    borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                  }]}>
                    <View style={styles.selectedExerciseInfo}>
                      <Text style={[styles.selectedExerciseName, { color: colors.text }]}>
                        {exercise.name}
                      </Text>
                      <View style={styles.setsContainer}>
                        <Text style={[styles.setsLabel, { color: colors.subtext }]}>Sets:</Text>
                        <View style={styles.setsControls}>
                          <TouchableOpacity 
                            style={[styles.setsButton, { 
                              backgroundColor: colors.background,
                              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                            }]}
                            onPress={() => updateExerciseSets(index, exercise.sets - 1)}
                          >
                            <FontAwesome name="minus" size={12} color={colors.text} />
                          </TouchableOpacity>
                          <Text style={[styles.setsValue, { color: colors.text }]}>{exercise.sets}</Text>
                          <TouchableOpacity 
                            style={[styles.setsButton, { 
                              backgroundColor: colors.background,
                              borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                            }]}
                            onPress={() => updateExerciseSets(index, exercise.sets + 1)}
                          >
                            <FontAwesome name="plus" size={12} color={colors.text} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={[styles.removeButton, { backgroundColor: `${colors.error}15` }]}
                      onPress={() => removeExerciseFromRoutine(index)}
                    >
                      <FontAwesome name="trash" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
        
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Exercises</Text>
          
          <View style={[styles.searchContainer, { 
            backgroundColor: colors.card,
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
          }]}>
            <FontAwesome name="search" size={16} color={colors.primary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search by name or muscle group..."
              placeholderTextColor={colors.subtext}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                style={styles.clearSearch}
                onPress={() => setSearchQuery('')}
              >
                <FontAwesome name="times-circle" size={16} color={colors.subtext} />
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.exercisesList}>
            {filteredExercises.map((exercise) => {
              // Check if this exercise is already selected
              const isSelected = selectedExercises.some(selected => selected.id === exercise.id);
              
              return (
                <TouchableOpacity 
                  key={exercise.id}
                  style={[
                    styles.exerciseItem, 
                    { 
                      backgroundColor: colors.card,
                      borderLeftColor: getMuscleColor(exercise.primary_muscle),
                      borderColor: isSelected 
                        ? colors.primary
                        : theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      opacity: isSelected ? 0.8 : 1,
                    }
                  ]}
                  onPress={() => {
                    if (!isSelected) {
                      addExerciseToRoutine(exercise);
                    } else {
                      // Find the index in the selected exercises and remove it
                      const index = selectedExercises.findIndex(item => item.id === exercise.id);
                      if (index !== -1) {
                        removeExerciseFromRoutine(index);
                      }
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>
                      {exercise.name}
                    </Text>
                    <View style={styles.exerciseTagsContainer}>
                      {exercise.primary_muscle && (
                        <View style={[styles.exerciseTag, { 
                          backgroundColor: `${getMuscleColor(exercise.primary_muscle)}20` 
                        }]}>
                          <Text style={[styles.exerciseTagText, { 
                            color: getMuscleColor(exercise.primary_muscle) 
                          }]}>
                            {exercise.primary_muscle}
                          </Text>
                        </View>
                      )}
                      {exercise.category && (
                        <View style={[styles.exerciseTag, { 
                          backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                          borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
                        }]}>
                          <Text style={[styles.exerciseTagText, { color: colors.subtext }]}>
                            {exercise.category}
                          </Text>
                        </View>
                      )}
                      
                      {isSelected && (
                        <View style={[styles.exerciseTag, { 
                          backgroundColor: `${colors.primary}15`,
                          borderColor: colors.primary,
                        }]}>
                          <Text style={[styles.exerciseTagText, { color: colors.primary }]}>
                            Added
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.exerciseActions}>
                      <TouchableOpacity 
                        style={[
                          styles.exerciseActionButton, 
                          { 
                            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                          }
                        ]}
                        onPress={() => router.push(`/exercise/${exercise.id}`)}
                      >
                        <FontAwesome name="info-circle" size={14} color={colors.primary} />
                        <Text style={[styles.exerciseActionText, { color: colors.primary }]}>Details</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.exerciseActionButton, 
                          { 
                            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                          }
                        ]}
                        onPress={() => router.push(`/exercise/history/${exercise.id}`)}
                      >
                        <FontAwesome name="history" size={14} color={colors.secondary} />
                        <Text style={[styles.exerciseActionText, { color: colors.secondary }]}>History</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[
                    styles.addExerciseButton, 
                    { 
                      backgroundColor: isSelected ? `${colors.error}15` : `${colors.primary}15`,
                    }
                  ]}>
                    <FontAwesome 
                      name={isSelected ? "minus" : "plus"} 
                      size={16} 
                      color={isSelected ? colors.error : colors.primary} 
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
            
            {filteredExercises.length === 0 && (
              <View style={[styles.emptySearchContainer, { backgroundColor: colors.card }]}>
                <FontAwesome name="search" size={24} color={colors.subtext} style={{ opacity: 0.5 }} />
                <Text style={[styles.emptySearchText, { color: colors.subtext }]}>
                  {searchQuery ? 'No exercises match your search' : 'No exercises found'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 16,
    paddingBottom: 32,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  inputLabel: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    fontSize: 16,
    padding: 0,
    lineHeight: 22,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  clearSearch: {
    padding: 4,
  },
  exercisesList: {
    marginBottom: 16,
    gap: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  exerciseTagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseTag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  exerciseTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addExerciseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedExercisesList: {
    marginBottom: 16,
    gap: 12,
  },
  selectedExerciseWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedExerciseOrderContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginRight: 12,
    gap: 8,
  },
  selectedExerciseOrder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedExerciseOrderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dragHandle: {
    padding: 4,
  },
  selectedExerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    flex: 1,
    borderWidth: 1,
  },
  selectedExerciseInfo: {
    flex: 1,
  },
  selectedExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  setsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setsLabel: {
    fontSize: 14,
    marginRight: 12,
    fontWeight: '500',
  },
  setsControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  setsButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
  },
  setsValue: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: '80%',
    lineHeight: 20,
  },
  emptySearchContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    borderRadius: 16,
  },
  emptySearchText: {
    fontSize: 16,
    marginTop: 12,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  exerciseActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
  },
  exerciseActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  exerciseActionText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
}); 