import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, SafeAreaView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import Colors from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { StatusBar } from 'expo-status-bar';
import { formatDate, formatRelativeDate, calculateDuration } from '../utils/dateUtils';
import { getDatabase } from '../utils/database';
import { LineChart, BarChart, PieChart, ContributionGraph } from 'react-native-chart-kit';

// Types
interface WorkoutSummary {
  id: number;
  date: string;
  completed_at: string;
  routine_name: string;
  duration: number;
  volume: number;
  exercise_count: number;
  set_count: number;
}

interface VolumeTrend {
  date: string;
  volume: number;
}

interface MuscleGroupVolume {
  muscle: string;
  volume: number;
}

interface ExerciseTrend {
  name: string;
  data: {
    date: string;
    volume: number;
    maxWeight: number;
  }[];
}

export default function WorkoutAnalyticsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  
  const windowWidth = Dimensions.get('window').width;
  
  // State
  const [loading, setLoading] = useState(true);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [volumeTrends, setVolumeTrends] = useState<VolumeTrend[]>([]);
  const [muscleGroupVolumes, setMuscleGroupVolumes] = useState<MuscleGroupVolume[]>([]);
  const [exerciseTrends, setExerciseTrends] = useState<ExerciseTrend[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'volume' | 'muscles' | 'exercises'>('overview');
  const [totalStats, setTotalStats] = useState({
    workouts: 0,
    volume: 0,
    duration: 0,
    sets: 0,
  });
  
  // Load analytics data
  useEffect(() => {
    let isMounted = true;
    
    const loadAnalyticsData = async () => {
      try {
        setLoading(true);
        const db = await getDatabase();
        
        // Load workout summaries
        await loadWorkoutSummaries(db);
        
        // Load volume trends
        await loadVolumeTrends(db);
        
        // Load muscle group volumes
        await loadMuscleGroupVolumes(db);
        
        // Load exercise trends
        await loadExerciseTrends(db);
        
        if (isMounted) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading analytics data:', error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const loadWorkoutSummaries = async (db: any) => {
      // Get completed workouts
      const workouts = await db.getAllAsync(`
        SELECT w.id, w.date, w.completed_at, w.duration, r.name as routine_name
        FROM workouts w
        LEFT JOIN routines r ON w.routine_id = r.id
        WHERE w.completed_at IS NOT NULL
        ORDER BY w.date DESC
        LIMIT 50
      `);
      
      if (!isMounted) return;
      
      const summaries: WorkoutSummary[] = [];
      let totalVolume = 0;
      let totalDuration = 0;
      let totalSets = 0;
      
      for (const workout of workouts) {
        if (!isMounted) return;
        
        // Get exercise count
        const exerciseResult = await db.getAllAsync(`
          SELECT COUNT(*) as count
          FROM workout_exercises
          WHERE workout_id = ?
        `, [workout.id]);
        
        const exerciseCount = exerciseResult[0].count;
        
        // Get set count and volume
        const workoutExercises = await db.getAllAsync(`
          SELECT id FROM workout_exercises WHERE workout_id = ?
        `, [workout.id]);
        
        let workoutVolume = 0;
        let workoutSets = 0;
        
        for (const we of workoutExercises) {
          if (!isMounted) return;
          
          const sets = await db.getAllAsync(`
            SELECT weight, reps FROM sets WHERE workout_exercise_id = ?
          `, [we.id]);
          
          workoutSets += sets.length;
          
          workoutVolume += sets.reduce((sum: number, set: any) => 
            sum + (set.weight * set.reps), 0);
        }
        
        totalVolume += workoutVolume;
        totalDuration += workout.duration || 0;
        totalSets += workoutSets;
        
        summaries.push({
          id: workout.id,
          date: workout.date,
          completed_at: workout.completed_at,
          routine_name: workout.routine_name || 'Custom Workout',
          duration: workout.duration || 0,
          volume: workoutVolume,
          exercise_count: exerciseCount,
          set_count: workoutSets
        });
      }
      
      if (isMounted) {
        setWorkoutSummaries(summaries);
        setTotalStats({
          workouts: summaries.length,
          volume: totalVolume,
          duration: totalDuration,
          sets: totalSets
        });
      }
    };

    const loadVolumeTrends = async (db: any) => {
      if (!isMounted) return;
      
      try {
        // Get volume data grouped by week
        const volumeData = await db.getAllAsync(`
          SELECT 
            date(w.date, 'weekday 0', '-7 days') as week_start, 
            SUM(s.weight * s.reps) as volume
          FROM workouts w
          JOIN workout_exercises we ON w.id = we.workout_id
          JOIN sets s ON we.id = s.workout_exercise_id
          WHERE w.completed_at IS NOT NULL
          GROUP BY week_start
          ORDER BY week_start ASC
          LIMIT 12
        `);
        
        if (isMounted) {
          const trends: VolumeTrend[] = volumeData.map((data: any) => ({
            date: data.week_start,
            volume: data.volume || 0
          }));
          
          setVolumeTrends(trends);
        }
      } catch (error) {
        console.error('Error loading volume trends:', error);
      }
    };

    const loadMuscleGroupVolumes = async (db: any) => {
      if (!isMounted) return;
      
      try {
        // Get volume by muscle group
        const muscleData = await db.getAllAsync(`
          SELECT 
            e.primary_muscle as muscle, 
            SUM(s.weight * s.reps) as volume
          FROM workouts w
          JOIN workout_exercises we ON w.id = we.workout_id
          JOIN sets s ON we.id = s.workout_exercise_id
          JOIN exercises e ON we.exercise_id = e.id
          WHERE w.completed_at IS NOT NULL
          GROUP BY e.primary_muscle
          ORDER BY volume DESC
        `);
        
        if (isMounted) {
          const muscles: MuscleGroupVolume[] = muscleData.map((data: any) => ({
            muscle: data.muscle,
            volume: data.volume || 0
          }));
          
          setMuscleGroupVolumes(muscles);
        }
      } catch (error) {
        console.error('Error loading muscle group volumes:', error);
      }
    };

    const loadExerciseTrends = async (db: any) => {
      if (!isMounted) return;
      
      try {
        // Get top exercises by volume
        const topExercises = await db.getAllAsync(`
          SELECT 
            e.id,
            e.name,
            SUM(s.weight * s.reps) as volume
          FROM workouts w
          JOIN workout_exercises we ON w.id = we.workout_id
          JOIN sets s ON we.id = s.workout_exercise_id
          JOIN exercises e ON we.exercise_id = e.id
          WHERE w.completed_at IS NOT NULL
          GROUP BY e.id
          ORDER BY volume DESC
          LIMIT 5
        `);
        
        if (!isMounted) return;
        
        const trends: ExerciseTrend[] = [];
        
        for (const exercise of topExercises) {
          if (!isMounted) return;
          
          // Get exercise data over time
          const exerciseData = await db.getAllAsync(`
            SELECT 
              w.date,
              SUM(s.weight * s.reps) as volume,
              MAX(s.weight) as max_weight
            FROM workouts w
            JOIN workout_exercises we ON w.id = we.workout_id
            JOIN sets s ON we.id = s.workout_exercise_id
            WHERE w.completed_at IS NOT NULL AND we.exercise_id = ?
            GROUP BY w.date
            ORDER BY w.date ASC
            LIMIT 10
          `, [exercise.id]);
          
          trends.push({
            name: exercise.name,
            data: exerciseData.map((data: any) => ({
              date: data.date,
              volume: data.volume || 0,
              maxWeight: data.max_weight || 0
            }))
          });
        }
        
        if (isMounted) {
          setExerciseTrends(trends);
        }
      } catch (error) {
        console.error('Error loading exercise trends:', error);
      }
    };

    loadAnalyticsData();
    
    return () => {
      isMounted = false;
    };
  }, []);
  
  // Render tab selector
  const renderTabSelector = () => {
    return (
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            selectedTab === 'overview' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[
            styles.tabButtonText, 
            selectedTab === 'overview' && {color: '#fff'}
          ]}>
            Overview
          </Text>
        </TouchableOpacity>
        
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
            selectedTab === 'volume' && {color: '#fff'}
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
            selectedTab === 'muscles' && {color: '#fff'}
          ]}>
            Muscles
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            selectedTab === 'exercises' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('exercises')}
        >
          <Text style={[
            styles.tabButtonText, 
            selectedTab === 'exercises' && {color: '#fff'}
          ]}>
            Exercises
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Render overview tab content
  const renderOverviewTab = () => {
    const recentWorkouts = workoutSummaries.slice(0, 5);
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Workout Statistics
          </Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="calendar-check" size={28} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {totalStats.workouts}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>
                Total Workouts
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="weight-lifter" size={28} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {totalStats.volume.toLocaleString()} kg
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>
                Total Volume
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={28} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {calculateDuration(totalStats.duration)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>
                Total Duration
              </Text>
            </View>
            
            <View style={styles.statItem}>
              <MaterialCommunityIcons name="repeat" size={28} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.text }]}>
                {totalStats.sets}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>
                Total Sets
              </Text>
            </View>
          </View>
        </View>
        
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Workouts
          </Text>
          
          {recentWorkouts.length > 0 ? (
            <View style={styles.recentWorkoutsList}>
              {recentWorkouts.map((workout, index) => (
                <TouchableOpacity 
                  key={workout.id} 
                  style={styles.recentWorkoutItem}
                  onPress={() => router.push(`/workout/analytics/${workout.id}`)}
                >
                  <View style={styles.recentWorkoutHeader}>
                    <Text style={[styles.recentWorkoutName, { color: colors.text }]}>
                      {workout.routine_name}
                    </Text>
                    <Text style={[styles.recentWorkoutDate, { color: colors.subtext }]}>
                      {formatRelativeDate(workout.date)}
                    </Text>
                  </View>
                  
                  <View style={styles.recentWorkoutStats}>
                    <View style={styles.recentWorkoutStat}>
                      <MaterialCommunityIcons name="weight-lifter" size={16} color={colors.primary} />
                      <Text style={[styles.recentWorkoutStatText, { color: colors.text }]}>
                        {workout.volume.toLocaleString()} kg
                      </Text>
                    </View>
                    
                    <View style={styles.recentWorkoutStat}>
                      <Ionicons name="time-outline" size={16} color={colors.primary} />
                      <Text style={[styles.recentWorkoutStatText, { color: colors.text }]}>
                        {calculateDuration(workout.duration)}
                      </Text>
                    </View>
                    
                    <View style={styles.recentWorkoutStat}>
                      <MaterialCommunityIcons name="dumbbell" size={16} color={colors.primary} />
                      <Text style={[styles.recentWorkoutStatText, { color: colors.text }]}>
                        {workout.exercise_count} exercises
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="dumbbell" size={40} color={colors.subtext} />
              <Text style={[styles.noDataText, {color: colors.subtext}]}>
                No workout data available
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  // Render volume tab content
  const renderVolumeTab = () => {
    // Prepare volume chart data
    const chartColors = [
      '#FF5733', '#33A8FF', '#33FF57', '#A833FF', '#FF33A8', 
      '#FFD733', '#33FFEC', '#7BFF33', '#FF338A', '#33AAFF'
    ];
    
    const volumeData = {
      labels: volumeTrends.slice(-6).map(d => {
        const date = new Date(d.date);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      datasets: [
        {
          data: volumeTrends.slice(-6).map(d => d.volume),
          color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
          strokeWidth: 2
        }
      ],
      legend: ["Weekly Volume"]
    };
    
    // Calculate volume trend (percentage change from first to last)
    let volumeTrend = 0;
    if (volumeTrends.length >= 2) {
      const firstVolume = volumeTrends[0].volume;
      const lastVolume = volumeTrends[volumeTrends.length - 1].volume;
      volumeTrend = ((lastVolume - firstVolume) / firstVolume) * 100;
    }
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Weekly Volume Progression
          </Text>
          
          {volumeTrends.length > 1 ? (
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Volume Summary
          </Text>
          
          <View style={styles.volumeStatsContainer}>
            <View style={styles.volumeStat}>
              <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                Total Volume
              </Text>
              <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                {totalStats.volume.toLocaleString()} kg
              </Text>
            </View>
            
            {volumeTrends.length > 0 && (
              <>
                <View style={styles.volumeStat}>
                  <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                    Average Weekly Volume
                  </Text>
                  <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                    {Math.round(volumeTrends.reduce((sum, item) => sum + item.volume, 0) / volumeTrends.length).toLocaleString()} kg
                  </Text>
                </View>
                
                <View style={styles.volumeStat}>
                  <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                    Maximum Weekly Volume
                  </Text>
                  <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                    {Math.max(...volumeTrends.map(item => item.volume)).toLocaleString()} kg
                  </Text>
                </View>
                
                <View style={styles.volumeStat}>
                  <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                    Average Volume Per Workout
                  </Text>
                  <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                    {workoutSummaries.length > 0 
                      ? Math.round(totalStats.volume / workoutSummaries.length).toLocaleString() 
                      : 0} kg
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
    // Prepare chart colors
    const chartColors = [
      '#FF5733', '#33A8FF', '#33FF57', '#A833FF', '#FF33A8', 
      '#FFD733', '#33FFEC', '#7BFF33', '#FF338A', '#33AAFF'
    ];
    
    // Prepare pie chart data
    const pieChartData = muscleGroupVolumes.slice(0, 10).map((item, index) => ({
      name: item.muscle,
      volume: item.volume,
      legendFontColor: colors.text,
      legendFontSize: 12,
      color: chartColors[index % chartColors.length]
    }));
    
    // Prepare bar chart data
    const barChartData = {
      labels: muscleGroupVolumes.slice(0, 6).map(item => 
        item.muscle.length > 5 ? item.muscle.substring(0, 5) + '...' : item.muscle
      ),
      datasets: [
        {
          data: muscleGroupVolumes.slice(0, 6).map(item => item.volume)
        }
      ]
    };
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Volume by Muscle Group
          </Text>
          
          {muscleGroupVolumes.length > 0 ? (
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
                  {muscleGroupVolumes.length > 0 ? muscleGroupVolumes[0].muscle : 'N/A'}
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Volume Distribution
          </Text>
          
          {muscleGroupVolumes.length > 0 ? (
            <BarChart
              data={barChartData}
              width={windowWidth - 40}
              height={220}
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
              yAxisLabel=""
              yAxisSuffix=" kg"
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

  // Add renderExercisesTab function
  const renderExercisesTab = () => {
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Top Exercises by Volume
          </Text>
          
          {exerciseTrends.length > 0 ? (
            <ScrollView style={styles.exerciseTrendsContainer}>
              {exerciseTrends.map((exercise, index) => {
                // Skip exercises with no data
                if (exercise.data.length === 0) return null;
                
                const volumeData = {
                  labels: exercise.data.slice(-5).map(d => {
                    const date = new Date(d.date);
                    return `${date.getMonth()+1}/${date.getDate()}`;
                  }),
                  datasets: [
                    {
                      data: exercise.data.slice(-5).map(d => d.volume),
                      color: (opacity = 1) => `rgba(134, 65, 244, ${opacity})`,
                      strokeWidth: 2
                    }
                  ],
                  legend: [exercise.name]
                };
                
                // Calculate trend
                let volumeTrend = 0;
                if (exercise.data.length >= 2) {
                  const firstPoint = exercise.data[0];
                  const lastPoint = exercise.data[exercise.data.length - 1];
                  volumeTrend = firstPoint.volume > 0 
                    ? ((lastPoint.volume - firstPoint.volume) / firstPoint.volume) * 100
                    : 0;
                }
                
                return (
                  <View key={index} style={styles.exerciseTrendItem}>
                    <View style={styles.exerciseTrendHeader}>
                      <Text style={[styles.exerciseTrendName, { color: colors.text }]}>
                        {exercise.name}
                      </Text>
                      <View style={styles.exerciseTrendStats}>
                        <Text style={[styles.exerciseTrendStat, { color: colors.subtext }]}>
                          Max Weight: {Math.max(...exercise.data.map(d => d.maxWeight))}{' kg'}
                        </Text>
                        <Text 
                          style={[
                            styles.exerciseTrendChange, 
                            { color: volumeTrend >= 0 ? '#4CAF50' : '#F44336' }
                          ]}
                        >
                          {volumeTrend >= 0 ? '+' : ''}{volumeTrend.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    
                    <LineChart
                      data={volumeData}
                      width={windowWidth - 72}
                      height={120}
                      chartConfig={{
                        backgroundColor: colors.card,
                        backgroundGradientFrom: colors.card,
                        backgroundGradientTo: colors.card,
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(${colorScheme === 'dark' ? '134, 65, 244' : '134, 65, 244'}, ${opacity})`,
                        labelColor: (opacity = 1) => colors.subtext,
                        style: { borderRadius: 16 },
                        propsForDots: {
                          r: "4",
                          strokeWidth: "1",
                          stroke: colors.primary
                        },
                        propsForLabels: {
                          fontSize: 10
                        }
                      }}
                      bezier
                      style={{
                        marginTop: 8,
                        borderRadius: 16
                      }}
                      withInnerLines={false}
                      withOuterLines={false}
                      withVerticalLines={false}
                      withHorizontalLines={true}
                      withVerticalLabels={true}
                      withHorizontalLabels={true}
                      fromZero={true}
                      yAxisLabel=""
                      yAxisSuffix=" kg"
                    />
                  </View>
                );
              })}
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Exercise Distribution
          </Text>
          
          {exerciseTrends.length > 0 ? (
            <View style={styles.exerciseStatsContainer}>
              <Text style={[styles.exerciseStatLabel, { color: colors.subtext }]}>
                Most commonly trained exercises:
              </Text>
              
              <View style={styles.exerciseList}>
                {exerciseTrends.map((exercise, index) => (
                  <View key={index} style={styles.exerciseItem}>
                    <Text style={[styles.exerciseNumber, { backgroundColor: colors.primary, color: '#fff' }]}>
                      {index + 1}
                    </Text>
                    <Text style={[styles.exerciseName, { color: colors.text }]}>
                      {exercise.name}
                    </Text>
                    <Text style={[styles.exerciseVolume, { color: colors.primary }]}>
                      {exercise.data.reduce((sum, d) => sum + d.volume, 0).toLocaleString()} kg
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <MaterialCommunityIcons name="format-list-checks" size={40} color={colors.subtext} />
              <Text style={[styles.noDataText, {color: colors.subtext}]}>
                No exercise data available
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

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
            <View style={styles.pageHeader}>
              <Text style={[styles.pageTitle, { color: colors.text }]}>
                Workout Analytics
              </Text>
              <Text style={[styles.pageSubtitle, { color: colors.subtext }]}>
                Track your fitness progress over time
              </Text>
            </View>
            
            {renderTabSelector()}
            
            {selectedTab === 'overview' && renderOverviewTab()}
            {selectedTab === 'volume' && renderVolumeTab()}
            {selectedTab === 'muscles' && renderMusclesTab()}
            {selectedTab === 'exercises' && renderExercisesTab()}
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
  pageHeader: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  pageSubtitle: {
    fontSize: 16,
    marginTop: 4,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  recentWorkoutsList: {
    marginTop: 8,
  },
  recentWorkoutItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  recentWorkoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recentWorkoutName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  recentWorkoutDate: {
    fontSize: 14,
  },
  recentWorkoutStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  recentWorkoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  recentWorkoutStatText: {
    fontSize: 14,
    marginLeft: 4,
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    marginTop: 8,
    fontSize: 14,
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
    textAlign: 'center',
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
  exerciseTrendsContainer: {
    maxHeight: 400,
  },
  exerciseTrendItem: {
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  exerciseTrendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseTrendName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  exerciseTrendStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseTrendStat: {
    fontSize: 12,
    marginRight: 8,
  },
  exerciseTrendChange: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  exerciseStatsContainer: {
    padding: 8,
  },
  exerciseStatLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  exerciseList: {
    
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
  },
  exerciseName: {
    flex: 1,
    fontSize: 14,
  },
  exerciseVolume: {
    fontSize: 14,
    fontWeight: 'bold',
  },
}); 