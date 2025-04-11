import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  ActivityIndicator, 
  TouchableOpacity,
  useWindowDimensions
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { FontAwesome } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { format } from 'date-fns';

type ExerciseHistoryEntry = {
  date: string;
  workout_name: string;
  sets: {
    set_number: number;
    reps: number;
    weight: number;
  }[];
  totalVolume: number;
  maxWeight: number;
};

type WorkoutExercise = {
  workout_exercise_id: number;
  workout_id: number;
  workout_name: string;
  workout_date: number;
};

type SetData = {
  set_number: number;
  reps: number;
  weight: number;
};

export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams();
  const exerciseId = typeof id === 'string' ? parseInt(id, 10) : 0;
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { width } = useWindowDimensions();
  
  const [loading, setLoading] = useState(true);
  const [exerciseName, setExerciseName] = useState('');
  const [historyData, setHistoryData] = useState<ExerciseHistoryEntry[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  
  useEffect(() => {
    loadExerciseHistory();
  }, [exerciseId]);
  
  const loadExerciseHistory = async () => {
    if (!exerciseId) return;
    
    try {
      setLoading(true);
      const db = await getDatabase();
      
      // Get exercise name
      const exercise = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM exercises WHERE id = ?',
        [exerciseId]
      );
      
      if (exercise) {
        setExerciseName(exercise.name);
      }
      
      // Get workouts containing this exercise
      const workoutExercises = await db.getAllAsync<WorkoutExercise>(
        `SELECT 
          we.id as workout_exercise_id,
          w.id as workout_id,
          w.name as workout_name,
          w.date as workout_date
         FROM workout_exercises we
         JOIN workouts w ON we.workout_id = w.id
         WHERE we.exercise_id = ? AND w.completed_at IS NOT NULL
         ORDER BY w.date DESC
         LIMIT 20`,
        [exerciseId]
      );
      
      const history: ExerciseHistoryEntry[] = [];
      
      for (const workoutExercise of workoutExercises) {
        // Get sets for this workout exercise
        const sets = await db.getAllAsync<SetData>(
          `SELECT set_number, reps, weight
           FROM sets
           WHERE workout_exercise_id = ?
           ORDER BY set_number`,
          [workoutExercise.workout_exercise_id]
        );
        
        if (sets.length > 0) {
          // Calculate total volume and max weight
          const totalVolume = sets.reduce((sum, set) => sum + (set.reps * set.weight), 0);
          const maxWeight = Math.max(...sets.map(set => set.weight));
          
          history.push({
            date: format(new Date(workoutExercise.workout_date), 'MMM d, yyyy'),
            workout_name: workoutExercise.workout_name,
            sets,
            totalVolume,
            maxWeight
          });
        }
      }
      
      setHistoryData(history);
    } catch (error) {
      console.error('Error loading exercise history:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const renderChartData = () => {
    if (historyData.length === 0) return null;
    
    // Reverse the data to show chronological progression
    const chartData = [...historyData].reverse();
    
    return (
      <View style={styles.chartContainer}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>Volume Progression</Text>
        <LineChart
          data={{
            labels: chartData.map(entry => entry.date.substring(0, 6)),
            datasets: [
              {
                data: chartData.map(entry => entry.totalVolume),
                color: () => colors.primary,
                strokeWidth: 2
              }
            ]
          }}
          width={width - 32}
          height={220}
          chartConfig={{
            backgroundColor: colors.card,
            backgroundGradientFrom: colors.card,
            backgroundGradientTo: colors.card,
            decimalPlaces: 0,
            color: () => colors.primary,
            labelColor: () => colors.text,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '5',
              strokeWidth: '2',
              stroke: colors.primary
            }
          }}
          bezier
          style={{
            borderRadius: 16,
            padding: 16,
            backgroundColor: colors.card,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        />
        
        <Text style={[styles.chartTitle, { color: colors.text, marginTop: 20 }]}>Max Weight Progression</Text>
        <LineChart
          data={{
            labels: chartData.map(entry => entry.date.substring(0, 6)),
            datasets: [
              {
                data: chartData.map(entry => entry.maxWeight),
                color: () => colors.primary,
                strokeWidth: 2
              }
            ]
          }}
          width={width - 32}
          height={220}
          chartConfig={{
            backgroundColor: colors.card,
            backgroundGradientFrom: colors.card,
            backgroundGradientTo: colors.card,
            decimalPlaces: 1,
            color: () => colors.primary,
            labelColor: () => colors.text,
            style: {
              borderRadius: 16
            },
            propsForDots: {
              r: '5',
              strokeWidth: '2',
              stroke: colors.primary
            }
          }}
          bezier
          style={{
            borderRadius: 16,
            padding: 16,
            backgroundColor: colors.card,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
          }}
        />
      </View>
    );
  };
  
  const renderListData = () => {
    if (historyData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <FontAwesome name="history" size={50} color={colors.subtext} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No workout history found for this exercise
          </Text>
        </View>
      );
    }
    
    return historyData.map((entry, index) => (
      <View 
        key={index} 
        style={[styles.historyCard, { backgroundColor: colors.card }]}
      >
        <View style={styles.historyCardHeader}>
          <Text style={[styles.historyDate, { color: colors.text }]}>{entry.date}</Text>
          <Text style={[styles.historyWorkoutName, { color: colors.subtext }]}>
            {entry.workout_name}
          </Text>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {entry.totalVolume.toLocaleString()}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Volume</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {entry.maxWeight}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Max Weight</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {entry.sets.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.subtext }]}>Sets</Text>
          </View>
        </View>
        
        <View style={styles.setsContainer}>
          <Text style={[styles.setsTitle, { color: colors.text }]}>Sets</Text>
          {entry.sets.map((set, setIndex) => (
            <View 
              key={setIndex} 
              style={[styles.setItem, { backgroundColor: colors.background }]}
            >
              <Text style={[styles.setText, { color: colors.text }]}>
                Set {set.set_number}
              </Text>
              <Text style={[styles.setText, { color: colors.text }]}>
                {set.reps} reps
              </Text>
              <Text style={[styles.setText, { color: colors.text }]}>
                {set.weight} kg
              </Text>
            </View>
          ))}
        </View>
      </View>
    ));
  };
  
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Stack.Screen 
          options={{
            title: "Exercise History",
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          title: exerciseName ? `${exerciseName} History` : "Exercise History",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      
      <View style={styles.viewToggle}>
        <TouchableOpacity 
          style={[
            styles.toggleButton, 
            viewMode === 'list' && [styles.activeToggle, { backgroundColor: colors.primary }]
          ]}
          onPress={() => setViewMode('list')}
        >
          <FontAwesome 
            name="list" 
            size={16} 
            color={viewMode === 'list' ? '#fff' : colors.text} 
          />
          <Text 
            style={[
              styles.toggleText, 
              { color: viewMode === 'list' ? '#fff' : colors.text }
            ]}
          >
            List
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.toggleButton, 
            viewMode === 'chart' && [styles.activeToggle, { backgroundColor: colors.primary }]
          ]}
          onPress={() => setViewMode('chart')}
        >
          <FontAwesome 
            name="line-chart" 
            size={16} 
            color={viewMode === 'chart' ? '#fff' : colors.text} 
          />
          <Text 
            style={[
              styles.toggleText, 
              { color: viewMode === 'chart' ? '#fff' : colors.text }
            ]}
          >
            Charts
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {viewMode === 'list' ? renderListData() : renderChartData()}
      </ScrollView>
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
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  historyCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  historyCardHeader: {
    marginBottom: 12,
  },
  historyDate: {
    fontSize: 18,
    fontWeight: '600',
  },
  historyWorkoutName: {
    fontSize: 14,
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  setsContainer: {
    marginTop: 8,
  },
  setsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  setItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  setText: {
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    margin: 16,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  activeToggle: {
    borderRadius: 8,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  chart: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
}); 