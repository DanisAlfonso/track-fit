import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  ScrollView,
  Dimensions
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import { getDatabase } from '@/utils/database';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { Calendar, DateData } from 'react-native-calendars';

type RoutineAssignment = {
  day_of_week: number;
  day_name: string;
  routine_id: number | null;
  routine_name: string | null;
  exercise_count: number;
};

type Routine = {
  id: number;
  name: string;
  exerciseCount: number;
};

type MarkedDates = {
  [date: string]: {
    marked?: boolean;
    dotColor?: string;
    selected?: boolean;
    selectedColor?: string;
    customContainerStyle?: {
      borderWidth?: number;
      borderColor?: string;
      borderRadius?: number;
    };
    customStyles?: {
      container: {
        backgroundColor?: string;
        borderRadius?: number;
        borderWidth?: number;
        borderColor?: string;
      };
      text: {
        color?: string;
        fontWeight?: string;
      };
    };
    periods?: {
      startingDay: boolean;
      endingDay: boolean;
      color: string;
    }[];
  };
};

export default function WeeklyScheduleScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];

  const [loading, setLoading] = useState(true);
  const [weekSchedule, setWeekSchedule] = useState<RoutineAssignment[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<number | null>(null);
  const [routineSelectVisible, setRoutineSelectVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [markedDates, setMarkedDates] = useState<MarkedDates>({});

  const dayNames = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ];

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      await loadRoutines();
      await loadWeekSchedule();
      updateCalendarMarkers();
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const loadRoutines = async () => {
    try {
      const db = await getDatabase();
      const results = await db.getAllAsync<Routine>(`
        SELECT r.id, r.name, 
        (SELECT COUNT(*) FROM routine_exercises WHERE routine_id = r.id) as exerciseCount
        FROM routines r
        ORDER BY r.name
      `);
      setRoutines(results);
    } catch (error) {
      console.error('Error loading routines:', error);
      throw error;
    }
  };

  const loadWeekSchedule = async () => {
    try {
      const db = await getDatabase();
      
      // Query scheduled routines
      const scheduleResults = await db.getAllAsync<{
        day_of_week: number;
        routine_id: number;
        routine_name: string;
        exercise_count: number;
      }>(`
        SELECT ws.day_of_week, ws.routine_id, r.name as routine_name,
        (SELECT COUNT(*) FROM routine_exercises WHERE routine_id = r.id) as exercise_count
        FROM weekly_schedule ws
        JOIN routines r ON ws.routine_id = r.id
        ORDER BY ws.day_of_week
      `);

      // Create a full week schedule with all days
      const fullSchedule: RoutineAssignment[] = dayNames.map((name, index) => {
        const scheduled = scheduleResults.find(s => s.day_of_week === index);
        return {
          day_of_week: index,
          day_name: name,
          routine_id: scheduled?.routine_id || null,
          routine_name: scheduled?.routine_name || null,
          exercise_count: scheduled?.exercise_count || 0
        };
      });

      setWeekSchedule(fullSchedule);
    } catch (error) {
      console.error('Error loading week schedule:', error);
      throw error;
    }
  };

  const updateCalendarMarkers = () => {
    const today = new Date();
    const markers: MarkedDates = {};
    
    // Mark the next 4 weeks with routine colors
    for (let i = 0; i < 28; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const routineForDay = weekSchedule.find(s => s.day_of_week === dayOfWeek);
      
      if (routineForDay && routineForDay.routine_id) {
        const dateString = date.toISOString().split('T')[0];
        
        // Get the routine index to determine its color (for consistency with weekly grid)
        const routineIndex = weekSchedule
          .filter(d => d.routine_id !== null)
          .map(d => d.routine_name)
          .indexOf(routineForDay.routine_name);
        
        const routineColor = getLegendColor(routineIndex, colors);
        
        markers[dateString] = {
          // Create a more informative marker with custom styling
          customStyles: {
            container: {
              backgroundColor: routineColor,
              borderRadius: 8,
            },
            text: {
              color: 'white',
              fontWeight: '600',
            }
          },
          // Add a period to signal there's content without using the dot
          periods: [
            {
              startingDay: true,
              endingDay: true,
              color: 'transparent'
            }
          ]
        };
      }
    }
    
    // Mark today with a special style
    const todayString = today.toISOString().split('T')[0];
    markers[todayString] = {
      ...markers[todayString],
      customStyles: {
        container: {
          backgroundColor: markers[todayString]?.customStyles?.container?.backgroundColor || colors.primary,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: '#ffffff',
        },
        text: {
          color: 'white',
          fontWeight: 'bold',
        }
      }
    };
    
    setMarkedDates(markers);
  };

  const handleDayPress = (day: number) => {
    setSelectedDay(day);
    setRoutineSelectVisible(true);
    
    // Pre-select the current routine for this day if it exists
    const daySchedule = weekSchedule.find(s => s.day_of_week === day);
    setSelectedRoutine(daySchedule?.routine_id || null);
  };

  const handleRoutineSelect = async (routineId: number | null) => {
    if (selectedDay === null) return;
    
    try {
      setLoading(true);
      const db = await getDatabase();
      
      if (routineId === null) {
        // Remove routine assignment
        await db.runAsync(
          'DELETE FROM weekly_schedule WHERE day_of_week = ?',
          [selectedDay]
        );
      } else {
        // Check if this day already has a routine assigned
        const existing = await db.getFirstAsync(
          'SELECT id FROM weekly_schedule WHERE day_of_week = ?', 
          [selectedDay]
        );
        
        if (existing) {
          // Update existing assignment
          await db.runAsync(
            'UPDATE weekly_schedule SET routine_id = ?, created_at = ? WHERE day_of_week = ?',
            [routineId, Date.now(), selectedDay]
          );
        } else {
          // Create new assignment
          await db.runAsync(
            'INSERT INTO weekly_schedule (day_of_week, routine_id, created_at) VALUES (?, ?, ?)',
            [selectedDay, routineId, Date.now()]
          );
        }
      }
      
      // Reload schedule
      await loadWeekSchedule();
      setRoutineSelectVisible(false);
      setSelectedDay(null);
      setSelectedRoutine(null);
    } catch (error) {
      console.error('Error updating schedule:', error);
      Alert.alert('Error', 'Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleClearSchedule = () => {
    Alert.alert(
      'Clear Schedule',
      'Are you sure you want to clear the entire weekly schedule?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const db = await getDatabase();
              await db.runAsync('DELETE FROM weekly_schedule');
              await loadWeekSchedule();
            } catch (error) {
              console.error('Error clearing schedule:', error);
              Alert.alert('Error', 'Failed to clear schedule');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderDayCard = (day: RoutineAssignment) => {
    const isToday = new Date().getDay() === day.day_of_week;
    const hasRoutine = day.routine_id !== null;

    return (
      <TouchableOpacity
        key={day.day_of_week}
        style={[
          styles.dayCard,
          {
            backgroundColor: colors.card,
            borderColor: isToday ? colors.primary : 'transparent',
            borderWidth: isToday ? 2 : 0,
          }
        ]}
        onPress={() => handleDayPress(day.day_of_week)}
        activeOpacity={0.7}
      >
        <View style={styles.dayHeader}>
          <Text style={[styles.dayName, { color: colors.text }]}>{day.day_name}</Text>
          {isToday && (
            <View style={[styles.todayBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.todayText}>TODAY</Text>
            </View>
          )}
        </View>

        {hasRoutine ? (
          <View style={styles.routineContainer}>
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.routineBadge}
            >
              <FontAwesome5 name="dumbbell" size={14} color="white" style={styles.routineIcon} />
              <Text style={styles.routineName}>{day.routine_name}</Text>
            </LinearGradient>
            <Text style={[styles.exerciseCount, { color: colors.subtext }]}>
              {day.exercise_count} exercise{day.exercise_count !== 1 ? 's' : ''}
            </Text>
          </View>
        ) : (
          <View style={styles.noRoutineContainer}>
            <Text style={[styles.noRoutineText, { color: colors.subtext }]}>No workout planned</Text>
            <View style={[styles.addButton, { borderColor: colors.primary }]}>
              <FontAwesome5 name="plus" size={12} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary }]}>Add</Text>
            </View>
          </View>
        )}

        <View style={styles.dayFooter}>
          <FontAwesome5 
            name="edit" 
            size={14} 
            color={colors.primary} 
            style={styles.editIcon} 
          />
          <Text style={[styles.tapToEdit, { color: colors.primary }]}>
            {hasRoutine ? 'Change' : 'Assign'} routine
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Routine selection modal (displayed when a day is selected)
  const renderRoutineSelection = () => {
    if (!routineSelectVisible) return null;

    return (
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.routineSelectModal, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Select Routine for {dayNames[selectedDay || 0]}
          </Text>
          
          <ScrollView 
            style={styles.routineList}
            contentContainerStyle={styles.routineListContent}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={[
                styles.routineOption,
                { borderBottomColor: colors.border, borderBottomWidth: 1 }
              ]}
              onPress={() => handleRoutineSelect(null)}
            >
              <View style={styles.routineOptionContent}>
                <View style={[styles.emptyRoutineIcon, { backgroundColor: colors.border }]}>
                  <FontAwesome5 name="times" size={16} color={colors.subtext} />
                </View>
                <View>
                  <Text style={[styles.routineOptionName, { color: colors.text }]}>
                    Rest Day
                  </Text>
                  <Text style={[styles.routineOptionDescription, { color: colors.subtext }]}>
                    No workout planned
                  </Text>
                </View>
              </View>
              {selectedRoutine === null && (
                <FontAwesome5 name="check-circle" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>

            {routines.map(routine => (
              <TouchableOpacity
                key={routine.id}
                style={[
                  styles.routineOption,
                  { borderBottomColor: colors.border, borderBottomWidth: 1 }
                ]}
                onPress={() => handleRoutineSelect(routine.id)}
              >
                <View style={styles.routineOptionContent}>
                  <LinearGradient
                    colors={[colors.primary, colors.secondary]}
                    style={styles.routineIconGradient}
                  >
                    <FontAwesome5 name="dumbbell" size={16} color="white" />
                  </LinearGradient>
                  <View>
                    <Text style={[styles.routineOptionName, { color: colors.text }]}>
                      {routine.name}
                    </Text>
                    <Text style={[styles.routineOptionDescription, { color: colors.subtext }]}>
                      {routine.exerciseCount} exercise{routine.exerciseCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
                {selectedRoutine === routine.id && (
                  <FontAwesome5 name="check-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
              onPress={() => {
                setRoutineSelectVisible(false);
                setSelectedDay(null);
                setSelectedRoutine(null);
              }}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Called after the week schedule is loaded to update calendar markers
  useEffect(() => {
    if (weekSchedule.length > 0) {
      updateCalendarMarkers();
    }
  }, [weekSchedule]);

  // Handle calendar date change
  const onDateSelect = (date: DateData) => {
    const selectedDate = new Date(date.dateString);
    setSelectedDate(selectedDate);
    
    // Automatically scroll to and highlight the corresponding day of week
    const dayOfWeek = selectedDate.getDay();
    const dayItem = weekSchedule.find(day => day.day_of_week === dayOfWeek);
    
    if (dayItem) {
      handleDayPress(dayOfWeek);
    }
  };

  // Render a summary grid showing the entire week at once
  const renderWeeklyGrid = () => {
    return (
      <View style={[styles.weeklyGridContainer, { backgroundColor: colors.card }]}>
        <Text style={[styles.weeklyGridTitle, { color: colors.text }]}>Weekly Training Split</Text>
        
        <View style={styles.gridLegendContainer}>
          {weekSchedule
            .filter(day => day.routine_id !== null)
            .map(day => day.routine_name)
            .filter((routineName, index, self) => self.indexOf(routineName) === index) // Get unique routine names
            .map((routineName, index) => (
              <View key={index} style={styles.legendItem}>
                <View 
                  style={[
                    styles.legendColorBox, 
                    { backgroundColor: getLegendColor(index, colors) }
                  ]} 
                />
                <Text style={[styles.legendText, { color: colors.subtext }]} numberOfLines={1}>
                  {routineName}
                </Text>
              </View>
            ))}
        </View>
        
        <View style={styles.weekGrid}>
          {weekSchedule.map((day, index) => {
            const hasRoutine = day.routine_id !== null;
            const isToday = new Date().getDay() === day.day_of_week;
            const routineIndex = weekSchedule
              .filter(d => d.routine_id !== null)
              .map(d => d.routine_name)
              .indexOf(day.routine_name);
            
            return (
              <TouchableOpacity 
                key={index}
                style={[
                  styles.dayGridCell,
                  { 
                    backgroundColor: hasRoutine 
                      ? getLegendColor(routineIndex, colors) 
                      : 'transparent',
                    borderColor: isToday ? colors.primary : colors.border
                  }
                ]}
                onPress={() => handleDayPress(day.day_of_week)}
              >
                <Text style={[
                  styles.dayGridName, 
                  { 
                    color: hasRoutine ? '#fff' : colors.text,
                    fontWeight: isToday ? 'bold' : 'normal'
                  }
                ]}>
                  {day.day_name.slice(0, 3)}
                </Text>
                
                {hasRoutine && (
                  <Text style={styles.dayGridRoutine} numberOfLines={1}>
                    {day.routine_name}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };
  
  // Helper function to get colors for different routines
  const getLegendColor = (index: number, colors: any) => {
    const colorOptions = [
      colors.primary,
      colors.secondary,
      colors.accent,
      '#8a5cde', // purple
      '#50a2a7', // teal
      '#f2994a', // orange
      '#4a6cf2', // blue
    ];
    
    return colorOptions[index % colorOptions.length];
  };

  if (loading && weekSchedule.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Weekly Schedule' }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>
            Loading schedule...
          </Text>
        </View>
      </View>
    );
  }

  const calendarTheme = {
    backgroundColor: 'transparent',
    calendarBackground: 'transparent',
    textSectionTitleColor: colors.subtext,
    selectedDayBackgroundColor: colors.primary,
    selectedDayTextColor: '#ffffff',
    todayTextColor: colors.primary,
    dayTextColor: colors.text,
    textDisabledColor: colors.border,
    dotColor: colors.primary,
    selectedDotColor: '#ffffff',
    arrowColor: colors.primary,
    monthTextColor: colors.text,
    indicatorColor: colors.primary,
    textDayFontWeight: '400',
    textMonthFontWeight: 'bold',
    textDayHeaderFontWeight: '600',
    textDayFontSize: 14,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 13,
    'stylesheet.calendar.main': {
      week: {
        marginVertical: 2,
        flexDirection: 'row',
        justifyContent: 'space-around',
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: 'Weekly Schedule' }} />
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Weekly Schedule</Text>
        <TouchableOpacity 
          style={[styles.clearButton, { borderColor: colors.error }]}
          onPress={handleClearSchedule}
        >
          <FontAwesome5 name="trash-alt" size={14} color={colors.error} />
          <Text style={[styles.clearButtonText, { color: colors.error }]}>Clear All</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={[styles.description, { color: colors.subtext }]}>
        Plan your workout week by assigning routines to specific days
      </Text>
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Weekly Calendar Grid Overview */}
        {renderWeeklyGrid()}

        {/* Calendar View */}
        <View style={[styles.calendarContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.calendarTitle, { color: colors.text }]}>Monthly Overview</Text>
          <Calendar
            theme={calendarTheme}
            markingType='custom'
            markedDates={markedDates}
            onDayPress={onDateSelect}
            enableSwipeMonths
            hideExtraDays
          />
          <View style={styles.calendarLegend}>
            {weekSchedule
              .filter(day => day.routine_id !== null)
              .map(day => day.routine_name)
              .filter((routineName, index, self) => self.indexOf(routineName) === index) // Get unique routine names
              .map((routineName, index) => (
                <View key={index} style={styles.calendarLegendItem}>
                  <View 
                    style={[
                      styles.calendarLegendColor, 
                      { backgroundColor: getLegendColor(index, colors) }
                    ]} 
                  />
                  <Text style={[styles.calendarLegendText, { color: colors.subtext }]} numberOfLines={1}>
                    {routineName}
                  </Text>
                </View>
              ))}
          </View>
        </View>
        
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Details</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.subtext }]}>
            Tap on a day to assign a routine
          </Text>
        </View>
        
        {/* Daily Cards */}
        {weekSchedule.map(day => renderDayCard(day))}
      </ScrollView>
      
      {renderRoutineSelection()}
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  clearButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  dayCard: {
    borderRadius: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  routineContainer: {
    marginBottom: 16,
  },
  routineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  routineIcon: {
    marginRight: 6,
  },
  routineName: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  exerciseCount: {
    fontSize: 14,
  },
  noRoutineContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  noRoutineText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  addButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  dayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editIcon: {
    marginRight: 6,
  },
  tapToEdit: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  routineSelectModal: {
    width: width * 0.85,
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  routineList: {
    maxHeight: 400,
  },
  routineListContent: {
    paddingVertical: 8,
  },
  routineOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  routineOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  routineIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emptyRoutineIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  routineOptionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  routineOptionDescription: {
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontWeight: '600',
    fontSize: 16,
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
  calendarContainer: {
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  calendarLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 8,
  },
  calendarLegendColor: {
    width: 14,
    height: 14,
    borderRadius: 4,
    marginRight: 4,
  },
  calendarLegendText: {
    fontSize: 12,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  // Weekly Grid Styles
  weeklyGridContainer: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  weeklyGridTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  gridLegendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 8,
  },
  legendColorBox: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 12,
    maxWidth: 100,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  dayGridCell: {
    width: '13.5%',
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    padding: 4,
  },
  dayGridName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
    textAlign: 'center',
  },
  dayGridRoutine: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
}); 