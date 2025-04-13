import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/context/ThemeContext';

type Workout = {
  id: number;
  name: string;
  date: number;
  completed_at: number | null;
  routine_name: string;
  exercise_count: number;
};

export default function WorkoutsTab() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      console.log('Workouts tab focused, reloading data...');
      loadWorkouts();
      return () => {
        // Cleanup function when screen loses focus (optional)
      };
    }, [])
  );

  const loadWorkouts = async () => {
    try {
      setIsLoading(true);
      const db = await getDatabase();
      const results = await db.getAllAsync<Workout>(`
        SELECT 
          w.id, w.name, w.date, w.completed_at,
          r.name as routine_name,
          (SELECT COUNT(*) FROM workout_exercises WHERE workout_id = w.id) as exercise_count
        FROM workouts w
        LEFT JOIN routines r ON w.routine_id = r.id
        ORDER BY w.date DESC
      `);
      
      setWorkouts(results);
    } catch (error) {
      console.error('Error loading workouts:', error);
      Alert.alert('Error', 'Failed to load workout history');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWorkout = async (workoutId: number) => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              const db = await getDatabase();
              
              // Delete workout exercises first due to foreign key constraint
              await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', [workoutId]);
              
              // Then delete the workout
              await db.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);
              
              // Refresh the workout list
              await loadWorkouts();
            } catch (error) {
              console.error('Error deleting workout:', error);
              Alert.alert('Error', 'Failed to delete workout');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderWorkoutItem = ({ item }: { item: Workout }) => (
    <TouchableOpacity 
      style={[styles.workoutCard, { backgroundColor: colors.card }]}
      onPress={() => router.push({ pathname: "/workout/[id]", params: { id: item.id } })}
    >
      <View style={styles.workoutHeader}>
        <View style={styles.workoutTitleContainer}>
          <Text style={[styles.workoutName, { color: colors.text }]}>{item.name}</Text>
          <Text style={[styles.workoutDate, { color: colors.subtext }]}>
            {formatDate(item.date)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => deleteWorkout(item.id)}
          disabled={isDeleting}
          style={styles.deleteButton}
        >
          <FontAwesome name="trash" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.workoutDetails}>
        <View style={styles.workoutDetail}>
          <FontAwesome name="list" size={14} color={colors.primary} />
          <Text style={[styles.workoutDetailText, { color: colors.subtext }]}>
            {item.exercise_count} exercise{item.exercise_count !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.workoutDetail}>
          <FontAwesome name="calendar" size={14} color={colors.primary} />
          <Text style={[styles.workoutDetailText, { color: colors.subtext }]}>
            {item.routine_name || 'Custom Workout'}
          </Text>
        </View>
        <View style={styles.workoutDetail}>
          <FontAwesome 
            name={item.completed_at ? "check-circle" : "clock-o"} 
            size={14} 
            color={item.completed_at ? colors.success : colors.warning} 
          />
          <Text style={[styles.workoutDetailText, { color: colors.subtext }]}>
            {item.completed_at ? 'Completed' : 'In Progress'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Workout History</Text>
        <TouchableOpacity 
          style={[styles.analyticsButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/analytics')}
        >
          <FontAwesome name="bar-chart" size={16} color="#fff" />
          <Text style={styles.analyticsButtonText}>Analytics</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderWorkoutItem}
        contentContainerStyle={styles.workoutsList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Workouts Yet</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              Start tracking your workouts to see your progress.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  workoutsList: {
    paddingBottom: 20,
  },
  workoutCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workoutTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  workoutDate: {
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
  },
  workoutDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  workoutDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  workoutDetailText: {
    fontSize: 14,
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  analyticsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  analyticsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 6,
  },
}); 