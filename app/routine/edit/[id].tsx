import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableNativeFeedback
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { ActionSheet, ActionSheetOption } from '@/components/ActionSheet';

type Exercise = {
  id: number;
  name: string;
  category: string;
  primary_muscle: string;
  secondary_muscles?: string | null;
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

// Ultra-reliable button for Samsung devices
interface ReliableButtonProps {
  onPress: () => void;
  text: string;
  isLoading: boolean;
  style?: any;
  textStyle?: any;
}

function ReliableButton({ onPress, text, isLoading, style, textStyle }: ReliableButtonProps) {
  // Each tap attempt counter
  const tapAttemptRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const handlePress = () => {
    tapAttemptRef.current += 1;
    console.log(`Button tapped (attempt #${tapAttemptRef.current})`);
    
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set a very short debounce to prevent multiple triggers
    debounceTimerRef.current = setTimeout(() => {
      console.log("Executing button action");
      onPress();
      // Reset counter after successful press
      tapAttemptRef.current = 0;
    }, 10);
  };
  
  // For Android, ensure we have the right background for ripple effect
  const background = Platform.OS === 'android' 
    ? TouchableNativeFeedback.Ripple('#DDDDDD', false) 
    : undefined;
  
  // Create the appropriate wrapper based on platform
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.reliableButtonWrapper, style]}>
        <TouchableNativeFeedback 
          background={background}
          onPress={handlePress}
          useForeground={true}
          disabled={isLoading}
        >
          <View style={styles.reliableButtonContent}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.reliableButtonText, textStyle]}>{text}</Text>
            )}
          </View>
        </TouchableNativeFeedback>
      </View>
    );
  }
  
  // iOS and other platforms
  return (
    <TouchableOpacity 
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.6}
      style={[styles.reliableButtonContent, style]}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={[styles.reliableButtonText, textStyle]}>{text}</Text>
      )}
    </TouchableOpacity>
  );
}

