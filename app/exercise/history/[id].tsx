import { useState, useEffect } from 'react';
import React from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  ActivityIndicator, 
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Animated
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
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

// Define a safe chart rendering component
interface SafeChartProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
}

const SafeChart = ({ children, fallback }: SafeChartProps) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset on new render attempt
    setHasError(false);
  }, [children]);

  if (hasError) {
    return fallback;
  }

  try {
    return children;
  } catch (error) {
    console.error('Error rendering chart:', error);
    setHasError(true);
    return fallback;
  }
};

export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams();
  const exerciseId = typeof id === 'string' ? parseInt(id, 10) : 0;
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { width } = useWindowDimensions();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [exerciseName, setExerciseName] = useState('');
  const [historyData, setHistoryData] = useState<ExerciseHistoryEntry[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  
  const [toggleAnimation] = useState(new Animated.Value(viewMode === 'list' ? 0 : 1));
  
  // Add animation states at the component level
  const [emptyStateAnim] = useState({
    icon: new Animated.Value(0),
    text: new Animated.Value(0),
    button: new Animated.Value(0)
  });
  
  // Add a state for available routines
  const [availableRoutines, setAvailableRoutines] = useState<{id: number, name: string}[]>([]);
  
  useEffect(() => {
    loadExerciseHistory();
  }, [exerciseId]);
  
  useEffect(() => {
    Animated.timing(toggleAnimation, {
      toValue: viewMode === 'list' ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [viewMode]);
  
  useEffect(() => {
    if (viewMode === 'chart' && historyData.length < 2) {
      // Reset animations
      emptyStateAnim.icon.setValue(0);
      emptyStateAnim.text.setValue(0);
      emptyStateAnim.button.setValue(0);
      
      // Run sequential animations
      Animated.sequence([
        Animated.timing(emptyStateAnim.icon, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.timing(emptyStateAnim.text, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.timing(emptyStateAnim.button, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [viewMode, historyData.length]);
  
  const loadExerciseHistory = async () => {
    if (!exerciseId) {
      setLoading(false);
      return;
    }
    
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
      
      // Get available routines
      const routines = await db.getAllAsync<{id: number, name: string}>(
        'SELECT id, name FROM routines ORDER BY created_at DESC'
      );
      setAvailableRoutines(routines);
      
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
  
  const renderNoDataState = () => {
    if (availableRoutines.length === 0) {
      // No routines available
      return (
        <View style={styles.emptyStateContainer}>
          <Animated.View 
            style={[
              styles.emptyIconBg, 
              { 
                backgroundColor: `${colors.primary}20`,
                transform: [
                  { scale: emptyStateAnim.icon.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1]
                  })},
                  { translateY: emptyStateAnim.icon.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })}
                ],
                opacity: emptyStateAnim.icon.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                })
              }
            ]}
          >
            <FontAwesome name="line-chart" size={40} color={colors.primary} />
          </Animated.View>
          
          <Animated.Text 
            style={[
              styles.emptyStateTitle, 
              { 
                color: colors.text,
                opacity: emptyStateAnim.text.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 0]
                  })
                }]
              }
            ]}
          >
            No Routines Yet
          </Animated.Text>
          
          <Animated.Text 
            style={[
              styles.emptyStateText, 
              { 
                color: colors.subtext,
                opacity: emptyStateAnim.text.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }
            ]}
          >
            Create a routine first to start tracking your progress with this exercise.
          </Animated.Text>
          
          <Animated.View 
            style={[
              styles.startButtonContainer,
              { 
                opacity: emptyStateAnim.button.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.button.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/routine/create')}
            >
              <FontAwesome name="plus-circle" size={16} color="#ffffff" style={styles.startButtonIcon} />
              <Text style={styles.startButtonText}>Create Routine</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      );
    } else if (availableRoutines.length === 1) {
      // One routine available - direct start
      return (
        <View style={styles.emptyStateContainer}>
          <Animated.View 
            style={[
              styles.emptyIconBg, 
              { 
                backgroundColor: `${colors.primary}20`,
                transform: [
                  { scale: emptyStateAnim.icon.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1]
                  })},
                  { translateY: emptyStateAnim.icon.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })}
                ],
                opacity: emptyStateAnim.icon.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                })
              }
            ]}
          >
            <FontAwesome name="line-chart" size={40} color={colors.primary} />
          </Animated.View>
          
          <Animated.Text 
            style={[
              styles.emptyStateTitle, 
              { 
                color: colors.text,
                opacity: emptyStateAnim.text.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 0]
                  })
                }]
              }
            ]}
          >
            No Progress Data Yet
          </Animated.Text>
          
          <Animated.Text 
            style={[
              styles.emptyStateText, 
              { 
                color: colors.subtext,
                opacity: emptyStateAnim.text.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }
            ]}
          >
            Complete a workout with this exercise to start tracking your progress.
          </Animated.Text>
          
          <Animated.View 
            style={[
              styles.startButtonContainer,
              { 
                opacity: emptyStateAnim.button.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.button.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                // Navigate to the specific routine first, then let user start workout from there
                router.push(`/routine/${availableRoutines[0].id}`);
              }}
            >
              <FontAwesome name="play-circle" size={16} color="#ffffff" style={styles.startButtonIcon} />
              <Text style={styles.startButtonText}>View Routine</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      );
    } else {
      // Multiple routines - show choose routine button
      return (
        <View style={styles.emptyStateContainer}>
          <Animated.View 
            style={[
              styles.emptyIconBg, 
              { 
                backgroundColor: `${colors.primary}20`,
                transform: [
                  { scale: emptyStateAnim.icon.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1]
                  })},
                  { translateY: emptyStateAnim.icon.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })}
                ],
                opacity: emptyStateAnim.icon.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                })
              }
            ]}
          >
            <FontAwesome name="line-chart" size={40} color={colors.primary} />
          </Animated.View>
          
          <Animated.Text 
            style={[
              styles.emptyStateTitle, 
              { 
                color: colors.text,
                opacity: emptyStateAnim.text.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 0]
                  })
                }]
              }
            ]}
          >
            No Progress Data Yet
          </Animated.Text>
          
          <Animated.Text 
            style={[
              styles.emptyStateText, 
              { 
                color: colors.subtext,
                opacity: emptyStateAnim.text.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }
            ]}
          >
            Complete a workout with this exercise to start tracking your progress.
          </Animated.Text>
          
          <Animated.View 
            style={[
              styles.startButtonContainer,
              { 
                opacity: emptyStateAnim.button.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.button.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(tabs)/routines')}
            >
              <FontAwesome name="list-ul" size={16} color="#ffffff" style={styles.startButtonIcon} />
              <Text style={styles.startButtonText}>View Routines</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      );
    }
  };
  
  const renderChartData = () => {
    if (historyData.length === 0) {
      return renderNoDataState();
    }
    
    // Reverse the data to show chronological progression
    const chartData = [...historyData].reverse();
    
    // Update the "More Data Needed" state with animations
    if (chartData.length < 2) {
      return (
        <View style={styles.emptyStateContainer}>
          <Animated.View 
            style={[
              styles.emptyIconBg, 
              { 
                backgroundColor: `${colors.primary}15`,
                transform: [
                  { scale: emptyStateAnim.icon.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1]
                  })},
                  { translateY: emptyStateAnim.icon.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })}
                ],
                opacity: emptyStateAnim.icon.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                })
              }
            ]}
          >
            <FontAwesome name="bar-chart" size={40} color={colors.primary} />
          </Animated.View>
          
          <Animated.Text 
            style={[
              styles.emptyStateTitle, 
              { 
                color: colors.text,
                opacity: emptyStateAnim.text.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [15, 0]
                  })
                }]
              }
            ]}
          >
            More Data Needed
          </Animated.Text>
          
          <Animated.Text 
            style={[
              styles.emptyStateText, 
              { 
                color: colors.subtext,
                opacity: emptyStateAnim.text.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }
            ]}
          >
            Complete at least one more workout with this exercise to see your progress charts.
          </Animated.Text>
          
          <Animated.View 
            style={[
              styles.dataPreviewContainer,
              { 
                opacity: emptyStateAnim.button.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                }),
                transform: [{ 
                  translateY: emptyStateAnim.button.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0]
                  })
                }]
              }
            ]}
          >
            <View style={[styles.dataPreviewCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.dataPreviewLabel, { color: colors.subtext }]}>
                Last Workout
              </Text>
              <Text style={[styles.dataPreviewValue, { color: colors.text }]}>
                {chartData[0].date}
              </Text>
              <Text style={[styles.dataPreviewInfo, { color: colors.primary }]}>
                {chartData[0].totalVolume.toLocaleString()} volume • {chartData[0].maxWeight} kg max
              </Text>
            </View>
          </Animated.View>
        </View>
      );
    }
    
    // Create a simple fallback chart display
    const fallbackChart = (
      <View style={[styles.fallbackChart, { backgroundColor: colors.card }]}>
        <FontAwesome name="area-chart" size={32} color={colors.primary} style={{ opacity: 0.5 }} />
        <Text style={[styles.fallbackText, { color: colors.text }]}>
          {Platform.OS === 'android' ? 'Chart visualization unavailable' : 'Unable to display chart'}
        </Text>
        <TouchableOpacity
          onPress={() => setViewMode('list')}
          style={[styles.fallbackButton, { borderColor: colors.primary }]}
        >
          <Text style={[styles.fallbackButtonText, { color: colors.primary }]}>View as List</Text>
        </TouchableOpacity>
      </View>
    );
    
    return (
      <View style={styles.chartContainer}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>Volume Progression</Text>
        
        <SafeChart fallback={fallbackChart}>
          <LineChart
            data={{
              labels: chartData.map(entry => entry.date.substring(0, 6)),
              datasets: [
                {
                  data: chartData.map(entry => entry.totalVolume),
                  color: () => colors.primary,
                  strokeWidth: 3
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
              labelColor: () => colors.subtext,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: colors.card
              },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: colors.border || '#E1E1E1',
                strokeWidth: 1
              },
              formatYLabel: (value) => parseInt(value).toLocaleString()
            }}
            bezier
            style={{
              borderRadius: 16,
              paddingRight: 0,
              backgroundColor: colors.card,
              elevation: 2,
            }}
          />
        </SafeChart>
        
        <Text style={[styles.chartTitle, { color: colors.text, marginTop: 20 }]}>Max Weight Progression</Text>
        
        <SafeChart fallback={fallbackChart}>
          <LineChart
            data={{
              labels: chartData.map(entry => entry.date.substring(0, 6)),
              datasets: [
                {
                  data: chartData.map(entry => entry.maxWeight),
                  color: () => colors.primary,
                  strokeWidth: 3
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
              labelColor: () => colors.subtext,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: '6',
                strokeWidth: '2',
                stroke: colors.card
              },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: colors.border || '#E1E1E1',
                strokeWidth: 1
              }
            }}
            bezier
            style={{
              borderRadius: 16,
              paddingRight: 0,
              backgroundColor: colors.card,
              elevation: 2,
            }}
          />
        </SafeChart>
      </View>
    );
  };
  
  const renderListData = () => {
    if (historyData.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
            <FontAwesome name="history" size={28} color={colors.primary} style={{ opacity: 0.6 }} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No History Yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.subtext }]}>
            Complete workouts with this exercise to track your progress over time.
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
  
  // Add safe navigation function
  const handleGoBack = () => {
    try {
      router.back();
    } catch (error) {
      console.error('Error navigating back:', error);
      // Fallback navigation to exercises tab if router.back() fails
      router.replace('/(tabs)/exercises');
    }
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
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
          },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleGoBack}
              style={styles.backButton}
            >
              <FontAwesome name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <View style={styles.viewToggleContainer}>
        <View style={[styles.viewToggle, { backgroundColor: colors.card }]}>
          <Animated.View 
            style={[
              styles.toggleActiveBackground, 
              { 
                backgroundColor: colors.primary,
                left: toggleAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['2%', '52%']
                })
              }
            ]} 
          />
          <TouchableOpacity 
            style={styles.toggleButton}
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
            style={styles.toggleButton}
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
  emptyIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
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
  viewToggleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  toggleActiveBackground: {
    position: 'absolute',
    width: '46%',
    height: '84%',
    borderRadius: 10,
    top: '8%',
    zIndex: 0,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    zIndex: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
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
  fallbackChart: {
    width: '100%',
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  fallbackText: {
    marginTop: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  fallbackButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  fallbackButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    padding: 8,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    height: 400,
  },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  startButtonContainer: {
    marginTop: 8,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
  },
  startButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  startButtonIcon: {
    marginRight: 8,
  },
  dataPreviewContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 8,
  },
  dataPreviewCard: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  dataPreviewLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  dataPreviewValue: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  dataPreviewInfo: {
    fontSize: 14,
  },
}); 