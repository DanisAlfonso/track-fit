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
import { useTheme } from '@/context/ThemeContext';

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

interface TrainingTypeDistribution {
  heavy: number;
  moderate: number;
  light: number;
  unspecified: number;
}

export default function WorkoutAnalyticsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  
  const windowWidth = Dimensions.get('window').width;
  
  // State
  const [loading, setLoading] = useState(true);
  const [workoutSummaries, setWorkoutSummaries] = useState<WorkoutSummary[]>([]);
  const [volumeTrends, setVolumeTrends] = useState<VolumeTrend[]>([]);
  const [muscleGroupVolumes, setMuscleGroupVolumes] = useState<MuscleGroupVolume[]>([]);
  const [exerciseTrends, setExerciseTrends] = useState<ExerciseTrend[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'volume' | 'muscles' | 'exercises'>('overview');
  const [trainingTypeVolumes, setTrainingTypeVolumes] = useState<TrainingTypeDistribution>({
    heavy: 0,
    moderate: 0,
    light: 0,
    unspecified: 0
  });
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
        
        // Load training type distribution
        await loadTrainingTypeDistribution(db);
        
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

    const loadTrainingTypeDistribution = async (db: any) => {
      if (!isMounted) return;
      
      try {
        // Get volume for heavy training type
        const heavyVolume = await db.getAllAsync(`
          SELECT SUM(s.weight * s.reps) as volume
          FROM workouts w
          JOIN workout_exercises we ON w.id = we.workout_id
          JOIN sets s ON we.id = s.workout_exercise_id
          WHERE w.completed_at IS NOT NULL AND s.training_type = 'heavy'
        `);
        
        // Get volume for moderate training type
        const moderateVolume = await db.getAllAsync(`
          SELECT SUM(s.weight * s.reps) as volume
          FROM workouts w
          JOIN workout_exercises we ON w.id = we.workout_id
          JOIN sets s ON we.id = s.workout_exercise_id
          WHERE w.completed_at IS NOT NULL AND s.training_type = 'moderate'
        `);
        
        // Get volume for light training type
        const lightVolume = await db.getAllAsync(`
          SELECT SUM(s.weight * s.reps) as volume
          FROM workouts w
          JOIN workout_exercises we ON w.id = we.workout_id
          JOIN sets s ON we.id = s.workout_exercise_id
          WHERE w.completed_at IS NOT NULL AND s.training_type = 'light'
        `);
        
        // Get volume for unspecified training type
        const unspecifiedVolume = await db.getAllAsync(`
          SELECT SUM(s.weight * s.reps) as volume
          FROM workouts w
          JOIN workout_exercises we ON w.id = we.workout_id
          JOIN sets s ON we.id = s.workout_exercise_id
          WHERE w.completed_at IS NOT NULL AND (s.training_type IS NULL OR s.training_type = '')
        `);
        
        if (isMounted) {
          setTrainingTypeVolumes({
            heavy: heavyVolume[0]?.volume || 0,
            moderate: moderateVolume[0]?.volume || 0,
            light: lightVolume[0]?.volume || 0,
            unspecified: unspecifiedVolume[0]?.volume || 0
          });
        }
      } catch (error) {
        console.error('Error loading training type distribution:', error);
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
            { borderColor: colors.border },
            selectedTab === 'overview' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[
            styles.tabButtonText, 
            { color: colors.text },
            selectedTab === 'overview' && {color: '#fff'}
          ]}>
            Overview
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            { borderColor: colors.border },
            selectedTab === 'volume' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('volume')}
        >
          <Text style={[
            styles.tabButtonText, 
            { color: colors.text },
            selectedTab === 'volume' && {color: '#fff'}
          ]}>
            Volume
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            { borderColor: colors.border },
            selectedTab === 'muscles' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('muscles')}
        >
          <Text style={[
            styles.tabButtonText, 
            { color: colors.text },
            selectedTab === 'muscles' && {color: '#fff'}
          ]}>
            Muscles
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.tabButton, 
            { borderColor: colors.border },
            selectedTab === 'exercises' && {
              backgroundColor: colors.primary, 
              borderColor: colors.primary
            }
          ]} 
          onPress={() => setSelectedTab('exercises')}
        >
          <Text style={[
            styles.tabButtonText, 
            { color: colors.text },
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
            <View style={[styles.statCard, { backgroundColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)' }]}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="calendar-check" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {totalStats.workouts}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>
                Total Workouts
              </Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)' }]}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="weight-lifter" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {totalStats.volume.toLocaleString()} kg
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>
                Total Volume
              </Text>
              
              {/* Training Type Breakdown */}
              {trainingTypeVolumes.heavy + trainingTypeVolumes.moderate + trainingTypeVolumes.light + trainingTypeVolumes.unspecified > 0 && (
                <View style={styles.volumeBreakdown}>
                  {trainingTypeVolumes.heavy > 0 && (
                    <View style={styles.volumeBreakdownRow}>
                      <View style={[styles.intensityDot, { backgroundColor: '#6F74DD' }]} />
                      <Text style={[styles.intensityLabel, { color: colors.subtext }]}>Heavy:</Text>
                      <Text style={[styles.intensityValue, { color: colors.text }]}>
                        {trainingTypeVolumes.heavy.toLocaleString()} kg
                      </Text>
                    </View>
                  )}
                  
                  {trainingTypeVolumes.moderate > 0 && (
                    <View style={styles.volumeBreakdownRow}>
                      <View style={[styles.intensityDot, { backgroundColor: '#FFB300' }]} />
                      <Text style={[styles.intensityLabel, { color: colors.subtext }]}>Moderate:</Text>
                      <Text style={[styles.intensityValue, { color: colors.text }]}>
                        {trainingTypeVolumes.moderate.toLocaleString()} kg
                      </Text>
                    </View>
                  )}
                  
                  {trainingTypeVolumes.light > 0 && (
                    <View style={styles.volumeBreakdownRow}>
                      <View style={[styles.intensityDot, { backgroundColor: '#4CAF50' }]} />
                      <Text style={[styles.intensityLabel, { color: colors.subtext }]}>Light:</Text>
                      <Text style={[styles.intensityValue, { color: colors.text }]}>
                        {trainingTypeVolumes.light.toLocaleString()} kg
                      </Text>
                    </View>
                  )}
                  
                  {trainingTypeVolumes.unspecified > 0 && (
                    <View style={styles.volumeBreakdownRow}>
                      <View style={[styles.intensityDot, { backgroundColor: '#757575' }]} />
                      <Text style={[styles.intensityLabel, { color: colors.subtext }]}>Other:</Text>
                      <Text style={[styles.intensityValue, { color: colors.text }]}>
                        {trainingTypeVolumes.unspecified.toLocaleString()} kg
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            
            <View style={[styles.statCard, { backgroundColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)' }]}>
              <View style={styles.statIconContainer}>
                <Ionicons name="time-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {calculateDuration(totalStats.duration)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>
                Total Duration
              </Text>
            </View>
            
            <View style={[styles.statCard, { backgroundColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)' }]}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="repeat" size={24} color={colors.primary} />
              </View>
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
    
    // Prepare stacked data for training types
    const allVolumeDates = [...new Set(volumeTrends.slice(-6).map(d => d.date))];
    
    // Calculate volume trend (percentage change from first to last)
    let volumeTrend = 0;
    if (volumeTrends.length >= 2) {
      const firstVolume = volumeTrends[0].volume;
      const lastVolume = volumeTrends[volumeTrends.length - 1].volume;
      volumeTrend = ((lastVolume - firstVolume) / firstVolume) * 100;
    }
    
    // Get total volume
    const totalVolume = trainingTypeVolumes.heavy + 
                        trainingTypeVolumes.moderate + 
                        trainingTypeVolumes.light + 
                        trainingTypeVolumes.unspecified;
    
    // Calculate percentages
    const heavyPercentage = totalVolume > 0 ? Math.round((trainingTypeVolumes.heavy / totalVolume) * 100) : 0;
    const moderatePercentage = totalVolume > 0 ? Math.round((trainingTypeVolumes.moderate / totalVolume) * 100) : 0;
    const lightPercentage = totalVolume > 0 ? Math.round((trainingTypeVolumes.light / totalVolume) * 100) : 0;
    const unspecifiedPercentage = totalVolume > 0 ? Math.round((trainingTypeVolumes.unspecified / totalVolume) * 100) : 0;
    
    // Calculate background colors based on color scheme
    const lightBackgroundColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)';
    const mediumBackgroundColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const borderColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    // Prepare volume data for line chart
    const volumeData = {
      labels: volumeTrends.slice(-6).map(d => {
        const date = new Date(d.date);
        return `${date.getMonth()+1}/${date.getDate()}`;
      }),
      datasets: [
        {
          data: volumeTrends.slice(-6).map(d => d.volume),
          color: (opacity = 1) => `rgba(${currentTheme === 'dark' ? '134, 65, 244' : '134, 65, 244'}, ${opacity})`,
          strokeWidth: 2
        }
      ],
      legend: ["Weekly Volume"]
    };
    
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
                  color: (opacity = 1) => `rgba(${currentTheme === 'dark' ? '134, 65, 244' : '134, 65, 244'}, ${opacity})`,
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
            <View style={styles.volumeSummaryHeader}>
              <View style={styles.volumeStat}>
                <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                  Total Volume
                </Text>
                <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                  {totalStats.volume.toLocaleString()} kg
                </Text>
              </View>
              
              <View style={styles.volumeStat}>
                {volumeTrends.length > 0 && (
                  <>
                    <Text style={[styles.volumeStatLabel, { color: colors.subtext }]}>
                      Average Weekly
                    </Text>
                    <Text style={[styles.volumeStatValue, { color: colors.text }]}>
                      {Math.round(volumeTrends.reduce((sum, item) => sum + item.volume, 0) / volumeTrends.length).toLocaleString()} kg
                    </Text>
                  </>
                )}
              </View>
            </View>
            
            {/* Training Type Distribution */}
            {totalVolume > 0 && (
              <View style={[styles.intensityDistributionCard, { backgroundColor: lightBackgroundColor }]}>
                <Text style={[styles.intensitySectionTitle, { color: colors.text }]}>
                  Training Intensity Distribution
                </Text>
                
                <View style={styles.intensityLayout}>
                  {/* Distribution Bars */}
                  <View style={styles.intensityBarsContainer}>
                    {trainingTypeVolumes.heavy > 0 && (
                      <View style={styles.intensityBarRow}>
                        <View style={[styles.intensityDot, { backgroundColor: '#6F74DD' }]} />
                        <Text style={[styles.intensityBarLabel, { color: colors.text }]}>Heavy</Text>
                        <View style={[styles.intensityBarWrapper, { backgroundColor: mediumBackgroundColor }]}>
                          <View 
                            style={[
                              styles.intensityBar, 
                              { 
                                backgroundColor: '#6F74DD',
                                width: `${heavyPercentage}%` 
                              }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.intensityBarPercent, { color: colors.text }]}>
                          {heavyPercentage}%
                        </Text>
                      </View>
                    )}
                    
                    {trainingTypeVolumes.moderate > 0 && (
                      <View style={styles.intensityBarRow}>
                        <View style={[styles.intensityDot, { backgroundColor: '#FFB300' }]} />
                        <Text style={[styles.intensityBarLabel, { color: colors.text }]}>Moderate</Text>
                        <View style={[styles.intensityBarWrapper, { backgroundColor: mediumBackgroundColor }]}>
                          <View 
                            style={[
                              styles.intensityBar, 
                              { 
                                backgroundColor: '#FFB300',
                                width: `${moderatePercentage}%` 
                              }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.intensityBarPercent, { color: colors.text }]}>
                          {moderatePercentage}%
                        </Text>
                      </View>
                    )}
                    
                    {trainingTypeVolumes.light > 0 && (
                      <View style={styles.intensityBarRow}>
                        <View style={[styles.intensityDot, { backgroundColor: '#4CAF50' }]} />
                        <Text style={[styles.intensityBarLabel, { color: colors.text }]}>Light</Text>
                        <View style={[styles.intensityBarWrapper, { backgroundColor: mediumBackgroundColor }]}>
                          <View 
                            style={[
                              styles.intensityBar, 
                              { 
                                backgroundColor: '#4CAF50',
                                width: `${lightPercentage}%` 
                              }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.intensityBarPercent, { color: colors.text }]}>
                          {lightPercentage}%
                        </Text>
                      </View>
                    )}
                    
                    {trainingTypeVolumes.unspecified > 0 && (
                      <View style={styles.intensityBarRow}>
                        <View style={[styles.intensityDot, { backgroundColor: '#757575' }]} />
                        <Text style={[styles.intensityBarLabel, { color: colors.text }]}>Other</Text>
                        <View style={[styles.intensityBarWrapper, { backgroundColor: mediumBackgroundColor }]}>
                          <View 
                            style={[
                              styles.intensityBar, 
                              { 
                                backgroundColor: '#757575',
                                width: `${unspecifiedPercentage}%` 
                              }
                            ]} 
                          />
                        </View>
                        <Text style={[styles.intensityBarPercent, { color: colors.text }]}>
                          {unspecifiedPercentage}%
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Distribution Values */}
                  <View style={[styles.intensityValuesContainer, { borderTopColor: borderColor }]}>
                    {trainingTypeVolumes.heavy > 0 && (
                      <View style={styles.intensityValueRow}>
                        <Text style={[styles.intensityValueLabel, { color: colors.subtext }]}>Heavy Volume:</Text>
                        <Text style={[styles.intensityValueText, { color: colors.text }]}>
                          {trainingTypeVolumes.heavy.toLocaleString()} kg
                        </Text>
                      </View>
                    )}
                    
                    {trainingTypeVolumes.moderate > 0 && (
                      <View style={styles.intensityValueRow}>
                        <Text style={[styles.intensityValueLabel, { color: colors.subtext }]}>Moderate Volume:</Text>
                        <Text style={[styles.intensityValueText, { color: colors.text }]}>
                          {trainingTypeVolumes.moderate.toLocaleString()} kg
                        </Text>
                      </View>
                    )}
                    
                    {trainingTypeVolumes.light > 0 && (
                      <View style={styles.intensityValueRow}>
                        <Text style={[styles.intensityValueLabel, { color: colors.subtext }]}>Light Volume:</Text>
                        <Text style={[styles.intensityValueText, { color: colors.text }]}>
                          {trainingTypeVolumes.light.toLocaleString()} kg
                        </Text>
                      </View>
                    )}
                    
                    {trainingTypeVolumes.unspecified > 0 && (
                      <View style={styles.intensityValueRow}>
                        <Text style={[styles.intensityValueLabel, { color: colors.subtext }]}>Other Volume:</Text>
                        <Text style={[styles.intensityValueText, { color: colors.text }]}>
                          {trainingTypeVolumes.unspecified.toLocaleString()} kg
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
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
      '#6F74DD', // Heavy blue
      '#FFB300', // Moderate amber
      '#4CAF50', // Light green
      '#FF5733', // Red-orange
      '#33A8FF', // Sky blue
      '#A833FF', // Purple
      '#FF33A8', // Pink
      '#FFD733', // Yellow
      '#33FFEC', // Teal
      '#7BFF33'  // Lime
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

    // Calculate background colors based on color scheme
    const lightBackgroundColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)';
    
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
                  color: (opacity = 1) => `rgba(${currentTheme === 'dark' ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(${currentTheme === 'dark' ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`
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
                  {muscleGroupVolumes[0]?.muscle || 'N/A'}
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
            <View style={styles.muscleDistributionContainer}>
              {/* Improved muscle group bars */}
              <View style={styles.enhancedBarsContainer}>
                {muscleGroupVolumes.slice(0, 6).map((muscle, index) => {
                  // Calculate percentage of this muscle group's volume compared to the highest
                  const maxVolume = Math.max(...muscleGroupVolumes.map(m => m.volume));
                  const percentage = Math.round((muscle.volume / maxVolume) * 100);
                  const barColor = chartColors[index % chartColors.length];
                  
                  return (
                    <View key={index} style={styles.enhancedBarRow}>
                      <View style={[styles.muscleDot, { backgroundColor: barColor }]} />
                      <View style={styles.muscleNameContainer}>
                        <Text style={[styles.muscleBarLabel, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                          {muscle.muscle}
                        </Text>
                      </View>
                      <View style={[styles.muscleBarWrapper, { backgroundColor: lightBackgroundColor }]}>
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
                        {percentage > 15 && (
                          <Text style={styles.muscleBarPercentage}>
                            {percentage}%
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.muscleBarValue, { color: colors.text }]}>
                        {muscle.volume.toLocaleString()} kg
                      </Text>
                    </View>
                  );
                })}
              </View>
              
              {/* Muscle groups balance indicators */}
              <View style={[styles.muscleBalanceCard, { backgroundColor: lightBackgroundColor }]}>
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
                        Strongest:
                      </Text>
                    </View>
                    <Text style={[styles.muscleBalanceValue, { color: colors.text }]}>
                      {muscleGroupVolumes[0]?.muscle || 'N/A'}
                    </Text>
                    {muscleGroupVolumes[0]?.volume > 0 && (
                      <Text style={[styles.muscleBalanceSubtext, { color: colors.subtext }]}>
                        {((muscleGroupVolumes[0]?.volume / totalStats.volume) * 100).toFixed(1)}% of total volume
                      </Text>
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
                        Needs Focus:
                      </Text>
                    </View>
                    <Text style={[styles.muscleBalanceValue, { color: colors.text }]}>
                      {muscleGroupVolumes.length > 3 ? muscleGroupVolumes[muscleGroupVolumes.length-1]?.muscle || 'N/A' : 'N/A'}
                    </Text>
                    {muscleGroupVolumes.length > 3 && muscleGroupVolumes[muscleGroupVolumes.length-1]?.volume > 0 && (
                      <Text style={[styles.muscleBalanceSubtext, { color: colors.subtext }]}>
                        Only {((muscleGroupVolumes[muscleGroupVolumes.length-1]?.volume / totalStats.volume) * 100).toFixed(1)}% of total volume
                      </Text>
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

  // Add renderExercisesTab function
  const renderExercisesTab = () => {
    // Calculate background colors based on color scheme
    const cardBackgroundColor = colors.card;
    const lightBackgroundColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)';
    const mediumBackgroundColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const borderColor = currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    // Define exercise type colors (matching our training intensity colors)
    const exerciseColors = {
      compound: '#6F74DD',   // Heavy blue - for compound movements
      isolation: '#FFB300',  // Moderate orange - for isolation exercises
      bodyweight: '#4CAF50', // Light green - for bodyweight exercises
      other: '#757575'       // Gray - for other exercises
    };
    
    return (
      <View style={styles.tabContent}>
        <View style={[styles.chartCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Top Exercises by Volume
          </Text>
          
          {exerciseTrends.length > 0 ? (
            <View style={styles.exerciseTrendsContainer}>
              {exerciseTrends.map((exercise, index) => {
                // Skip exercises with no data
                if (exercise.data.length === 0) return null;
                
                // Determine exercise type (simplified categorization)
                const exerciseType = 
                  exercise.name.toLowerCase().includes('bench') || 
                  exercise.name.toLowerCase().includes('squat') || 
                  exercise.name.toLowerCase().includes('deadlift') ||
                  exercise.name.toLowerCase().includes('row') ||
                  exercise.name.toLowerCase().includes('press') ? 'compound' : 
                  exercise.name.toLowerCase().includes('curl') ||
                  exercise.name.toLowerCase().includes('extension') ||
                  exercise.name.toLowerCase().includes('fly') ||
                  exercise.name.toLowerCase().includes('raise') ? 'isolation' : 
                  exercise.name.toLowerCase().includes('push') ||
                  exercise.name.toLowerCase().includes('pull') ||
                  exercise.name.toLowerCase().includes('dip') ||
                  exercise.name.toLowerCase().includes('up') ? 'bodyweight' : 'other';
                
                const exerciseColor = exerciseColors[exerciseType] || exerciseColors.other;
                
                // Calculate trend
                let volumeTrend = 0;
                if (exercise.data.length >= 2) {
                  const firstPoint = exercise.data[0];
                  const lastPoint = exercise.data[exercise.data.length - 1];
                  volumeTrend = firstPoint.volume > 0 
                    ? ((lastPoint.volume - firstPoint.volume) / firstPoint.volume) * 100
                    : 0;
                }
                
                // Format the RGB values for chart colors - with null check
                let colorRgbValues = '134, 65, 244'; // Default purple if extraction fails
                try {
                  if (exerciseColor) {
                    const colorMatch = exerciseColor.replace('#', '').match(/.{2}/g);
                    if (colorMatch) {
                      colorRgbValues = colorMatch.map(hex => parseInt(hex, 16)).join(', ');
                    }
                  }
                } catch (e) {
                  console.error('Error parsing color:', e);
                }
                
                // Prepare volume data for the chart
                const volumeData = {
                  labels: exercise.data.slice(-5).map(d => {
                    const date = new Date(d.date);
                    return `${date.getMonth()+1}/${date.getDate()}`;
                  }),
                  datasets: [
                    {
                      data: exercise.data.slice(-5).map(d => d.volume),
                      color: (opacity = 1) => `rgba(${colorRgbValues}, ${opacity})`,
                      strokeWidth: 2
                    }
                  ],
                  legend: [exercise.name]
                };
                
                return (
                  <View key={index} style={[styles.exerciseCard, { backgroundColor: lightBackgroundColor }]}>
                    <View style={styles.exerciseCardHeader}>
                      <View style={styles.exerciseNameContainer}>
                        <View style={[styles.exerciseTypeIndicator, { backgroundColor: exerciseColor }]} />
                        <Text style={[styles.exerciseName, { color: colors.text }]}>
                          {exercise.name}
                        </Text>
                      </View>
                      <View style={styles.exerciseStats}>
                        <View style={styles.exerciseStat}>
                          <Text style={[styles.exerciseStatLabel, { color: colors.subtext }]}>Max Weight</Text>
                          <Text style={[styles.exerciseStatValue, { color: colors.text }]}>
                            {Math.max(...exercise.data.map(d => d.maxWeight))}{' kg'}
                          </Text>
                        </View>
                        <View style={styles.exerciseStat}>
                          <Text style={[styles.exerciseStatLabel, { color: colors.subtext }]}>Trend</Text>
                          <Text 
                            style={[
                              styles.exerciseTrendValue, 
                              { color: volumeTrend >= 0 ? '#4CAF50' : '#F44336' }
                            ]}
                          >
                            {volumeTrend >= 0 ? '+' : ''}{volumeTrend.toFixed(1)}%
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.chartContainer}>
                      <LineChart
                        data={volumeData}
                        width={windowWidth - 80}
                        height={120}
                        chartConfig={{
                          backgroundColor: 'transparent',
                          backgroundGradientFrom: currentTheme === 'dark' ? 'rgba(50, 50, 50, 0.8)' : 'rgba(240, 240, 240, 0.8)',
                          backgroundGradientTo: currentTheme === 'dark' ? 'rgba(40, 40, 40, 0.8)' : 'rgba(248, 248, 248, 0.8)',
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(${colorRgbValues}, ${opacity})`,
                          labelColor: (opacity = 1) => colors.subtext,
                          style: { 
                            borderRadius: 8,
                            padding: 4
                          },
                          propsForDots: {
                            r: "4",
                            strokeWidth: "1",
                            stroke: exerciseColor
                          },
                          propsForLabels: {
                            fontSize: 10
                          }
                        }}
                        bezier
                        style={{
                          borderRadius: 12,
                          paddingRight: 0,
                          elevation: 0,
                          shadowOpacity: 0
                        }}
                        withInnerLines={false}
                        withOuterLines={false}
                        withVerticalLabels={true}
                        withHorizontalLabels={true}
                        fromZero={true}
                        yAxisLabel=""
                        yAxisSuffix=" kg"
                      />
                    </View>
                  </View>
                );
              })}
            </View>
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
            <View style={styles.exerciseDistributionContainer}>
              <View style={styles.exerciseList}>
                {exerciseTrends.map((exercise, index) => {
                  // Determine exercise type (simplified categorization)
                  const exerciseType = 
                    exercise.name.toLowerCase().includes('bench') || 
                    exercise.name.toLowerCase().includes('squat') || 
                    exercise.name.toLowerCase().includes('deadlift') ||
                    exercise.name.toLowerCase().includes('row') ||
                    exercise.name.toLowerCase().includes('press') ? 'compound' : 
                    exercise.name.toLowerCase().includes('curl') ||
                    exercise.name.toLowerCase().includes('extension') ||
                    exercise.name.toLowerCase().includes('fly') ||
                    exercise.name.toLowerCase().includes('raise') ? 'isolation' : 
                    exercise.name.toLowerCase().includes('push') ||
                    exercise.name.toLowerCase().includes('pull') ||
                    exercise.name.toLowerCase().includes('dip') ||
                    exercise.name.toLowerCase().includes('up') ? 'bodyweight' : 'other';
                  
                  const exerciseColor = exerciseColors[exerciseType] || exerciseColors.other;
                  const totalVolume = exercise.data.reduce((sum, d) => sum + d.volume, 0);
                  const maxVolume = Math.max(...exerciseTrends.map(e => e.data.reduce((sum, d) => sum + d.volume, 0)));
                  const percentage = Math.round((totalVolume / maxVolume) * 100);
                  
                  return (
                    <View key={index} style={styles.exerciseDistributionItem}>
                      <View style={styles.exerciseDistributionRank}>
                        <Text style={[styles.exerciseDistributionNumber, { backgroundColor: exerciseColor, color: '#fff' }]}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={styles.exerciseDistributionInfo}>
                        <Text style={[styles.exerciseDistributionName, { color: colors.text }]}>
                          {exercise.name}
                        </Text>
                        <View style={[styles.exerciseDistributionBarWrapper, { backgroundColor: mediumBackgroundColor }]}>
                          <View 
                            style={[
                              styles.exerciseDistributionBar, 
                              { 
                                backgroundColor: exerciseColor,
                                width: `${percentage}%` 
                              }
                            ]} 
                          />
                        </View>
                      </View>
                      <Text style={[styles.exerciseDistributionVolume, { color: colors.text }]}>
                        {totalVolume.toLocaleString()} kg
                      </Text>
                    </View>
                  );
                })}
              </View>
              
              <View style={[styles.exerciseTypeKey, { borderTopColor: borderColor }]}>
                <Text style={[styles.exerciseTypeKeyTitle, { color: colors.text }]}>
                  Exercise Types
                </Text>
                <View style={styles.exerciseTypeList}>
                  <View style={styles.exerciseTypeItem}>
                    <View style={[styles.exerciseTypeDot, { backgroundColor: exerciseColors.compound }]} />
                    <Text style={[styles.exerciseTypeText, { color: colors.text }]}>Compound</Text>
                  </View>
                  <View style={styles.exerciseTypeItem}>
                    <View style={[styles.exerciseTypeDot, { backgroundColor: exerciseColors.isolation }]} />
                    <Text style={[styles.exerciseTypeText, { color: colors.text }]}>Isolation</Text>
                  </View>
                  <View style={styles.exerciseTypeItem}>
                    <View style={[styles.exerciseTypeDot, { backgroundColor: exerciseColors.bodyweight }]} />
                    <Text style={[styles.exerciseTypeText, { color: colors.text }]}>Bodyweight</Text>
                  </View>
                  <View style={styles.exerciseTypeItem}>
                    <View style={[styles.exerciseTypeDot, { backgroundColor: exerciseColors.other }]} />
                    <Text style={[styles.exerciseTypeText, { color: colors.text }]}>Other</Text>
                  </View>
                </View>
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
      <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
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
    marginTop: 8,
  },
  statCard: {
    width: '48%',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 14,
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
    width: '100%',
  },
  volumeSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  volumeStat: {
    alignItems: 'center',
    padding: 8,
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
  intensityDistributionCard: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
    width: '100%',
  },
  intensitySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  intensityLayout: {
    flexDirection: 'column',
  },
  intensityBarsContainer: {
    marginBottom: 12,
  },
  intensityBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  intensityBarLabel: {
    fontSize: 14,
    width: 70,
  },
  intensityBarWrapper: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  intensityBar: {
    height: 8,
    borderRadius: 4,
  },
  intensityBarPercent: {
    fontSize: 14,
    fontWeight: '500',
    width: 40,
    textAlign: 'right',
  },
  intensityValuesContainer: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  intensityValueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  intensityValueLabel: {
    fontSize: 14,
  },
  intensityValueText: {
    fontSize: 14,
    fontWeight: '500',
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
    marginBottom: 16,
  },
  exerciseCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    overflow: 'hidden',
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  exerciseNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  exerciseTypeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  exerciseStats: {
    flexDirection: 'row',
  },
  exerciseStat: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  exerciseStatLabel: {
    fontSize: 12,
  },
  exerciseStatValue: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  exerciseTrendValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 6,
    marginHorizontal: -4,
    borderRadius: 12,
    overflow: 'hidden'
  },
  exerciseChart: {
    borderRadius: 12,
    paddingRight: 0,
  },
  exerciseDistributionContainer: {
    padding: 4,
  },
  exerciseList: {
    marginBottom: 16,
  },
  exerciseDistributionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  exerciseDistributionRank: {
    marginRight: 12,
  },
  exerciseDistributionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: 'bold',
  },
  exerciseDistributionInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseDistributionName: {
    fontSize: 14,
    marginBottom: 4,
  },
  exerciseDistributionBarWrapper: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  exerciseDistributionBar: {
    height: 6,
    borderRadius: 3,
  },
  exerciseDistributionVolume: {
    fontSize: 14,
    fontWeight: '500',
    width: 80,
    textAlign: 'right',
  },
  exerciseTypeKey: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
  },
  exerciseTypeKeyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  exerciseTypeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  exerciseTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 6,
  },
  exerciseTypeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  exerciseTypeText: {
    fontSize: 12,
  },
  volumeBreakdown: {
    marginTop: 10,
    width: '100%',
    paddingHorizontal: 4,
  },
  volumeBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
  },
  intensityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  intensityLabel: {
    fontSize: 12,
    flex: 1,
  },
  intensityValue: {
    fontSize: 12,
    fontWeight: '500',
  },
  muscleDistributionContainer: {
    width: '100%',
  },
  enhancedBarsContainer: {
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
    width: 90,
    marginRight: 8,
  },
  muscleBarLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  muscleBarWrapper: {
    flex: 1,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  muscleBar: {
    height: 26,
    borderRadius: 13,
    position: 'absolute',
    left: 0,
    top: 0,
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
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
  },
  muscleBalanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
  },
  muscleBalanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
}); 