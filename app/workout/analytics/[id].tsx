import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, SafeAreaView } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import Colors from '../../../constants/Colors';
import { useColorScheme } from '../../../hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import { formatDate, calculateDuration } from '../../../utils/dateUtils';
import { getDatabase } from '../../../utils/database';
import { LineChart, BarChart, PieChart, ContributionGraph } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';

// Types
interface Set {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  weight: number;
  reps: number;
  rest_time: number | null;
  notes: string | null;
  training_type?: 'heavy' | 'moderate' | 'light';
}

interface ExerciseWithSets {
  id: number;
  exercise_id: number;
  workout_id: number;
  name: string;
  primary_muscle: string;
  sets: Set[];
  notes: string | null;
  previousData: {
    date: string;
    volume: number;
    maxWeight: number;
  }[];
}

interface PreviousWorkout {
  id: number;
  workout_id: number;
  exercise_id: number;
  sets: Set[];
  date: string;
}

interface Workout {
  id: number;
  routine_id: number;
  routine_name: string;
  date: string;
  completed_at: string | null;
  duration: number | null;
  notes: string | null;
}

export default function WorkoutAnalyticsScreen() {
  const params = useLocalSearchParams();
  const workoutId = params.id as string;
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  
  const windowWidth = Dimensions.get('window').width;
  
  // State
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercisesWithSets, setExercisesWithSets] = useState<ExerciseWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);
  const [previousWorkouts, setPreviousWorkouts] = useState<PreviousWorkout[]>([]);
  const [selectedTab, setSelectedTab] = useState<'volume' | 'muscles' | 'progress' | 'training'>('volume');
  const [volumeHistory, setVolumeHistory] = useState<{date: string; volume: number}[]>([]);
  const [muscleGroups, setMuscleGroups] = useState<Record<string, number>>({});
  const [trainingTypeDistribution, setTrainingTypeDistribution] = useState<Record<string, number>>({
    heavy: 0,
    moderate: 0,
    light: 0,
    unspecified: 0
  });
  
  // Load workout details
  useEffect(() => {
    let isMounted = true;

    const loadWorkoutDetails = async () => {
      try {
        setLoading(true);
        const db = await getDatabase();
        
        // Load workout info
        const workoutResult = await db.getAllAsync(
          `SELECT w.*, r.name as routine_name 
           FROM workouts w
           LEFT JOIN routines r ON w.routine_id = r.id
           WHERE w.id = ?`,
          [workoutId]
        );
        
        if (workoutResult.length === 0 || !isMounted) {
          console.error('Workout not found');
          if (isMounted) setLoading(false);
          return;
        }

        const workoutData = workoutResult[0] as unknown as Workout;
        if (isMounted) setWorkout(workoutData);

        // Load exercises with sets
        await loadExercisesWithSets(workoutData.routine_id);
      } catch (error) {
        console.error('Error loading workout details:', error);
        if (isMounted) setLoading(false);
      }
    };

    const loadExercisesWithSets = async (routineId: number) => {
      if (!isMounted) return;
      
      try {
        const db = await getDatabase();
        
        // Get exercises for this workout
        const exercisesResult = await db.getAllAsync(
          `SELECT we.id, we.exercise_id, we.workout_id, we.notes, e.name, e.primary_muscle
           FROM workout_exercises we
           JOIN exercises e ON we.exercise_id = e.id
           WHERE we.workout_id = ?
           ORDER BY we.id`,
          [workoutId]
        );

        if (exercisesResult.length === 0 || !isMounted) {
          if (isMounted) setLoading(false);
          return;
        }

        // Initialize exercises with empty sets
        const exercises = exercisesResult.map((ex: any) => ({
          ...ex,
          sets: [],
          previousData: []
        })) as ExerciseWithSets[];

        // Load sets for each exercise and calculate volumes
        let totalSets = 0;
        let calculatedVolume = 0;
        const muscleGroupsData: Record<string, number> = {};
        const trainingTypesData: Record<string, number> = {
          heavy: 0,
          moderate: 0,
          light: 0,
          unspecified: 0
        };

        for (const exercise of exercises) {
          if (!isMounted) return;
          
          const setsResult = await db.getAllAsync(
            `SELECT * FROM sets WHERE workout_exercise_id = ? ORDER BY set_number`,
            [exercise.id]
          );
          
          const exerciseSets = setsResult as unknown as Set[];
          exercise.sets = exerciseSets;
          
          totalSets += exerciseSets.length;
          const exerciseVolume = exerciseSets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
          calculatedVolume += exerciseVolume;
          
          // Populate muscle groups data
          const muscleName = exercise.primary_muscle;
          if (muscleGroupsData[muscleName]) {
            muscleGroupsData[muscleName] += exerciseVolume;
          } else {
            muscleGroupsData[muscleName] = exerciseVolume;
          }
          
          // Calculate training type distribution
          exerciseSets.forEach(set => {
            const trainingType = set.training_type || 'unspecified';
            const setVolume = set.weight * set.reps;
            
            if (trainingTypesData[trainingType]) {
              trainingTypesData[trainingType] += setVolume;
            } else {
              trainingTypesData[trainingType] = setVolume;
            }
          });
        }

        if (!isMounted) return;
        
        if (isMounted) {
          setExercisesWithSets(exercises);
          setTotalVolume(calculatedVolume);
          setMuscleGroups(muscleGroupsData);
          setTrainingTypeDistribution(trainingTypesData);
        }

        // Load previous workouts for comparison
        await loadHistoricalData(routineId, exercises);
      } catch (error) {
        console.error('Error loading exercises and sets:', error);
        if (isMounted) setLoading(false);
      }
    };

    const loadHistoricalData = async (routineId: number, exercises: ExerciseWithSets[]) => {
      if (!isMounted) return;
      
      try {
        const db = await getDatabase();
        
        // Get previous workouts
        const previousWorkoutsResult = await db.getAllAsync<{id: number, date: string, completed_at: string | null, duration: number | null, routine_id: number}>(
          `SELECT w.id, w.date, w.completed_at, w.duration, w.routine_id
           FROM workouts w
           WHERE w.routine_id = ? AND w.completed_at IS NOT NULL
           ORDER BY w.date DESC
           LIMIT 10`,
          [routineId]
        );

        if (!isMounted) return;

        // Get volume history for this routine
        const volumeHistoryData: {date: string; volume: number}[] = [];
        
        for (const prevWorkout of previousWorkoutsResult) {
          if (!isMounted) return;
          
          const workoutExercises = await db.getAllAsync<{id: number}>(
            `SELECT we.id FROM workout_exercises we WHERE we.workout_id = ?`,
            [prevWorkout.id]
          );
          
          let workoutVolume = 0;
          
          for (const workoutExercise of workoutExercises) {
            if (!isMounted) return;
            
            const sets = await db.getAllAsync<Set>(
              `SELECT * FROM sets WHERE workout_exercise_id = ?`,
              [workoutExercise.id]
            );
            
            workoutVolume += sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
          }
          
          volumeHistoryData.push({
            date: prevWorkout.date,
            volume: workoutVolume
          });
        }

        if (isMounted) {
          // Sort volume history by date
          volumeHistoryData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setVolumeHistory(volumeHistoryData);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading historical data:', error);
        if (isMounted) setLoading(false);
      }
    };

    loadWorkoutDetails();

    return () => {
      isMounted = false;
    };
  }, [workoutId]);

  // Calculate volume for a specific exercise
  const calculateExerciseVolume = (exercise: ExerciseWithSets): number => {
    return exercise.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
  };

  // Calculate max weight for an exercise
  const calculateMaxWeight = (exercise: ExerciseWithSets): number => {
    if (exercise.sets.length === 0) return 0;
    return Math.max(...exercise.sets.map(set => set.weight));
  };
  
  // Render tab selector
  const renderTabSelector = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            selectedTab === 'volume' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('volume')}
        >
          <Text style={[
            styles.tabButtonText, 
            { color: selectedTab === 'volume' ? '#fff' : colors.text }
          ]}>
            Volume
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            selectedTab === 'muscles' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('muscles')}
        >
          <Text style={[
            styles.tabButtonText, 
            { color: selectedTab === 'muscles' ? '#fff' : colors.text }
          ]}>
            Muscles
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            selectedTab === 'progress' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('progress')}
        >
          <Text style={[
            styles.tabButtonText, 
            { color: selectedTab === 'progress' ? '#fff' : colors.text }
          ]}>
            Progress
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            selectedTab === 'training' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('training')}
        >
          <Text style={[
            styles.tabButtonText, 
            { color: selectedTab === 'training' ? '#fff' : colors.text }
          ]}>
            Training
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render volume tab content
  const renderVolumeTab = () => {
    // Prepare volume chart data
    const volumeData = {
      labels: volumeHistory.slice(-6).map(d => {
        const date = new Date(d.date);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      datasets: [
        {
          data: volumeHistory.slice(-6).map(d => d.volume),
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
          strokeWidth: 2
        }
      ],
      legend: ["Workout Volume"]
    };
    
    // Calculate volume trend (percentage change from first to last)
    let volumeTrend = 0;
    if (volumeHistory.length >= 2) {
      const firstVolume = volumeHistory[0].volume;
      const lastVolume = volumeHistory[volumeHistory.length - 1].volume;
      volumeTrend = ((lastVolume - firstVolume) / firstVolume) * 100;
    }
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Workout Volume Progression
          </Text>
          
          {volumeHistory.length > 1 ? (
            <>
              <LineChart
                data={volumeData}
                width={windowWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: colors.card,
                  backgroundGradientFrom: colors.card,
                  backgroundGradientTo: colors.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(${colorScheme === 'dark' ? '134, 65, 244' : '134, 65, 244'}, ${opacity})`,
                  labelColor: (opacity = 1) => colors.text,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: "6",
                    strokeWidth: "2",
                    stroke: colors.primary
                  }
                }}
                bezier
                style={{
                  marginVertical: 8,
                  borderRadius: 16
                }}
                formatYLabel={(value) => `${parseInt(value)}kg`}
              />
              
              <View style={styles.trendContainer}>
                <Text style={[styles.trendLabel, { color: colors.text }]}>
                  Overall Trend:
                </Text>
                <Text style={[
                  styles.trendValue, 
                  { color: volumeTrend >= 0 ? '#4CAF50' : '#F44336' }
                ]}>
                  {volumeTrend >= 0 ? '+' : ''}{volumeTrend.toFixed(1)}%
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="chart-timeline-variant" size={40} color={colors.subtext} />
              <Text style={[styles.noDataText, {color: colors.subtext}]}>
                Not enough workout data to show trends
              </Text>
            </View>
          )}
        </View>
        
        <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Volume Summary
          </Text>
          
          <View style={styles.volumeStatsContainer}>
            <View style={styles.volumeStat}>
              <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                Current Volume
              </Text>
              <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                {totalVolume.toLocaleString()} kg
              </Text>
            </View>
            
            {volumeHistory.length > 0 && (
              <>
                <View style={styles.volumeStat}>
                  <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                    Average Volume
                  </Text>
                  <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                    {Math.round(volumeHistory.reduce((sum, item) => sum + item.volume, 0) / volumeHistory.length).toLocaleString()} kg
                  </Text>
                </View>
                
                <View style={styles.volumeStat}>
                  <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                    Maximum Volume
                  </Text>
                  <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                    {Math.max(...volumeHistory.map(item => item.volume)).toLocaleString()} kg
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };
  
  // Render muscles tab content
  const renderMusclesTab = () => {
    // Convert to chart data
    const chartColors = [
      '#FF5733', '#33A8FF', '#33FF57', '#A833FF', '#FF33A8', 
      '#FFD733', '#33FFEC', '#7BFF33', '#FF338A', '#33AAFF'
    ];
    
    const pieChartData = Object.entries(muscleGroups).map(([name, volume], index) => {
      return {
        name,
        volume,
        legendFontColor: colors.text,
        legendFontSize: 12,
        color: chartColors[index % chartColors.length]
      };
    });
    
    // Prepare data for bar chart
    const barChartData = {
      labels: Object.keys(muscleGroups).slice(0, 6).map(name => name.substring(0, 5) + '...'),
      datasets: [
        {
          data: Object.values(muscleGroups).slice(0, 6)
        }
      ]
    };
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Volume by Muscle Group
          </Text>
          
          {Object.keys(muscleGroups).length > 0 ? (
            <>
              <PieChart
                data={pieChartData}
                width={windowWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: colors.card,
                  backgroundGradientFrom: colors.card,
                  backgroundGradientTo: colors.card,
                  color: (opacity = 1) => `rgba(${colorScheme === 'dark' ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(${colorScheme === 'dark' ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`
                }}
                accessor="volume"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute={false}
                avoidFalseZero={true}
              />
              
              <View style={styles.focusContainer}>
                <Text style={[styles.focusLabel, { color: colors.text }]}>
                  Primary Focus:
                </Text>
                <Text style={[styles.focusValue, { color: colors.primary }]}>
                  {Object.entries(muscleGroups).sort((a, b) => b[1] - a[1])[0][0]}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="chart-pie" size={40} color={colors.subtext} />
              <Text style={[styles.noDataText, {color: colors.subtext}]}>
                No muscle group data available
              </Text>
            </View>
          )}
        </View>
        
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Volume Distribution
          </Text>
          
          {Object.keys(muscleGroups).length > 0 ? (
            <BarChart
              data={barChartData}
              width={windowWidth - 40}
              height={220}
              yAxisLabel=""
              yAxisSuffix=" kg"
              chartConfig={{
                backgroundColor: colors.card,
                backgroundGradientFrom: colors.card,
                backgroundGradientTo: colors.card,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(${colorScheme === 'dark' ? '86, 171, 255' : '0, 112, 244'}, ${opacity})`,
                labelColor: (opacity = 1) => colors.text,
                style: {
                  borderRadius: 16
                },
                barPercentage: 0.7
              }}
              style={{
                marginVertical: 8,
                borderRadius: 16
              }}
              showValuesOnTopOfBars={true}
              fromZero={true}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="chart-bar" size={40} color={colors.subtext} />
              <Text style={[styles.noDataText, {color: colors.subtext}]}>
                No muscle group data available
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };
  
  // Render progress tab content
  const renderProgressTab = () => {
    // Prepare data for exercise progress
    const exerciseProgress = exercisesWithSets.map(exercise => {
      const volume = calculateExerciseVolume(exercise);
      const maxWeight = calculateMaxWeight(exercise);
      
      return {
        name: exercise.name,
        volume,
        maxWeight,
        reps: exercise.sets.reduce((sum, set) => sum + set.reps, 0),
        sets: exercise.sets.length
      };
    });
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Exercise Breakdown
          </Text>
          
          {exerciseProgress.length > 0 ? (
            <ScrollView style={styles.exerciseProgressContainer}>
              {exerciseProgress.map((exercise, index) => (
                <View key={index} style={styles.exerciseProgressItem}>
                  <View style={styles.exerciseProgressHeader}>
                    <Text style={[styles.exerciseProgressName, { color: colors.text }]}>
                      {exercise.name}
                    </Text>
                    <Text style={[styles.exerciseProgressSets, { color: colors.subtext }]}>
                      {exercise.sets} sets
                    </Text>
                  </View>
                  
                  <View style={styles.exerciseProgressStats}>
                    <View style={styles.exerciseProgressStat}>
                      <Text style={[styles.exerciseProgressStatLabel, { color: colors.subtext }]}>
                        Volume
                      </Text>
                      <Text style={[styles.exerciseProgressStatValue, { color: colors.text }]}>
                        {exercise.volume.toLocaleString()} kg
                      </Text>
                    </View>
                    
                    <View style={styles.exerciseProgressStat}>
                      <Text style={[styles.exerciseProgressStatLabel, { color: colors.subtext }]}>
                        Max Weight
                      </Text>
                      <Text style={[styles.exerciseProgressStatValue, { color: colors.text }]}>
                        {exercise.maxWeight} kg
                      </Text>
                    </View>
                    
                    <View style={styles.exerciseProgressStat}>
                      <Text style={[styles.exerciseProgressStatLabel, { color: colors.subtext }]}>
                        Total Reps
                      </Text>
                      <Text style={[styles.exerciseProgressStatValue, { color: colors.text }]}>
                        {exercise.reps}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.exerciseProgressBar}>
                    <View 
                      style={[
                        styles.exerciseProgressBarFill, 
                        { 
                          width: `${(exercise.volume / totalVolume) * 100}%`,
                          backgroundColor: chartColors[index % chartColors.length]
                        }
                      ]} 
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="dumbbell" size={40} color={colors.subtext} />
              <Text style={[styles.noDataText, {color: colors.subtext}]}>
                No exercise data available
              </Text>
            </View>
          )}
        </View>
        
        <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Workout Summary
          </Text>
          
          {workout && (
            <View style={styles.summaryContainer}>
              {/* Volume breakdown by training type */}
              <View style={[
                styles.volumeBreakdownContainer, 
                { 
                  backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  borderColor: colors.border,
                  borderWidth: 1
                }
              ]}>
                <View style={[
                  styles.volumeBreakdownHeader,
                  { borderBottomColor: colors.border, borderBottomWidth: 1 }
                ]}>
                  <MaterialCommunityIcons name="weight-lifter" size={24} color={colors.primary} />
                  <Text style={[styles.volumeBreakdownTitle, { color: colors.text }]}>
                    Volume Breakdown
                  </Text>
                </View>
                
                <View style={styles.volumeBreakdownContent}>
                  <View style={styles.volumeTypeRow}>
                    <View style={[styles.volumeTypeIndicator, { backgroundColor: '#6F74DD' }]} />
                    <Text style={[styles.volumeTypeLabel, { color: colors.text }]}>Heavy</Text>
                    <Text style={[styles.volumeTypeValue, { color: '#6F74DD' }]}>
                      {trainingTypeDistribution.heavy.toLocaleString()} kg
                    </Text>
                  </View>
                  
                  <View style={styles.volumeTypeRow}>
                    <View style={[styles.volumeTypeIndicator, { backgroundColor: '#FFB300' }]} />
                    <Text style={[styles.volumeTypeLabel, { color: colors.text }]}>Moderate</Text>
                    <Text style={[styles.volumeTypeValue, { color: '#FFB300' }]}>
                      {trainingTypeDistribution.moderate.toLocaleString()} kg
                    </Text>
                  </View>
                  
                  <View style={styles.volumeTypeRow}>
                    <View style={[styles.volumeTypeIndicator, { backgroundColor: '#4CAF50' }]} />
                    <Text style={[styles.volumeTypeLabel, { color: colors.text }]}>Light</Text>
                    <Text style={[styles.volumeTypeValue, { color: '#4CAF50' }]}>
                      {trainingTypeDistribution.light.toLocaleString()} kg
                    </Text>
                  </View>
                  
                  {trainingTypeDistribution.unspecified > 0 && (
                    <View style={styles.volumeTypeRow}>
                      <View style={[styles.volumeTypeIndicator, { backgroundColor: '#757575' }]} />
                      <Text style={[styles.volumeTypeLabel, { color: colors.text }]}>Unspecified</Text>
                      <Text style={[styles.volumeTypeValue, { color: '#757575' }]}>
                        {trainingTypeDistribution.unspecified.toLocaleString()} kg
                      </Text>
                    </View>
                  )}
                  
                  <View style={[
                    styles.volumeTotalRow,
                    { borderTopColor: colors.border, borderTopWidth: 1 }
                  ]}>
                    <Text style={[styles.volumeTotalLabel, { color: colors.text }]}>Total</Text>
                    <Text style={[styles.volumeTotalValue, { color: colors.primary }]}>
                      {totalVolume.toLocaleString()} kg
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.summaryItem}>
                <Ionicons name="time-outline" size={24} color={colors.primary} />
                <View style={styles.summaryItemText}>
                  <Text style={[styles.summaryItemLabel, { color: colors.subtext }]}>
                    Duration
                  </Text>
                  <Text style={[styles.summaryItemValue, { color: colors.text }]}>
                    {calculateDuration(workout.duration)}
                  </Text>
                </View>
              </View>
              
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="dumbbell" size={24} color={colors.primary} />
                <View style={styles.summaryItemText}>
                  <Text style={[styles.summaryItemLabel, { color: colors.subtext }]}>
                    Total Exercises
                  </Text>
                  <Text style={[styles.summaryItemValue, { color: colors.text }]}>
                    {exercisesWithSets.length}
                  </Text>
                </View>
              </View>
              
              <View style={styles.summaryItem}>
                <MaterialCommunityIcons name="repeat" size={24} color={colors.primary} />
                <View style={styles.summaryItemText}>
                  <Text style={[styles.summaryItemLabel, { color: colors.subtext }]}>
                    Total Sets
                  </Text>
                  <Text style={[styles.summaryItemValue, { color: colors.text }]}>
                    {exercisesWithSets.reduce((sum, ex) => sum + ex.sets.length, 0)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render training tab content
  const renderTrainingTab = () => {
    // Get total volume for percentage calculations
    const totalTrainingVolume = Object.values(trainingTypeDistribution).reduce((sum, val) => sum + val, 0);
    
    // Colors for the training types (matching the history page)
    const trainingTypeColors = {
      heavy: '#6F74DD',
      moderate: '#FFB300',
      light: '#4CAF50',
      unspecified: '#757575'
    };
    
    // Prepare data for pie chart
    const pieChartData = Object.entries(trainingTypeDistribution)
      .filter(([_, volume]) => volume > 0) // Only include types with volume
      .map(([type, volume]) => {
        return {
          name: type.charAt(0).toUpperCase() + type.slice(1),
          volume,
          legendFontColor: colors.text,
          legendFontSize: 12,
          color: trainingTypeColors[type as keyof typeof trainingTypeColors]
        };
      });
    
    // Calculate the number of sets per training type
    const setsPerType = {
      heavy: 0,
      moderate: 0,
      light: 0,
      unspecified: 0
    };
    
    exercisesWithSets.forEach(exercise => {
      exercise.sets.forEach(set => {
        const type = set.training_type || 'unspecified';
        setsPerType[type as keyof typeof setsPerType]++;
      });
    });
    
    // Get total sets
    const totalSets = Object.values(setsPerType).reduce((sum, count) => sum + count, 0);
    
    // Calculate bar widths dynamically
    const getBarWidth = (volumePercentage: number): object => {
      return {
        width: `${volumePercentage}%`
      };
    };
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Training Type Distribution
          </Text>
          
          {totalTrainingVolume > 0 ? (
            <>
              <PieChart
                data={pieChartData}
                width={windowWidth - 40}
                height={220}
                chartConfig={{
                  backgroundColor: colors.card,
                  backgroundGradientFrom: colors.card,
                  backgroundGradientTo: colors.card,
                  color: (opacity = 1) => `rgba(${colorScheme === 'dark' ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(${colorScheme === 'dark' ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`
                }}
                accessor="volume"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute={false}
                avoidFalseZero={true}
              />
              
              <View style={styles.focusContainer}>
                <Text style={[styles.focusLabel, { color: colors.text }]}>
                  Primary Focus:
                </Text>
                <Text style={[
                  styles.focusValue, 
                  { 
                    color: trainingTypeColors[
                      Object.entries(trainingTypeDistribution)
                        .sort((a, b) => b[1] - a[1])[0][0] as keyof typeof trainingTypeColors
                    ]
                  }
                ]}>
                  {Object.entries(trainingTypeDistribution)
                    .sort((a, b) => b[1] - a[1])[0][0].charAt(0).toUpperCase() 
                    + Object.entries(trainingTypeDistribution)
                    .sort((a, b) => b[1] - a[1])[0][0].slice(1)} Training
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="chart-pie" size={40} color={colors.subtext} />
              <Text style={[styles.noDataText, {color: colors.subtext}]}>
                No training type data available
              </Text>
            </View>
          )}
        </View>
        
        <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Training Intensity Breakdown
          </Text>
          
          {totalTrainingVolume > 0 ? (
            <View style={styles.trainingTypeStatsContainer}>
              {Object.entries(trainingTypeDistribution)
                .filter(([_, volume]) => volume > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([type, volume], index) => {
                  const typeKey = type as keyof typeof trainingTypeColors;
                  const percentage = (volume / totalTrainingVolume * 100).toFixed(1);
                  const setCount = setsPerType[typeKey];
                  const setPercentage = totalSets > 0 ? (setCount / totalSets * 100).toFixed(1) : '0';
                  const percentageValue = parseFloat(percentage);
                  
                  return (
                    <View key={type} style={styles.trainingTypeStat}>
                      <View style={styles.trainingTypeHeader}>
                        <View style={[
                          styles.trainingTypeIndicator, 
                          { backgroundColor: trainingTypeColors[typeKey] }
                        ]} />
                        <Text style={[styles.trainingTypeName, { color: colors.text }]}>
                          {type.charAt(0).toUpperCase() + type.slice(1)} Training
                        </Text>
                        <Text style={[styles.trainingTypePercentage, { color: trainingTypeColors[typeKey] }]}>
                          {percentage}%
                        </Text>
                      </View>
                      
                      <View style={styles.trainingTypeBar}>
                        <View 
                          style={[
                            styles.trainingTypeBarFill, 
                            { backgroundColor: trainingTypeColors[typeKey] },
                            getBarWidth(parseFloat(percentage))
                          ]} 
                        />
                      </View>
                      
                      <View style={styles.trainingTypeDetails}>
                        <Text style={[styles.trainingTypeDetail, { color: colors.subtext }]}>
                          {volume.toLocaleString()} kg volume
                        </Text>
                        <Text style={[styles.trainingTypeDetail, { color: colors.subtext }]}>
                          {setCount} sets ({setPercentage}%)
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="weight-lifter" size={40} color={colors.subtext} />
              <Text style={[styles.noDataText, {color: colors.subtext}]}>
                No training intensity data available
              </Text>
              <Text style={[styles.noDataSubtext, {color: colors.subtext}]}>
                Complete workouts with heavy, moderate, or light training types
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Chart colors
  const chartColors = [
    '#FF5733', '#33A8FF', '#33FF57', '#A833FF', '#FF33A8', 
    '#FFD733', '#33FFEC', '#7BFF33', '#FF338A', '#33AAFF'
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen
        options={{
          title: 'Workout Analytics',
          headerLeft: () => (
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={() => router.back()}
            >
              <Ionicons 
                name="arrow-back" 
                size={24} 
                color={colors.text} 
              />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Loading analytics...
            </Text>
          </View>
        ) : (
          <>
            {workout && (
              <View style={styles.workoutHeader}>
                <Text style={[styles.workoutTitle, { color: colors.text }]}>
                  {workout.routine_name}
                </Text>
                <Text style={[styles.workoutDate, { color: colors.subtext }]}>
                  {formatDate(workout.date)}
                </Text>
              </View>
            )}
            
            {renderTabSelector()}
            
            {selectedTab === 'volume' && renderVolumeTab()}
            {selectedTab === 'muscles' && renderMusclesTab()}
            {selectedTab === 'progress' && renderProgressTab()}
            {selectedTab === 'training' && renderTrainingTab()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  headerButton: {
    padding: 8,
  },
  workoutHeader: {
    marginBottom: 16,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  workoutDate: {
    fontSize: 14,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
  chartCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  trendLabel: {
    fontSize: 16,
    marginRight: 8,
  },
  trendValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  volumeStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  volumeStat: {
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
  },
  volumeStatLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  volumeStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  focusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  focusLabel: {
    fontSize: 16,
    marginRight: 8,
  },
  focusValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseProgressContainer: {
    maxHeight: 300,
  },
  exerciseProgressItem: {
    marginBottom: 16,
  },
  exerciseProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseProgressName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  exerciseProgressSets: {
    fontSize: 12,
  },
  exerciseProgressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exerciseProgressStat: {
    alignItems: 'center',
  },
  exerciseProgressStatLabel: {
    fontSize: 12,
  },
  exerciseProgressStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseProgressBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  exerciseProgressBarFill: {
    height: '100%',
  },
  summaryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryItemText: {
    marginLeft: 8,
    flex: 1,
  },
  summaryItemLabel: {
    fontSize: 12,
  },
  summaryItemValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  noDataContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  trainingTypeStatsContainer: {
    flexDirection: 'column',
    width: '100%',
  },
  trainingTypeStat: {
    width: '100%',
    marginBottom: 16,
  },
  trainingTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    justifyContent: 'space-between',
  },
  trainingTypeIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  trainingTypeName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  trainingTypePercentage: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  trainingTypeBar: {
    height: 10,
    backgroundColor: '#eee',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 4,
    width: '100%',
  },
  trainingTypeBarFill: {
    height: '100%',
  },
  trainingTypeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  trainingTypeDetail: {
    fontSize: 12,
  },
  noDataSubtext: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  volumeBreakdownContainer: {
    marginBottom: 16,
    width: '100%',
    borderRadius: 12,
    padding: 16,
  },
  volumeBreakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
  },
  volumeBreakdownTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  volumeBreakdownContent: {
    flexDirection: 'column',
  },
  volumeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 4,
  },
  volumeTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  volumeTypeLabel: {
    fontSize: 14,
    flex: 1,
  },
  volumeTypeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  volumeTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
  },
  volumeTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  volumeTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 