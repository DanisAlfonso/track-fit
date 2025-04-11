import { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect } from '@react-navigation/native';

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
};

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [routine, setRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<RoutineExercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

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
        
        // Get routine exercises
        const exerciseResults = await db.getAllAsync<RoutineExercise>(
          `SELECT re.id, e.name, re.sets, re.order_num as exercise_order, e.id as exercise_id
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

  const editRoutine = () => {
    if (!routine) return;
    router.push(`/routine/edit/${routine.id}`);
  };

  const deleteRoutine = async () => {
    if (!routine) return;
    
    Alert.alert(
      'Delete Routine',
      `Are you sure you want to delete "${routine.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            
            try {
              const db = await getDatabase();
              await db.runAsync('DELETE FROM routines WHERE id = ?', [routine.id]);
              
              Alert.alert('Success', 'Routine deleted successfully', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('Error deleting routine:', error);
              Alert.alert('Error', 'Failed to delete routine');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
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
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: routine.name,
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={editRoutine}
                disabled={isDeleting}
              >
                <FontAwesome name="edit" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={deleteRoutine}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <FontAwesome name="trash" size={18} color={colors.error} />
                )}
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      
      <ScrollView style={styles.scrollView}>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Exercises ({exercises.length})
          </Text>
          
          {exercises.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: colors.card }]}>
              <FontAwesome name="list" size={24} color={colors.subtext} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                No exercises in this routine yet.
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
                      {exercise.sets} set{exercise.sets !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.exerciseButton}
                    onPress={() => router.push(`/exercise/${exercise.exercise_id}`)}
                  >
                    <FontAwesome name="info-circle" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.primary }]}
          onPress={startWorkout}
        >
          <FontAwesome name="play" size={16} color="white" style={styles.startButtonIcon} />
          <Text style={styles.startButtonText}>Start Workout</Text>
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
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  startButtonIcon: {
    marginRight: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
}); 