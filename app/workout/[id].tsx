import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';

type Workout = {
  id: number;
  name: string;
  date: number;
  completed_at: number | null;
  routine_name: string;
};

type WorkoutExercise = {
  id: number;
  name: string;
  sets_completed: number;
};

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadWorkoutDetails();
  }, [id]);

  const loadWorkoutDetails = async () => {
    if (!id) return;
    
    setIsLoading(true);
    
    try {
      const db = await getDatabase();
      const workoutId = parseInt(String(id), 10);
      
      // Get workout details
      const workoutResult = await db.getFirstAsync<Workout>(
        `SELECT w.id, w.name, w.date, w.completed_at, r.name as routine_name
         FROM workouts w
         JOIN routines r ON w.routine_id = r.id
         WHERE w.id = ?`,
        [workoutId]
      );
      
      if (workoutResult) {
        setWorkout(workoutResult);
        
        // Get workout exercises
        const exerciseResults = await db.getAllAsync<WorkoutExercise>(
          `SELECT we.id, e.name, we.sets_completed
           FROM workout_exercises we
           JOIN exercises e ON we.exercise_id = e.id
           WHERE we.workout_id = ?`,
          [workoutId]
        );
        
        setExercises(exerciseResults);
      } else {
        Alert.alert('Error', 'Workout not found');
        router.back();
      }
    } catch (error) {
      console.error('Error loading workout details:', error);
      Alert.alert('Error', 'Failed to load workout details');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWorkout = async () => {
    if (!workout) return;
    
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            
            try {
              const db = await getDatabase();
              await db.runAsync('DELETE FROM workouts WHERE id = ?', [workout.id]);
              
              Alert.alert('Success', 'Workout deleted successfully', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const calculateDuration = () => {
    if (!workout || !workout.completed_at) return null;
    
    const startTime = new Date(workout.date).getTime();
    const endTime = new Date(workout.completed_at).getTime();
    const durationMs = endTime - startTime;
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${minutes}m ${seconds}s`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Stack.Screen 
          options={{
            title: "Workout Details",
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

  if (!workout) {
    return null;
  }

  const duration = calculateDuration();
  const isCompleted = workout.completed_at !== null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: workout.name,
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerRight: () => (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={deleteWorkout}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <FontAwesome name="trash" size={18} color={colors.error} />
              )}
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.headerSection}>
          <Text style={[styles.workoutName, { color: colors.text }]}>{workout.name}</Text>
          <Text style={[styles.routineName, { color: colors.subtext }]}>
            Based on: {workout.routine_name}
          </Text>
          <Text style={[styles.workoutDate, { color: colors.subtext }]}>
            Started: {formatDate(workout.date)}
          </Text>
          {isCompleted && (
            <>
              <Text style={[styles.workoutCompleted, { color: colors.success }]}>
                Completed: {formatDate(workout.completed_at!)}
              </Text>
              {duration && (
                <Text style={[styles.workoutDuration, { color: colors.subtext }]}>
                  Duration: {duration}
                </Text>
              )}
            </>
          )}
          <View style={[styles.statusBadge, { backgroundColor: isCompleted ? colors.success : colors.warning }]}>
            <Text style={styles.statusText}>
              {isCompleted ? 'Completed' : 'In Progress'}
            </Text>
          </View>
        </View>
        
        <View style={styles.exercisesSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Exercises ({exercises.length})
          </Text>
          
          {exercises.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
              <FontAwesome name="list" size={24} color={colors.subtext} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                No exercises recorded for this workout.
              </Text>
            </View>
          ) : (
            <View style={styles.exercisesList}>
              {exercises.map((exercise, index) => (
                <View 
                  key={exercise.id} 
                  style={[styles.exerciseItem, { backgroundColor: colors.card }]}
                >
                  <View style={styles.exerciseNumber}>
                    <Text style={[styles.exerciseNumberText, { color: 'white' }]}>
                      {index + 1}
                    </Text>
                  </View>
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>
                      {exercise.name}
                    </Text>
                    <Text style={[styles.exerciseSets, { color: colors.subtext }]}>
                      {exercise.sets_completed} set{exercise.sets_completed !== 1 ? 's' : ''} completed
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
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
  headerSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  workoutName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  routineName: {
    fontSize: 16,
    marginBottom: 4,
  },
  workoutDate: {
    fontSize: 14,
    marginBottom: 4,
  },
  workoutCompleted: {
    fontSize: 14,
    marginBottom: 4,
  },
  workoutDuration: {
    fontSize: 14,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
  },
  exercisesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  exercisesList: {
    marginBottom: 16,
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
    marginBottom: 2,
  },
  exerciseSets: {
    fontSize: 14,
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
  deleteButton: {
    padding: 8,
  },
}); 