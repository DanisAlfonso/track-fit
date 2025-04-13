import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { useTheme } from '@/context/ThemeContext';
import { addDays, format, startOfWeek, endOfWeek, eachDayOfInterval, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

type WorkoutsByDay = {
  [key: string]: number;
};

type PersonalRecord = {
  exercise_name: string;
  max_weight: number;
  date: number;
};

const ProgressScreen = () => {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  
  const [loading, setLoading] = useState(true);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<WorkoutsByDay>({});
  const [monthlyWorkouts, setMonthlyWorkouts] = useState<WorkoutsByDay>({});
  const [totalVolume, setTotalVolume] = useState<number[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [averageWorkoutDuration, setAverageWorkoutDuration] = useState<number>(0);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  
  const screenWidth = Dimensions.get('window').width - 40;

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      
      // Get workout dates for frequency analysis
      const workoutsResult = await db.getAllAsync<{ date: number, duration: number }>(`
        SELECT date, duration FROM workouts 
        WHERE completed_at IS NOT NULL 
        ORDER BY date ASC
      `);
      
      // Get volume data (sum of weight * reps for each workout)
      const volumeResult = await db.getAllAsync<{ date: number, volume: number }>(`
        SELECT w.date, SUM(s.weight * s.reps) as volume 
        FROM workouts w
        JOIN workout_exercises we ON w.id = we.workout_id
        JOIN sets s ON we.id = s.workout_exercise_id
        WHERE w.completed_at IS NOT NULL
        GROUP BY w.id
        ORDER BY w.date ASC
        LIMIT 10
      `);

      // Get personal records (max weight for each exercise)
      const recordsResult = await db.getAllAsync<PersonalRecord>(`
        SELECT e.name as exercise_name, MAX(s.weight) as max_weight, w.date
        FROM exercises e
        JOIN workout_exercises we ON e.id = we.exercise_id
        JOIN sets s ON we.id = s.workout_exercise_id
        JOIN workouts w ON we.workout_id = w.id
        WHERE w.completed_at IS NOT NULL
        GROUP BY e.id
        ORDER BY max_weight DESC
        LIMIT 5
      `);
      
      // Process workout frequency data
      processWorkoutFrequencyData(workoutsResult);
      
      // Process volume data
      const volumeData = volumeResult.map(item => item.volume);
      setTotalVolume(volumeData);
      
      // Set personal records
      setPersonalRecords(recordsResult);
      
      // Calculate average workout duration
      if (workoutsResult.length > 0) {
        const totalDuration = workoutsResult.reduce((sum, workout) => sum + (workout.duration || 0), 0);
        setAverageWorkoutDuration(totalDuration / workoutsResult.length);
      }
      
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processWorkoutFrequencyData = (workouts: { date: number }[]) => {
    // Process for weekly view
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Week starts on Monday
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    const weekData: WorkoutsByDay = {};
    weekDays.forEach(day => {
      const dayStr = format(day, 'EEE');
      weekData[dayStr] = 0;
    });
    
    // Process for monthly view
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const monthData: WorkoutsByDay = {};
    
    // Organize days with dates as keys, but add week indicators for better readability
    monthDays.forEach(day => {
      // Get the day of the month and determine which week of the month it is
      const dayNum = parseInt(format(day, 'd'));
      const isFirstOfWeek = day.getDay() === 1 || dayNum === 1; // Monday or first day
      
      // Format labels to show day numbers, with week indicators for first day of week
      let dayStr = format(day, 'd');
      if (isFirstOfWeek) {
        // Add W1, W2, etc. prefix for first day of each week
        const weekOfMonth = Math.ceil(dayNum / 7);
        dayStr = `W${weekOfMonth}\n${dayStr}`;
      }
      
      monthData[dayStr] = 0;
    });
    
    // Count workouts
    workouts.forEach(workout => {
      const workoutDate = new Date(workout.date);
      
      // Check if within current week
      if (isWithinInterval(workoutDate, { start: weekStart, end: weekEnd })) {
        const dayStr = format(workoutDate, 'EEE');
        weekData[dayStr] = (weekData[dayStr] || 0) + 1;
      }
      
      // Check if within current month
      if (isWithinInterval(workoutDate, { start: monthStart, end: monthEnd })) {
        const dayNum = parseInt(format(workoutDate, 'd'));
        const isFirstOfWeek = workoutDate.getDay() === 1 || dayNum === 1;
        
        let dayStr = format(workoutDate, 'd');
        if (isFirstOfWeek) {
          const weekOfMonth = Math.ceil(dayNum / 7);
          dayStr = `W${weekOfMonth}\n${dayStr}`;
        }
        
        monthData[dayStr] = (monthData[dayStr] || 0) + 1;
      }
    });
    
    setWeeklyWorkouts(weekData);
    setMonthlyWorkouts(monthData);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Add a color generator function
  const getColorWithOpacity = (isWeekChart: boolean, value: number, maxValue: number): (opacity: number) => string => {
    return (opacity = 1) => {
      // Calculate dynamic opacity based on value
      const dynamicOpacity = isWeekChart 
        ? Math.min(0.3 + (value / maxValue) * 0.7, 1) 
        : Math.min(0.2 + (value / maxValue) * 0.8, 1);
      
      // Blend the opacity values
      const finalOpacity = opacity * dynamicOpacity;
      
      // Return the color with appropriate opacity
      return currentTheme === 'dark' 
        ? `rgba(76, 201, 240, ${finalOpacity})` 
        : `rgba(0, 153, 255, ${finalOpacity})`;
    };
  };

  const renderFrequencyChart = () => {
    const data = timeRange === 'week' ? weeklyWorkouts : monthlyWorkouts;
    const labels = Object.keys(data);
    const values = Object.values(data);
    
    // Calculate max value for better y-axis scaling
    const maxValue = Math.max(...values, 3);  // At least 3 for empty datasets
    
    // Create simplified labels for month view
    let displayLabels;
    if (timeRange === 'month') {
      // Group by weeks and use week numbers
      const weekLabels: string[] = [];
      labels.forEach((label) => {
        if (label.includes('W')) {
          // Extract week number
          const weekNum = label.split('\n')[0];
          weekLabels.push(weekNum);
        }
      });
      
      // Filter to ensure we have just the week markers
      displayLabels = weekLabels.filter((label, index, self) => 
        self.indexOf(label) === index
      );
      
      // Generate aggregated data by week
      const weekData = displayLabels.map(weekLabel => {
        const weekNum = parseInt(weekLabel.substring(1));
        const weekValues = Object.entries(data).filter(([key]) => 
          key.includes(`W${weekNum}`)
        ).map(([_, value]) => value);
        
        // Sum of workout counts for this week
        return weekValues.reduce((sum, val) => sum + val, 0);
      });
      
      return (
        <View style={styles.chartWrapper}>
          <BarChart
            data={{
              labels: displayLabels,
              datasets: [{ data: weekData }]
            }}
            width={screenWidth}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero={true}
            showValuesOnTopOfBars={true}
            segments={4}
            withInnerLines={false}
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: colors.card,
              backgroundGradientTo: colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) => {
                // Create a gradient effect by using the opacity
                return currentTheme === 'dark' 
                  ? `rgba(76, 201, 240, ${opacity * 0.8})` 
                  : `rgba(0, 153, 255, ${opacity * 0.8})`;
              },
              labelColor: (opacity = 1) => colors.text,
              barPercentage: 0.7,
              style: {
                borderRadius: 16,
              },
              propsForBackgroundLines: {
                strokeDasharray: '6, 6',
                strokeWidth: 1,
                stroke: colors.border,
              },
              propsForLabels: {
                fontSize: 12,
                fontWeight: '600',
              },
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16,
              paddingRight: 0,
              paddingLeft: 0,
              paddingTop: 20,
              paddingBottom: 0
            }}
          />
          <Text style={[styles.chartCaption, {color: colors.subtext}]}>
            Workouts by Week
          </Text>
        </View>
      );
    } else {
      // Week view
      return (
        <View style={styles.chartWrapper}>
          <BarChart
            data={{
              labels,
              datasets: [{ data: values }]
            }}
            width={screenWidth}
            height={220}
            yAxisLabel=""
            yAxisSuffix=""
            fromZero={true}
            showValuesOnTopOfBars={true}
            segments={4}
            withInnerLines={false}
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: colors.card,
              backgroundGradientTo: colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) => {
                // Create a gradient effect by using the opacity
                return currentTheme === 'dark' 
                  ? `rgba(76, 201, 240, ${opacity * 0.8})` 
                  : `rgba(0, 153, 255, ${opacity * 0.8})`;
              },
              labelColor: (opacity = 1) => colors.text,
              barPercentage: 0.8,
              style: {
                borderRadius: 16,
              },
              propsForBackgroundLines: {
                strokeDasharray: '6, 6',
                strokeWidth: 1,
                stroke: colors.border,
              },
              propsForLabels: {
                fontSize: 12,
                fontWeight: '600',
              },
            }}
            style={{
              marginVertical: 8,
              borderRadius: 16,
              paddingRight: 0,
              paddingLeft: 0,
              paddingTop: 20,
              paddingBottom: 0
            }}
          />
          <Text style={[styles.chartCaption, {color: colors.subtext}]}>
            Workouts by Day
          </Text>
        </View>
      );
    }
  };

  const renderVolumeChart = () => {
    if (totalVolume.length === 0) {
      return (
        <View style={styles.emptyChartContainer}>
          <FontAwesome5 name="chart-line" size={24} color={colors.subtext} />
          <Text style={[styles.emptyChartText, { color: colors.subtext }]}>
            Not enough data to display volume trend
          </Text>
        </View>
      );
    }
    
    // Generate better labels for the workouts
    const labels = Array.from({ length: totalVolume.length }, (_, i) => {
      if (i === 0) return 'First';
      if (i === totalVolume.length - 1) return 'Last';
      if (totalVolume.length <= 4 || i % Math.ceil(totalVolume.length / 4) === 0) {
        return `W${i+1}`;
      }
      return '';
    });
    
    // Normalize data for better visualization
    const maxVolume = Math.max(...totalVolume);
    const minVolume = Math.min(...totalVolume, maxVolume * 0.6); // For better scale
    const normalizedData = totalVolume.map(v => v < minVolume ? minVolume : v);
    
    return (
      <View style={styles.chartWrapper}>
        <LineChart
          data={{
            labels,
            datasets: [{ data: normalizedData }]
          }}
          width={screenWidth}
          height={220}
          yAxisLabel=""
          yAxisSuffix=""
          segments={4}
          fromZero={false}
          withInnerLines={false}
          withOuterLines={true}
          bezier
          chartConfig={{
            backgroundColor: 'transparent',
            backgroundGradientFrom: colors.card,
            backgroundGradientTo: colors.card,
            decimalPlaces: 0,
            color: (opacity = 1) => {
              return currentTheme === 'dark' 
                ? `rgba(140, 158, 255, ${opacity * 0.8})` 
                : `rgba(76, 117, 240, ${opacity * 0.8})`;
            },
            strokeWidth: 3,
            labelColor: (opacity = 1) => colors.text,
            style: {
              borderRadius: 16,
            },
            propsForBackgroundLines: {
              strokeDasharray: '6, 6',
              strokeWidth: 1,
              stroke: colors.border,
            },
            propsForLabels: {
              fontSize: 12,
              fontWeight: '600',
            },
            propsForDots: {
              r: "5",
              strokeWidth: "2",
              stroke: colors.card
            },
            fillShadowGradientFrom: currentTheme === 'dark' ? "rgba(140, 158, 255, 0.5)" : "rgba(76, 117, 240, 0.5)",
            fillShadowGradientTo: currentTheme === 'dark' ? "rgba(140, 158, 255, 0.1)" : "rgba(76, 117, 240, 0.1)",
          }}
          style={{
            marginVertical: 8,
            borderRadius: 16,
            paddingRight: 0,
            paddingLeft: 0,
            paddingTop: 20,
            paddingBottom: 0
          }}
        />
        <Text style={[styles.chartCaption, {color: colors.subtext}]}>
          Total volume (kg × reps) per workout
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: "Progress",
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading your progress...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: "Progress",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />

      {/* Workout Frequency Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Workout Frequency</Text>
          <View style={styles.timeRangeSelector}>
            <TouchableOpacity
              style={[
                styles.timeRangeButton,
                timeRange === 'week' && { backgroundColor: colors.primary }
              ]}
              onPress={() => setTimeRange('week')}
            >
              <Text style={[
                styles.timeRangeText,
                { color: timeRange === 'week' ? 'white' : colors.text }
              ]}>Week</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.timeRangeButton,
                timeRange === 'month' && { backgroundColor: colors.primary }
              ]}
              onPress={() => setTimeRange('month')}
            >
              <Text style={[
                styles.timeRangeText,
                { color: timeRange === 'month' ? 'white' : colors.text }
              ]}>Month</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
          {renderFrequencyChart()}
        </View>
      </View>

      {/* Workout Volume Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Total Volume Trend</Text>
        <View style={[styles.chartContainer, { backgroundColor: colors.card }]}>
          {renderVolumeChart()}
        </View>
      </View>

      {/* Key Stats Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Workout Stats</Text>
        <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <FontAwesome5 name="clock" size={18} color={colors.primary} style={styles.statIcon} />
            <View>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Avg. Workout Duration</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatDuration(averageWorkoutDuration)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Personal Records Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Records</Text>
        <View style={[styles.recordsContainer, { backgroundColor: colors.card }]}>
          {personalRecords.length > 0 ? (
            personalRecords.map((record, index) => (
              <View 
                key={`${record.exercise_name}-${index}`} 
                style={[
                  styles.recordItem, 
                  index < personalRecords.length - 1 && { 
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border 
                  }
                ]}
              >
                <View style={styles.recordDetails}>
                  <Text style={[styles.recordExercise, { color: colors.text }]}>{record.exercise_name}</Text>
                  <Text style={[styles.recordDate, { color: colors.subtext }]}>
                    {new Date(record.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={[styles.recordWeight, { color: colors.primary }]}>
                  {record.max_weight} kg
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyRecordsContainer}>
              <FontAwesome5 name="trophy" size={24} color={colors.subtext} />
              <Text style={[styles.emptyRecordsText, { color: colors.subtext }]}>
                No personal records yet
              </Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
  },
  timeRangeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chartContainer: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyChartText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  statsContainer: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statIcon: {
    marginRight: 12,
    width: 24,
    alignItems: 'center',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  recordsContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  recordDetails: {
    flex: 1,
  },
  recordExercise: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  recordDate: {
    fontSize: 13,
  },
  recordWeight: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyRecordsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyRecordsText: {
    marginTop: 12,
    fontSize: 16,
  },
  chartWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  chartCaption: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
});

export default ProgressScreen; 