export default function EditRoutineScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<RoutineExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);

  const muscleGroups = useMemo(() => [
    'All',
    'Chest',
    'Back',
    'Shoulders',
    'Biceps',
    'Triceps',
    'Forearms',
    'Quadriceps',
    'Hamstrings',
    'Glutes',
    'Calves',
    'Abs',
  ], []);

  // Create options for the filter action sheet
  const filterOptions = useMemo(() => {
    return muscleGroups.map(group => ({
      label: group,
      onPress: () => setSelectedFilter(group === 'All' ? null : group),
      icon: selectedFilter === group || (group === 'All' && !selectedFilter) ? 'check' : undefined,
    } as ActionSheetOption));
  }, [muscleGroups, selectedFilter]);

  useEffect(() => {
    loadRoutineDetails();
    loadExercises();
  }, [id]);

  useEffect(() => {
    filterExercisesList();
  }, [searchQuery, exercises, selectedFilter]);

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
        showToast('Routine not found', 'error');
        router.back();
      }
    } catch (error) {
      console.error('Error loading routine details:', error);
      showToast('Failed to load routine details', 'error');
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
      showToast('Failed to load exercises. Please try again.', 'error');
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
      showToast('Please enter a routine name', 'error');
      return;
    }
    
    if (selectedExercises.length === 0) {
      showToast('Please add at least one exercise to your routine', 'error');
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
      
      showToast('Routine updated successfully', 'success');
      router.back();
    } catch (error) {
      console.error('Error updating routine:', error);
      showToast('Failed to update routine. Please try again.', 'error');
    } finally {
      setIsSaving(false);
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

  const isExerciseSelected = (exerciseId: number): boolean => {
    return selectedExercises.some(ex => ex.id === exerciseId);
  };

  const toggleExerciseSelection = (exercise: Exercise) => {
    // If already selected, remove it
    if (isExerciseSelected(exercise.id)) {
      removeExerciseById(exercise.id);
    } else {
      // If not selected, add it
      addExerciseToRoutine(exercise);
    }
  };

  const removeExerciseById = (exerciseId: number) => {
    // Find the index of the exercise with the matching ID
    const index = selectedExercises.findIndex(ex => ex.id === exerciseId);
    if (index !== -1) {
      removeExerciseFromRoutine(index);
    }
  };

  const renderExerciseItem = ({ item }: { item: Exercise }) => {
    const alreadySelected = isExerciseSelected(item.id);
    
    return (
      <TouchableOpacity 
        style={[
          styles.exerciseItem, 
          { 
            backgroundColor: colors.card,
            borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            borderLeftColor: getMuscleColor(item.primary_muscle),
            opacity: alreadySelected ? 0.8 : 1
          }
        ]}
        onPress={() => toggleExerciseSelection(item)}
        activeOpacity={0.7}
      >
        <View style={styles.exerciseInfo}>
          <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
          <View style={styles.exerciseTagsContainer}>
            {item.category && (
              <View style={[
                styles.exerciseTag, 
                { 
                  backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                }
              ]}>
                <Text style={[styles.exerciseTagText, { color: colors.text }]}>{item.category}</Text>
              </View>
            )}
            {item.primary_muscle && (
              <View style={[
                styles.exerciseTag, 
                { 
                  backgroundColor: `${getMuscleColor(item.primary_muscle)}20`,
                  borderColor: getMuscleColor(item.primary_muscle)
                }
              ]}>
                <Text style={[
                  styles.exerciseTagText, 
                  { color: currentTheme === 'dark' ? getMuscleColor(item.primary_muscle) : `${getMuscleColor(item.primary_muscle)}E0` }
                ]}>
                  {item.primary_muscle}
                </Text>
              </View>
            )}
            {alreadySelected && (
              <View style={[
                styles.exerciseTag, 
                { 
                  backgroundColor: `${colors.primary}15`,
                  borderColor: colors.primary
                }
              ]}>
                <Text style={[styles.exerciseTagText, { color: colors.primary }]}>
                  {alreadySelected ? "Tap to Remove" : "Tap to Add"}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View 
          style={[
            alreadySelected ? styles.selectedButton : styles.addExerciseButton, 
            { backgroundColor: `${alreadySelected ? colors.error : colors.primary}20` }
          ]}
        >
          <FontAwesome 
            name={alreadySelected ? "minus" : "plus"} 
            size={16} 
            color={alreadySelected ? colors.error : colors.primary} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderSelectedExerciseItem = ({ item, index }: { item: RoutineExercise, index: number }) => (
    <View style={styles.selectedExerciseWrapper}>
      <View style={styles.selectedExerciseOrderContainer}>
        <View style={[styles.selectedExerciseOrder, { backgroundColor: colors.primary }]}>
          <Text style={styles.selectedExerciseOrderText}>{index + 1}</Text>
        </View>
      </View>
      
      <View style={[
        styles.selectedExerciseItem, 
        { 
          backgroundColor: colors.card,
          borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
        }
      ]}>
        <View style={styles.selectedExerciseInfo}>
          <Text style={[styles.selectedExerciseName, { color: colors.text }]}>{item.name}</Text>
          <View style={styles.setsContainer}>
            <Text style={[styles.setsLabel, { color: colors.subtext }]}>Sets:</Text>
            <View style={styles.setsControls}>
              <TouchableOpacity 
                style={[
                  styles.setsButton, 
                  { 
                    backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                  }
                ]}
                onPress={() => updateExerciseSets(index, item.sets - 1)}
              >
                <FontAwesome name="minus" size={12} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.setsValue, { color: colors.text }]}>{item.sets}</Text>
              <TouchableOpacity 
                style={[
                  styles.setsButton, 
                  { 
                    backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                  }
                ]}
                onPress={() => updateExerciseSets(index, item.sets + 1)}
              >
                <FontAwesome name="plus" size={12} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.removeButton, { backgroundColor: `${colors.error}20` }]}
          onPress={() => removeExerciseFromRoutine(index)}
        >
          <FontAwesome name="trash" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const filterExercisesList = () => {
    let filtered = [...exercises];

    // Apply search filter
    if (searchQuery) {
      const trimmedQuery = searchQuery.trim().toLowerCase();
      if (trimmedQuery) {
        filtered = filtered.filter(exercise => 
          exercise.name.toLowerCase().includes(trimmedQuery) ||
          exercise.primary_muscle.toLowerCase().includes(trimmedQuery)
        );
      }
    }

    // Apply muscle group filter
    if (selectedFilter && selectedFilter !== 'All') {
      filtered = filtered.filter(exercise => 
        exercise.primary_muscle === selectedFilter || 
        (exercise.secondary_muscles && exercise.secondary_muscles.includes(selectedFilter))
      );
    }

    setFilteredExercises(filtered);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
        <Stack.Screen 
          options={{
            title: "Edit Routine",
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            headerShadowVisible: false,
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
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: "Edit Routine",
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
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
            borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
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
            borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
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
              borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
            }]}>
              <View style={[styles.emptyIconContainer, { backgroundColor: `${colors.primary}20` }]}>
                <FontAwesome name="list" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No exercises added</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                Select exercises from the list below to add to your routine
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Available Exercises</Text>
            <Text style={[styles.sectionCount, { color: colors.primary }]}>
              {filteredExercises.length} {filteredExercises.length === 1 ? 'exercise' : 'exercises'}
            </Text>
          </View>
          
          <View style={styles.searchFilterContainer}>
            <View style={[styles.searchContainer, { 
              backgroundColor: colors.card,
              borderColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'
            }]}>
              <FontAwesome name="search" size={16} color={colors.subtext} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search exercises by name..."
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
            
            <TouchableOpacity
              style={[
                styles.muscleFilterButton,
                { backgroundColor: colors.card }
              ]}
              onPress={() => setShowFilterModal(true)}
              activeOpacity={0.7}
            >
              <FontAwesome 
                name="filter" 
                size={14} 
                color={colors.primary} 
                style={styles.filterIcon} 
              />
              <Text
                style={[
                  styles.filterText,
                  { color: colors.text }
                ]}
              >
                {selectedFilter || 'All'}
              </Text>
              <FontAwesome 
                name="chevron-down" 
                size={12} 
                color={colors.subtext} 
                style={styles.filterChevron} 
              />
            </TouchableOpacity>
          </View>
          
          {filteredExercises.length === 0 ? (
            <View style={[styles.emptySearchContainer, { backgroundColor: colors.card }]}>
              <FontAwesome name="search" size={24} color={colors.subtext} />
              <Text style={[styles.emptySearchText, { color: colors.subtext }]}>
                No exercises found matching "{searchQuery}"
              </Text>
            </View>
          ) : (
            <View style={styles.exercisesList}>
              {filteredExercises.map((exercise) => (
                <View key={exercise.id}>
                  {renderExerciseItem({ item: exercise })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Bottom save button */}
      <View style={[styles.bottomButtonContainer, { 
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
      }]}>
        <ReliableButton
          onPress={saveRoutine}
          text="Save Routine"
          isLoading={isSaving}
          style={{ backgroundColor: colors.primary }}
        />
      </View>
      
      {/* Muscle group filter action sheet */}
      <ActionSheet
        visible={showFilterModal}
        title="Filter by Muscle Group"
        options={filterOptions}
        onClose={() => setShowFilterModal(false)}
        cancelLabel="Cancel"
      />
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
  searchFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    flex: 1,
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
  selectedButton: {
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
  bottomButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reliableButtonWrapper: {
    borderRadius: 8, 
    overflow: 'hidden',
  },
  reliableButtonContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: 8,
  },
  reliableButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  muscleFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterChevron: {
    marginLeft: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 