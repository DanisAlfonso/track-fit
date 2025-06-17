import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, SafeAreaView } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import Colors from '../../../constants/Colors';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { formatDate, calculateDuration } from '../../../utils/dateUtils';
import { getDatabase } from '../../../utils/database';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

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
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  
  const windowWidth = Dimensions.get('window').width;
  
  // State
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercisesWithSets, setExercisesWithSets] = useState<ExerciseWithSets[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVolume, setTotalVolume] = useState(0);
  const [previousWorkouts, setPreviousWorkouts] = useState<PreviousWorkout[]>([]);
  const [selectedTab, setSelectedTab] = useState<'volume' | 'muscles' | 'progress' | 'training'>('volume');
  const [selectedPieSection, setSelectedPieSection] = useState<number | null>(null);
  const [volumeTimeRange, setVolumeTimeRange] = useState<'7D' | '1M' | '3M' | '6M' | 'All'>('1M');
  const [showAreaChart, setShowAreaChart] = useState(false);
  const [volumeGoal, setVolumeGoal] = useState<number | null>(null);
  const [showMovingAverage, setShowMovingAverage] = useState(false);
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
    const tabs = [
      { key: 'volume', label: 'Volume', icon: 'bar-chart-outline' },
      { key: 'muscles', label: 'Muscles', icon: 'body-outline' },
      { key: 'progress', label: 'Progress', icon: 'trending-up-outline' },
      { key: 'training', label: 'Training', icon: 'fitness-outline' }
    ];

    return (
      <View style={styles.tabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContainer}
          style={styles.tabScrollView}
        >
          {tabs.map((tab, index) => (
            <TouchableOpacity 
              key={tab.key}
              style={[
                styles.tabButton, 
                { borderColor: colors.border },
                selectedTab === tab.key && {
                  backgroundColor: colors.primary, 
                  borderColor: colors.primary
                },
                index === 0 && styles.firstTabButton,
                index === tabs.length - 1 && styles.lastTabButton
              ]} 
              onPress={() => setSelectedTab(tab.key as any)}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={18} 
                color={selectedTab === tab.key ? '#fff' : colors.primary} 
                style={styles.tabIcon}
              />
              <Text style={[
                styles.tabButtonText, 
                { color: colors.text },
                selectedTab === tab.key && {color: '#fff'}
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  // Get filtered volume data based on time range
  const getFilteredVolumeData = () => {
    const now = new Date();
    let filteredData = volumeHistory;
    
    switch (volumeTimeRange) {
      case '7D':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filteredData = volumeHistory.filter(item => new Date(item.date) >= sevenDaysAgo);
        break;
      case '1M':
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        filteredData = volumeHistory.filter(item => new Date(item.date) >= oneMonthAgo);
        break;
      case '3M':
        const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        filteredData = volumeHistory.filter(item => new Date(item.date) >= threeMonthsAgo);
        break;
      case '6M':
        const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        filteredData = volumeHistory.filter(item => new Date(item.date) >= sixMonthsAgo);
        break;
      case 'All':
      default:
        filteredData = volumeHistory;
        break;
    }
    
    return filteredData.slice(-20); // Limit to last 20 workouts for performance
  };
  
  // Calculate moving average
  const calculateMovingAverage = (data: {date: string; volume: number}[], window: number = 3) => {
    return data.map((item, index) => {
      const start = Math.max(0, index - window + 1);
      const subset = data.slice(start, index + 1);
      const average = subset.reduce((sum, d) => sum + d.volume, 0) / subset.length;
      return {
        ...item,
        movingAverage: average
      };
    });
  };

  // Render volume tab content
  const renderVolumeTab = () => {
    const filteredVolumeData = getFilteredVolumeData();
    const volumeDataWithMA = calculateMovingAverage(filteredVolumeData);
    
    // Calculate volume trend (percentage change from first to last)
    let volumeTrend = 0;
    if (filteredVolumeData.length >= 2) {
      const firstVolume = filteredVolumeData[0].volume;
      const lastVolume = filteredVolumeData[filteredVolumeData.length - 1].volume;
      volumeTrend = ((lastVolume - firstVolume) / firstVolume) * 100;
    }
    
    // Calculate goal achievement percentage
    const currentVolume = filteredVolumeData[filteredVolumeData.length - 1]?.volume || 0;
    const goalProgress = volumeGoal ? (currentVolume / volumeGoal) * 100 : 0;
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Workout Volume Progression
          </Text>
          
          {/* Chart Controls */}
          <View style={styles.chartControls}>
            <TouchableOpacity
              style={[
                styles.chartControlButton,
                { 
                  backgroundColor: showAreaChart ? colors.primary : 'transparent',
                  borderColor: colors.primary
                }
              ]}
              onPress={() => setShowAreaChart(!showAreaChart)}
            >
              <Text style={[
                styles.chartControlText,
                { color: showAreaChart ? '#FFFFFF' : colors.primary }
              ]}>
                Area Chart
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.chartControlButton,
                { 
                  backgroundColor: showMovingAverage ? colors.primary : 'transparent',
                  borderColor: colors.primary
                }
              ]}
              onPress={() => setShowMovingAverage(!showMovingAverage)}
            >
              <Text style={[
                styles.chartControlText,
                { color: showMovingAverage ? '#FFFFFF' : colors.primary }
              ]}>
                Moving Avg
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Time Range Selector */}
          <View style={styles.timeRangeSelector}>
            {(['7D', '1M', '3M', '6M', 'All'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangeButton,
                  {
                    backgroundColor: volumeTimeRange === range ? colors.primary : 'transparent',
                    borderColor: colors.primary
                  }
                ]}
                onPress={() => setVolumeTimeRange(range)}
              >
                <Text style={[
                  styles.timeRangeText,
                  { color: volumeTimeRange === range ? '#FFFFFF' : colors.primary }
                ]}>
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {/* Goal Setting */}
          <View style={styles.goalContainer}>
            <Text style={[styles.goalLabel, { color: colors.text }]}>Volume Goal:</Text>
            <View style={styles.goalControls}>
              <TouchableOpacity
                style={[styles.goalButton, { borderColor: colors.primary }]}
                onPress={() => {
                  // Cycle through preset goals or clear
                  const maxVolume = Math.max(...filteredVolumeData.map(d => d.volume));
                  const presetGoals = [
                    Math.round(maxVolume * 1.1), // 10% increase
                    Math.round(maxVolume * 1.25), // 25% increase
                    Math.round(maxVolume * 1.5), // 50% increase
                    null // Clear goal
                  ];
                  
                  const currentIndex = volumeGoal ? presetGoals.findIndex(goal => goal === volumeGoal) : -1;
                  const nextIndex = (currentIndex + 1) % presetGoals.length;
                  setVolumeGoal(presetGoals[nextIndex]);
                }}
              >
                <Text style={[styles.goalButtonText, { color: colors.primary }]}>
                  {volumeGoal ? `${(volumeGoal/1000).toFixed(1)}k kg` : 'Set Goal'}
                </Text>
              </TouchableOpacity>
              
              {volumeGoal && (
                <TouchableOpacity
                  style={[styles.goalClearButton, { borderColor: colors.subtext }]}
                  onPress={() => setVolumeGoal(null)}
                >
                  <Text style={[styles.goalClearText, { color: colors.subtext }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {volumeGoal && (
              <View style={styles.goalProgressContainer}>
                <Text style={[styles.goalProgress, { color: goalProgress >= 100 ? '#4CAF50' : colors.subtext }]}>
                  {goalProgress.toFixed(1)}% achieved
                </Text>
                <Text style={[styles.goalHint, { color: colors.subtext }]}>
                  Tap "Set Goal" to cycle through preset goals
                </Text>
              </View>
            )}
          </View>
          
          {filteredVolumeData.length > 1 ? (
            <>
              <View style={styles.chartContainer}>
                <LineChart
                  data={volumeDataWithMA.map((trend, index) => ({
                    value: trend.volume,
                    label: (() => {
                      const date = new Date(trend.date);
                      return `${date.getMonth()+1}/${date.getDate()}`;
                    })(),
                    labelTextStyle: {
                      color: colors.subtext,
                      fontSize: 10
                    },
                    customDataPoint: () => {
                      const isHighest = trend.volume === Math.max(...filteredVolumeData.map(d => d.volume));
                      return (
                        <View style={[
                          styles.customDataPoint,
                          { backgroundColor: isHighest ? '#FFD700' : colors.primary }
                        ]} />
                      );
                    }
                  }))}
                  data2={showMovingAverage ? volumeDataWithMA.map((trend) => ({
                    value: trend.movingAverage,
                    label: ''
                  })) : undefined}
                  width={windowWidth - 80}
                  height={250}
                  color={colors.primary}
                  color2={showMovingAverage ? '#FF6B6B' : undefined}
                  thickness={3}
                  thickness2={showMovingAverage ? 2 : undefined}
                  dataPointsColor={colors.primary}
                  dataPointsColor2={showMovingAverage ? '#FF6B6B' : undefined}
                  dataPointsRadius={6}
                  dataPointsRadius2={showMovingAverage ? 4 : undefined}
                  dataPointsWidth={2}
                  textShiftY={-8}
                  textShiftX={-10}
                  textColor1={colors.text}
                  textFontSize={12}
                  hideRules={true}
                  hideYAxisText={false}
                  yAxisColor={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
                  xAxisColor={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}
                  yAxisTextStyle={{
                    color: colors.subtext,
                    fontSize: 11,
                    fontWeight: '500'
                  }}
                  xAxisLabelTextStyle={{
                    color: colors.subtext,
                    fontSize: 10,
                    fontWeight: '500'
                  }}
                  curved={true}
                  animationDuration={1200}
                  animateOnDataChange={true}
                  onDataChangeAnimationDuration={800}
                  areaChart={showAreaChart}
                  startFillColor={showAreaChart ? colors.primary : undefined}
                  endFillColor={showAreaChart ? colors.primary + '20' : undefined}
                  startOpacity={showAreaChart ? 0.8 : undefined}
                  endOpacity={showAreaChart ? 0.1 : undefined}
                  focusEnabled={true}
                  showTextOnFocus={true}
                  showStripOnFocus={true}
                  stripColor={colors.primary}
                  stripOpacity={0.3}
                  stripWidth={2}
                  unFocusOnPressOut={true}
                  delayBeforeUnFocus={3000}
                  formatYLabel={(value) => {
                    const numValue = Number(value);
                    if (numValue >= 1000000) {
                      return `${(numValue / 1000000).toFixed(1)}M`;
                    } else if (numValue >= 1000) {
                      return `${(numValue / 1000).toFixed(1)}k`;
                    }
                    return `${numValue}`;
                  }}
                  maxValue={(() => {
                    const dataMax = Math.max(...filteredVolumeData.map(t => t.volume));
                    const goalMax = volumeGoal || 0;
                    const maxVal = Math.max(dataMax, goalMax);
                    if (maxVal <= 100) return 100;
                    if (maxVal <= 500) return Math.ceil(maxVal / 100) * 100;
                    if (maxVal <= 1000) return Math.ceil(maxVal / 250) * 250;
                    if (maxVal <= 5000) return Math.ceil(maxVal / 500) * 500;
                    return Math.ceil(maxVal / 1000) * 1000;
                  })()}
                  noOfSections={5}
                  stepValue={(() => {
                    const dataMax = Math.max(...filteredVolumeData.map(t => t.volume));
                    const goalMax = volumeGoal || 0;
                    const maxVal = Math.max(dataMax, goalMax);
                    if (maxVal <= 100) return 20;
                    if (maxVal <= 500) return Math.ceil(maxVal / 500) * 100;
                    if (maxVal <= 1000) return Math.ceil(maxVal / 1000) * 200;
                    if (maxVal <= 5000) return Math.ceil(maxVal / 2500) * 500;
                    return Math.ceil(maxVal / 5000) * 1000;
                  })()}
                  rulesType="solid"
                  rulesColor={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}
                  showVerticalLines={true}
                  verticalLinesColor={currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}
                  pointerConfig={{
                    pointerStripHeight: 200,
                    pointerStripColor: colors.primary,
                    pointerStripWidth: 2,
                    pointerColor: colors.primary,
                    radius: 8,
                    pointerLabelWidth: 120,
                    pointerLabelHeight: 90,
                    activatePointersOnLongPress: false,
                    autoAdjustPointerLabelPosition: true,
                    pointerLabelComponent: (items: any[]) => {
                      const item = items[0];
                      
                      // Find the workout data by matching the volume value
                      let workout = null;
                      let displayDate = 'Date unavailable';
                      
                      // Try to find the matching data point by volume value
                      if (item.value !== undefined) {
                        workout = volumeDataWithMA.find(data => Math.abs(data.volume - item.value) < 0.01);
                      }
                      
                      // If we found a workout, parse its date (timestamp)
                      if (workout?.date) {
                        try {
                          const workoutDate = new Date(workout.date);
                          if (!isNaN(workoutDate.getTime())) {
                            displayDate = workoutDate.toLocaleDateString();
                          } else {
                            displayDate = String(workout.date);
                          }
                        } catch (error) {
                          displayDate = String(workout.date);
                        }
                      }
                      
                      return (
                        <View style={[
                          styles.pointerLabel,
                          { backgroundColor: colors.card, borderColor: colors.primary }
                        ]}>
                          <Text style={[styles.pointerLabelTitle, { color: colors.text }]}>Workout Volume</Text>
                          <Text style={[styles.pointerLabelValue, { color: colors.primary }]}>
                            {(item.value/1000).toFixed(1)}k kg
                          </Text>
                          <Text style={[styles.pointerLabelDate, { color: colors.subtext }]}>
                            {displayDate}
                          </Text>
                          {showMovingAverage && items[1] && (
                            <Text style={[styles.pointerLabelMA, { color: '#FF6B6B' }]}>
                              Moving Avg: {(items[1].value/1000).toFixed(1)}k kg
                            </Text>
                          )}
                        </View>
                      );
                    }
                  }}
                />
                
                {/* Goal Line Overlay */}
                {volumeGoal && (
                  <View style={[
                    styles.goalLine,
                    {
                      bottom: (() => {
                        const chartHeight = 250;
                        const maxVal = (() => {
                          const dataMax = Math.max(...filteredVolumeData.map(t => t.volume));
                          const goalMax = volumeGoal || 0;
                          const maxVal = Math.max(dataMax, goalMax);
                          if (maxVal <= 100) return 100;
                          if (maxVal <= 500) return Math.ceil(maxVal / 100) * 100;
                          if (maxVal <= 1000) return Math.ceil(maxVal / 250) * 250;
                          if (maxVal <= 5000) return Math.ceil(maxVal / 500) * 500;
                          return Math.ceil(maxVal / 1000) * 1000;
                        })();
                        const percentage = volumeGoal / maxVal;
                        return (chartHeight * percentage) - 30; // Adjust for chart padding
                      })(),
                      backgroundColor: '#4CAF50'
                    }
                  ]}>
                    <Text style={styles.goalLineText}>Goal: {(volumeGoal/1000).toFixed(1)}k kg</Text>
                  </View>
                )}
              </View>
              
              {/* Enhanced Statistics */}
              <View style={styles.enhancedStatsContainer}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Trend</Text>
                    <Text style={[
                      styles.statValue, 
                      { color: volumeTrend >= 0 ? '#4CAF50' : '#F44336' }
                    ]}>
                      {volumeTrend >= 0 ? '+' : ''}{volumeTrend.toFixed(1)}%
                    </Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Best</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {(Math.max(...filteredVolumeData.map(d => d.volume))/1000).toFixed(1)}k
                    </Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Average</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {(filteredVolumeData.reduce((sum, d) => sum + d.volume, 0) / filteredVolumeData.length / 1000).toFixed(1)}k
                    </Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Workouts</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {filteredVolumeData.length}
                    </Text>
                  </View>
                </View>
                
                {showMovingAverage && (
                  <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.legendText, { color: colors.text }]}>Volume</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
                      <Text style={[styles.legendText, { color: colors.text }]}>3-Workout MA</Text>
                    </View>
                  </View>
                )}
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
    // Convert muscle groups to array format
    const muscleGroupArray = Object.entries(muscleGroups).map(([name, volume]) => ({
      muscle: name,
      volume
    })).sort((a, b) => b.volume - a.volume);
    
    const modernColors = [
      '#6366F1', // Indigo
      '#8B5CF6', // Violet  
      '#06B6D4', // Cyan
      '#10B981', // Emerald
      '#F59E0B', // Amber
      '#EF4444', // Red
      '#EC4899', // Pink
      '#84CC16', // Lime
    ];
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            Volume by Muscle Group
          </Text>
          
          {muscleGroupArray.length > 0 ? (
            <>
              <View style={styles.pieChartContainer}>
                <PieChart
                  data={muscleGroupArray.slice(0, 8).map((item, index) => ({
                    value: item.volume,
                    color: modernColors[index % modernColors.length],
                    gradientCenterColor: modernColors[index % modernColors.length] + '40',
                    focused: false,
                    strokeColor: currentTheme === 'dark' ? '#1F2937' : '#F9FAFB',
                    strokeWidth: 3,
                  }))}
                  radius={100}
                  innerRadius={40}
                  backgroundColor={currentTheme === 'dark' ? 'transparent' : 'transparent'}
                  innerCircleColor={currentTheme === 'dark' ? colors.card : colors.card}
                  centerLabelComponent={() => {
                    if (selectedPieSection !== null && selectedPieSection < muscleGroupArray.length) {
                      const selectedMuscle = muscleGroupArray[selectedPieSection];
                      const totalVolume = muscleGroupArray.reduce((sum, mg) => sum + mg.volume, 0);
                      const percentage = ((selectedMuscle.volume / totalVolume) * 100).toFixed(1);
                      return (
                        <View style={styles.pieChartCenter}>
                          <Text style={[
                            styles.pieChartCenterTitle, 
                            { 
                              color: currentTheme === 'dark' ? '#FFFFFF' : colors.text,
                              fontWeight: '600'
                            }
                          ]}>
                            {selectedMuscle.muscle}
                          </Text>
                          <Text style={[
                            styles.pieChartCenterValue, 
                            { 
                              color: colors.primary,
                              textShadowColor: currentTheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'transparent',
                              textShadowOffset: { width: 0, height: 1 },
                              textShadowRadius: 2
                            }
                          ]}>
                            {percentage}%
                          </Text>
                          <Text style={[
                            styles.pieChartCenterUnit, 
                            { 
                              color: currentTheme === 'dark' ? '#D1D5DB' : colors.subtext,
                              fontWeight: '500'
                            }
                          ]}>
                            {(selectedMuscle.volume / 1000).toFixed(1)}k kg
                          </Text>
                        </View>
                      );
                    }
                    return (
                      <View style={styles.pieChartCenter}>
                        <Text style={[
                          styles.pieChartCenterTitle, 
                          { 
                            color: currentTheme === 'dark' ? '#FFFFFF' : colors.text,
                            fontWeight: '600',
                            textShadowColor: currentTheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'transparent',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2
                          }
                        ]}>Total</Text>
                        <Text style={[
                          styles.pieChartCenterValue, 
                          { 
                            color: colors.primary,
                            textShadowColor: currentTheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'transparent',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2
                          }
                        ]}>
                          {(muscleGroupArray.reduce((sum, mg) => sum + mg.volume, 0) / 1000).toFixed(1)}k
                        </Text>
                        <Text style={[
                          styles.pieChartCenterUnit, 
                          { 
                            color: currentTheme === 'dark' ? '#D1D5DB' : colors.subtext,
                            fontWeight: '500',
                            textShadowColor: currentTheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'transparent',
                            textShadowOffset: { width: 0, height: 1 },
                            textShadowRadius: 2
                          }
                        ]}>kg</Text>
                      </View>
                    );
                  }}
                  showText={false}
                  strokeColor={currentTheme === 'dark' ? '#1F2937' : '#F9FAFB'}
                  strokeWidth={3}
                  focusOnPress={true}
                  toggleFocusOnPress={true}
                  sectionAutoFocus={false}
                  isAnimated={true}
                  animationDuration={600}
                  focusedPieIndex={-1}
                  onPress={(item: any, index: number) => {
                    setSelectedPieSection(selectedPieSection === index ? null : index);
                  }}
                  pieInnerComponentHeight={140}
                  pieInnerComponentWidth={140}
                  extraRadius={12}
                  shadow={currentTheme === 'dark' ? false : true}
                  shadowColor={currentTheme === 'dark' ? 'transparent' : '#000000'}
                />
                
                {/* Custom Legend */}
                <View style={styles.pieChartLegend}>
                  {muscleGroupArray.slice(0, 8).map((item, index) => {
                    const totalVolume = muscleGroupArray.reduce((sum, mg) => sum + mg.volume, 0);
                    const percentage = ((item.volume / totalVolume) * 100).toFixed(1);
                    const isSelected = selectedPieSection === index;
                    
                    return (
                      <TouchableOpacity 
                        key={index} 
                        style={[
                          styles.legendItem,
                          isSelected && {
                            backgroundColor: currentTheme === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
                            borderRadius: 8,
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            marginVertical: 2,
                            borderWidth: 1,
                            borderColor: currentTheme === 'dark' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'
                          }
                        ]}
                        onPress={() => {
                          setSelectedPieSection(selectedPieSection === index ? null : index);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[
                          styles.legendDot, 
                          { backgroundColor: modernColors[index % modernColors.length] }
                        ]} />
                        <Text style={[
                          styles.legendText, 
                          { color: colors.text, flex: 1 }
                        ]}>
                          {item.muscle}
                        </Text>
                        <Text style={[
                          styles.legendPercentage, 
                          { color: colors.subtext }
                        ]}>
                          {percentage}%
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              
              <View style={styles.focusContainer}>
                <Text style={[styles.focusLabel, { color: colors.text }]}>
                  Primary Focus:
                </Text>
                <Text style={[styles.focusValue, { color: colors.primary }]}>
                  {muscleGroupArray[0]?.muscle || 'N/A'}
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
            <View style={styles.muscleDistributionContainer}>
              {/* Improved custom muscle group bars */}
              <View style={styles.enhancedBarsContainer}>
                {Object.entries(muscleGroups)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([muscleName, volume], index, sortedArray) => {
                    // Calculate percentage of this muscle group's volume compared to highest volume muscle group
                    const highestVolume = sortedArray[0][1];
                    const percentage = Math.round((volume / highestVolume) * 100);
                    const barColor = chartColors[index % chartColors.length];
                    
                    return (
                      <View key={index} style={styles.enhancedBarRow}>
                        <View style={[styles.muscleDot, { backgroundColor: barColor }]} />
                        <View style={styles.muscleNameContainer}>
                          <Text style={[styles.muscleBarLabel, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                            {muscleName}
                          </Text>
                        </View>
                        <View style={[styles.muscleBarWrapper, { backgroundColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)' }]}>
                          <View 
                            style={[
                              styles.muscleBar, 
                              { 
                                backgroundColor: barColor,
                                width: `${percentage}%` 
                              }
                            ]} 
                          />
                          {/* Add percentage label inside bar for better visualization */}
                          {percentage > 5 && (
                            <Text style={styles.muscleBarPercentage}>
                              {percentage}%
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.muscleBarValue, { color: colors.text }]}>
                          {volume.toLocaleString()} kg
                        </Text>
                      </View>
                    );
                  })}
              </View>
              
              {/* Muscle balance insights */}
              <View style={[styles.muscleBalanceCard, { backgroundColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)' }]}>
                <Text style={[styles.muscleBalanceTitle, { color: colors.text }]}>
                  Muscle Balance Insights
                </Text>
                
                <View style={styles.muscleBalanceInfo}>
                  <View style={styles.muscleBalanceStat}>
                    <View style={styles.muscleBalanceHeader}>
                      <MaterialCommunityIcons 
                        name="trending-up" 
                        size={16} 
                        color={colors.primary} 
                        style={styles.muscleBalanceIcon} 
                      />
                      <Text style={[styles.muscleBalanceLabel, { color: colors.subtext }]}>
                        Primary:
                      </Text>
                    </View>
                    {Object.entries(muscleGroups).length > 0 && (
                      <>
                        <Text style={[styles.muscleBalanceValue, { color: colors.text }]}>
                          {Object.entries(muscleGroups).sort((a, b) => b[1] - a[1])[0][0]}
                        </Text>
                        <Text style={[styles.muscleBalanceSubtext, { color: colors.subtext }]}>
                          {Math.round((Object.entries(muscleGroups).sort((a, b) => b[1] - a[1])[0][1] / totalVolume) * 100)}% of total volume
                        </Text>
                      </>
                    )}
                  </View>
                  
                  <View style={styles.muscleBalanceDivider} />
                  
                  <View style={styles.muscleBalanceStat}>
                    <View style={styles.muscleBalanceHeader}>
                      <MaterialCommunityIcons 
                        name="trending-down" 
                        size={16} 
                        color="#FF5733" 
                        style={styles.muscleBalanceIcon} 
                      />
                      <Text style={[styles.muscleBalanceLabel, { color: colors.subtext }]}>
                        Secondary:
                      </Text>
                    </View>
                    {Object.entries(muscleGroups).length > 1 && (
                      <>
                        <Text style={[styles.muscleBalanceValue, { color: colors.text }]}>
                          {Object.entries(muscleGroups).sort((a, b) => b[1] - a[1])[1][0]}
                        </Text>
                        <Text style={[styles.muscleBalanceSubtext, { color: colors.subtext }]}>
                          {Math.round((Object.entries(muscleGroups).sort((a, b) => b[1] - a[1])[1][1] / totalVolume) * 100)}% of total volume
                        </Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </View>
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
            <ScrollView style={[styles.exerciseProgressContainer, { maxHeight: Math.min(exerciseProgress.length * 80 + 40, 500) }]}>
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
                  backgroundColor: currentTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
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
                data={Object.entries(trainingTypeDistribution)
                  .filter(([_, volume]) => volume > 0)
                  .map(([type, volume]) => {
                    const trainingTypeColors = {
                      heavy: '#6F74DD',
                      moderate: '#FFB300',
                      light: '#4CAF50',
                      unspecified: '#757575'
                    };
                    return {
                      value: volume,
                      color: trainingTypeColors[type as keyof typeof trainingTypeColors],
                      gradientCenterColor: trainingTypeColors[type as keyof typeof trainingTypeColors] + '40',
                      focused: false,
                      strokeColor: currentTheme === 'dark' ? '#1F2937' : '#F9FAFB',
                      strokeWidth: 3,
                    };
                  })}
                radius={100}
                innerRadius={40}
                backgroundColor={currentTheme === 'dark' ? 'transparent' : 'transparent'}
                innerCircleColor={currentTheme === 'dark' ? colors.card : colors.card}
                centerLabelComponent={() => {
                  const totalTrainingVolume = Object.values(trainingTypeDistribution).reduce((sum, val) => sum + val, 0);
                  return (
                    <View style={styles.pieChartCenter}>
                      <Text style={[
                        styles.pieChartCenterTitle, 
                        { 
                          color: currentTheme === 'dark' ? '#FFFFFF' : colors.text,
                          fontWeight: '600'
                        }
                      ]}>Training</Text>
                      <Text style={[
                        styles.pieChartCenterValue, 
                        { 
                          color: colors.primary,
                          textShadowColor: currentTheme === 'dark' ? 'rgba(0,0,0,0.8)' : 'transparent',
                          textShadowOffset: { width: 0, height: 1 },
                          textShadowRadius: 2
                        }
                      ]}>
                        {(totalTrainingVolume / 1000).toFixed(1)}k
                      </Text>
                      <Text style={[
                        styles.pieChartCenterUnit, 
                        { 
                          color: currentTheme === 'dark' ? '#D1D5DB' : colors.subtext,
                          fontWeight: '500'
                        }
                      ]}>kg</Text>
                    </View>
                  );
                }}
                showText={false}
                strokeColor={currentTheme === 'dark' ? '#1F2937' : '#F9FAFB'}
                strokeWidth={3}
                focusOnPress={true}
                toggleFocusOnPress={true}
                sectionAutoFocus={false}
                isAnimated={true}
                animationDuration={600}
                focusedPieIndex={-1}
                pieInnerComponentHeight={140}
                pieInnerComponentWidth={140}
                extraRadius={12}
                shadow={currentTheme === 'dark' ? false : true}
                shadowColor={currentTheme === 'dark' ? 'transparent' : '#000000'}
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
      <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen
        options={{
          title: 'Workout Analysis',
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
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
    paddingBottom: 100,
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
    marginBottom: 16,
  },
  tabScrollView: {
    flexGrow: 0,
  },
  tabScrollContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabButton: {
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  firstTabButton: {
    marginLeft: 0,
  },
  lastTabButton: {
    marginRight: 0,
  },
  tabIcon: {
    marginRight: 6,
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
    // Dynamic maxHeight calculated inline based on number of exercises
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
  muscleDistributionContainer: {
    flexDirection: 'column',
    padding: 8,
  },
  enhancedBarsContainer: {
    flexDirection: 'column',
    marginBottom: 16,
  },
  enhancedBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  muscleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  muscleNameContainer: {
    width: 80,
    marginRight: 8,
  },
  muscleBarLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  muscleBarWrapper: {
    flex: 1,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  muscleBar: {
    height: 24,
    borderRadius: 12,
    position: 'absolute',
    left: 0,
  },
  muscleBarPercentage: {
    position: 'absolute',
    right: 8,
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  muscleBarValue: {
    fontSize: 14,
    fontWeight: '500',
    width: 80,
    textAlign: 'right',
  },
  muscleBalanceCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
  },
  muscleBalanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  muscleBalanceInfo: {
    flexDirection: 'row',
  },
  muscleBalanceStat: {
    flex: 1,
  },
  muscleBalanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  muscleBalanceIcon: {
    marginRight: 6,
  },
  muscleBalanceLabel: {
    fontSize: 14,
  },
  muscleBalanceValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  muscleBalanceSubtext: {
    fontSize: 12,
  },
  muscleBalanceDivider: {
    width: 1,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
    marginHorizontal: 12,
  },
  pieChartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  pieChartCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pieChartCenterTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  pieChartCenterValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
    textAlign: 'center',
  },
  pieChartCenterUnit: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  pieChartLegend: {
    marginTop: 20,
    paddingHorizontal: 16,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  legendText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  legendPercentage: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  
  // Enhanced Chart Styles
  chartControls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  chartControlButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chartControlText: {
    fontSize: 12,
    fontWeight: '500',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  timeRangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalContainer: {
    marginBottom: 16,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  goalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  goalButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  goalButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalClearButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  goalClearText: {
    fontSize: 11,
    fontWeight: '500',
  },
  goalProgressContainer: {
    gap: 4,
  },
  goalProgress: {
    fontSize: 12,
    fontWeight: '500',
  },
  goalHint: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  chartContainer: {
    position: 'relative',
  },
  customDataPoint: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  goalLine: {
    position: 'absolute',
    left: 40,
    right: 0,
    height: 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  goalLineText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pointerLabel: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pointerLabelTitle: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  pointerLabelValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  pointerLabelDate: {
    fontSize: 10,
    marginBottom: 2,
  },
  pointerLabelMA: {
    fontSize: 10,
    fontWeight: '500',
  },
  enhancedStatsContainer: {
    marginTop: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
});