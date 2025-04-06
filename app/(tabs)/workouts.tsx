import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';

type Workout = {
  id: number;
  name: string;
  date: number;
  duration: number | null;
  notes: string | null;
  routine_id: number | null;
  routine_name?: string;
  exerciseCount?: number;
};

export default function WorkoutsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      const db = await getDatabase();
      const results = await db.getAllAsync<Workout>(`
        SELECT 
          w.id, w.name, w.date, w.duration, w.notes, w.routine_id,
          r.name as routine_name,
          (SELECT COUNT(*) FROM workout_exercises WHERE workout_id = w.id) as exerciseCount
        FROM workouts w
        LEFT JOIN routines r ON w.routine_id = r.id
        ORDER BY w.date DESC
      `);
      
      setWorkouts(results);
    } catch (error) {
      console.error('Error loading workouts:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const renderWorkoutItem = ({ item }: { item: Workout }) => (
    <TouchableOpacity 
      style={[styles.workoutCard, { backgroundColor: colors.card }]}
      onPress={() => {/* Navigate to workout details */}}
    >
      <View style={styles.workoutHeader}>
        <Text style={[styles.workoutName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.workoutDate, { color: colors.subtext }]}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.workoutDetails}>
        <View style={styles.workoutDetail}>
          <FontAwesome name="th-list" size={14} color={colors.primary} />
          <Text style={[styles.workoutDetailText, { color: colors.subtext }]}>
            {item.exerciseCount} exercise{item.exerciseCount !== 1 ? 's' : ''}
          </Text>
        </View>
        {item.duration && (
          <View style={styles.workoutDetail}>
            <FontAwesome name="clock-o" size={14} color={colors.primary} />
            <Text style={[styles.workoutDetailText, { color: colors.subtext }]}>
              {formatDuration(item.duration)}
            </Text>
          </View>
        )}
        {item.routine_name && (
          <View style={styles.workoutDetail}>
            <FontAwesome name="calendar" size={14} color={colors.primary} />
            <Text style={[styles.workoutDetailText, { color: colors.subtext }]}>
              {item.routine_name}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Workout History</Text>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.primary }]}
          onPress={() => {/* Navigate to start workout screen */}}
        >
          <FontAwesome name="play" size={16} color="white" />
          <Text style={styles.startButtonText}>Start Workout</Text>
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
            <TouchableOpacity
              style={[styles.startEmptyButton, { backgroundColor: colors.primary }]}
              onPress={() => {/* Navigate to start workout screen */}}
            >
              <Text style={styles.startEmptyButtonText}>Start Your First Workout</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  startButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  workoutDate: {
    fontSize: 14,
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
    marginBottom: 24,
  },
  startEmptyButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  startEmptyButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 