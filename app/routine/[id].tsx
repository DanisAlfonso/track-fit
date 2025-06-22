import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, FlatList, Platform, ActionSheetIOS } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '@/context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Routine = {
  id: number;
  name: string;
  description: string | null;
  created_at: number;
};

type RoutineExercise = {
  id: number;
  name: string;
  sets: number;
  exercise_order: number;
  exercise_id: number;
  primary_muscle: string;
  category: string;
};

type SortOption = 'default' | 'muscle' | 'category';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const insets = useSafeAreaInsets();

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('default');

  useFocusEffect(
    useCallback(() => {
      loadRoutineDetails();
      
      // Clean up function when screen loses focus
      return () => {
        // Optional cleanup if needed
      };
    }, [id])
  );

  const loadRoutineDetails = async () => {
    if (!id) return;
    
    setIsLoading(true);
    
    try {
      const db = await getDatabase();
      const routineId = parseInt(String(id), 10);
      
      // Get routine details
      const routineResult = await db.getFirstAsync<Routine>(
        'SELECT * FROM routines WHERE id = ?',
        [routineId]
      );
      
      if (routineResult) {
        setRoutine(routineResult);
        
        // Get routine exercises with additional muscle and category info
        const exerciseResults = await db.getAllAsync<RoutineExercise>(
          `SELECT re.id, e.name, re.sets, re.order_num as exercise_order, e.id as exercise_id,
           e.primary_muscle, e.category
           FROM routine_exercises re
           JOIN exercises e ON re.exercise_id = e.id
           WHERE re.routine_id = ?
           ORDER BY re.order_num`,
          [routineId]
        );
        
        setExercises(exerciseResults);
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

  const startWorkout = () => {
    if (!routine) return;
    router.push({
      pathname: "/workout/start",
      params: { routineId: routine.id }
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  // Organize exercises by muscle groups for rendering
  const muscleGroups = useMemo(() => {
    const groups: Record<string, RoutineExercise[]> = {};
    
    exercises.forEach(exercise => {
      const muscle = exercise.primary_muscle || 'Other';
      if (!groups[muscle]) {
        groups[muscle] = [];
      }
      groups[muscle].push(exercise);
    });
    
    return groups;
  }, [exercises]);

  // Organize exercises by category for rendering
  const exerciseCategories = useMemo(() => {
    const categories: Record<string, RoutineExercise[]> = {};
    
    exercises.forEach(exercise => {
      const category = exercise.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(exercise);
    });
    
    return categories;
  }, [exercises]);

  const renderExerciseItem = (exercise: RoutineExercise, index: number) => (
    <View 
      key={exercise.id} 
      style={[styles.exerciseItem, { backgroundColor: colors.card }]}
    >
      <View style={[styles.exerciseNumber, { backgroundColor: getMuscleColor(exercise.primary_muscle) }]}>
        <Text style={[styles.exerciseNumberText, { color: 'white' }]}>
          {index + 1}
        </Text>
      </View>
      <View style={styles.exerciseInfo}>
        <Text style={[styles.exerciseName, { color: colors.text }]}>
          {exercise.name}
        </Text>
        <View style={styles.exerciseDetails}>
          <Text style={[styles.exerciseSets, { color: colors.subtext }]}>
            {exercise.sets} set{exercise.sets !== 1 ? 's' : ''}
          </Text>
          <Text style={[styles.exerciseMuscle, { color: colors.subtext }]}>
            {exercise.primary_muscle}
          </Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.exerciseButton}
        onPress={() => router.push(`/exercise/${exercise.exercise_id}`)}
      >
        <FontAwesome name="info-circle" size={18} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  // Helper function to get color based on muscle group for visual distinction
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

  const shareRoutine = async () => {
    if (!routine) return;
    
    try {
      setIsSharing(true);
      
      // Create an object with all the routine information
      const routineData = {
        name: routine.name,
        description: routine.description,
        created_at: routine.created_at,
        exercises: exercises.map(exercise => ({
          name: exercise.name,
          sets: exercise.sets,
          primary_muscle: exercise.primary_muscle,
          category: exercise.category
        }))
      };
      
      // Convert the object to a JSON string
      const jsonData = JSON.stringify(routineData, null, 2);
      
      // Generate a filename based on the routine name (sanitize it)
      const sanitizedName = routine.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${sanitizedName}_routine.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Write the data to a file
      await FileSystem.writeAsStringAsync(fileUri, jsonData);
      
      // Check if sharing is available
      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        // Share the file
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: `Share ${routine.name} Routine`,
          UTI: 'public.json' // for iOS
        });
      } else {
        Alert.alert('Sharing Not Available', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing routine:', error);
      Alert.alert('Error', 'Failed to share routine');
    } finally {
      setIsSharing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
        <Stack.Screen 
          options={{
            title: "Routine Details",
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

  if (!routine) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: routine.name,
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      
      <ScrollView style={styles.scrollView}>
        {/* Simple header section without long-press or action buttons */}
        <View style={styles.headerSection}>
          <Text style={[styles.routineName, { color: colors.text }]}>{routine.name}</Text>
          {routine.description && (
            <Text style={[styles.routineDescription, { color: colors.subtext }]}>
              {routine.description}
            </Text>
          )}
          <Text style={[styles.routineMeta, { color: colors.subtext }]}>
            Created: {formatDate(routine.created_at)}
          </Text>
        </View>
        
        <View style={styles.exercisesSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Exercises ({exercises.length})
            </Text>
            
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
          </View>
          
          {exercises.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
              <FontAwesome name="list" size={24} color={colors.subtext} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                No exercises in this routine yet.
              </Text>
            </View>
          ) : (
            <>
              {sortOption === 'default' && (
                <View style={styles.exercisesList}>
                  {exercises.map((exercise, index) => renderExerciseItem(exercise, index))}
                </View>
              )}
              
              {sortOption === 'muscle' && (
                <View style={styles.groupedExercisesList}>
                  {Object.entries(muscleGroups).map(([muscle, muscleExercises]) => (
                    <View key={muscle} style={styles.exerciseGroup}>
                      <View style={[styles.groupHeader, { backgroundColor: colors.card, borderLeftColor: getMuscleColor(muscle) }]}>
                        <Text style={[styles.groupTitle, { color: colors.text }]}>{muscle}</Text>
                        <Text style={[styles.groupCount, { color: colors.subtext }]}>
                          {muscleExercises.length} exercise{muscleExercises.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {muscleExercises.map((exercise, index) => renderExerciseItem(exercise, index))}
                    </View>
                  ))}
                </View>
              )}
              
              {sortOption === 'category' && (
                <View style={styles.groupedExercisesList}>
                  {Object.entries(exerciseCategories).map(([category, categoryExercises]) => (
                    <View key={category} style={styles.exerciseGroup}>
                      <View style={[styles.groupHeader, { backgroundColor: colors.card }]}>
                        <Text style={[styles.groupTitle, { color: colors.text }]}>{category}</Text>
                        <Text style={[styles.groupCount, { color: colors.subtext }]}>
                          {categoryExercises.length} exercise{categoryExercises.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      {categoryExercises.map((exercise, index) => renderExerciseItem(exercise, index))}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      
      <View style={[styles.bottomButtonContainer, { 
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        paddingBottom: insets.bottom + 16
      }]}>
        <TouchableOpacity 
          style={[styles.startWorkoutButton, { backgroundColor: colors.primary }]}
          onPress={startWorkout}
        >
          <FontAwesome name="play-circle" size={18} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.startWorkoutButtonText}>Start Workout</Text>
        </TouchableOpacity>
      </View>
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
  headerSection: {
    marginBottom: 24,
  },
  routineName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  routineDescription: {
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  routineMeta: {
    fontSize: 14,
  },
  exercisesSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sortOptions: {
    flexDirection: 'row',
  },
  sortButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortButtonActive: {
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  exercisesList: {
    marginBottom: 16,
  },
  groupedExercisesList: {
    marginBottom: 16,
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
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupCount: {
    fontSize: 12,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  exerciseDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseSets: {
    fontSize: 14,
    marginRight: 8,
  },
  exerciseMuscle: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  exerciseButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    borderRadius: 12,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  bottomButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  startWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  startWorkoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});