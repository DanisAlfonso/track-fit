import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { LinearGradient } from 'expo-linear-gradient';

type Workout = {
  id: number;
  name: string;
  date: number;
  completed_at: number | null;
  routine_name: string;
  exercise_count: number;
  duration: number;
  total_sets: number;
  total_volume: number;
  max_weight: number;
  primary_muscles?: string;
  selected?: boolean;
};

export default function HistoryScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState<number[]>([]);
  const [expandedWorkouts, setExpandedWorkouts] = useState<number[]>([]);
  
  // Add state for the delete confirmation modals
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [deleteAllConfirmationVisible, setDeleteAllConfirmationVisible] = useState(false);
  const [workoutToDelete, setWorkoutToDelete] = useState<number | null>(null);

  // Animation
  const [fadeAnim] = useState(new Animated.Value(0));
  const [translateY] = useState(new Animated.Value(20));

  // Before the loadWorkouts function, add this new function to handle finishing a workout:
  const [finishingWorkout, setFinishingWorkout] = useState(false);
  
  // Use focus effect to reload data when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
      
      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        })
      ]).start();
    }, [])
  );

  const loadWorkouts = async () => {
    try {
      setIsLoading(true);
      const db = await getDatabase();
      const results = await db.getAllAsync<Workout>(`
        SELECT 
          w.id, w.name, w.date, w.completed_at, w.duration,
          r.name as routine_name,
          (SELECT COUNT(*) FROM workout_exercises WHERE workout_id = w.id) as exercise_count,
          (SELECT COUNT(*) FROM sets s 
           JOIN workout_exercises we ON s.workout_exercise_id = we.id 
           WHERE we.workout_id = w.id) as total_sets,
          (SELECT SUM(s.weight * s.reps) FROM sets s 
           JOIN workout_exercises we ON s.workout_exercise_id = we.id 
           WHERE we.workout_id = w.id) as total_volume,
          (SELECT MAX(s.weight) FROM sets s 
           JOIN workout_exercises we ON s.workout_exercise_id = we.id 
           WHERE we.workout_id = w.id) as max_weight,
          (SELECT GROUP_CONCAT(DISTINCT e.primary_muscle) 
           FROM workout_exercises we 
           JOIN exercises e ON we.exercise_id = e.id 
           WHERE we.workout_id = w.id 
           LIMIT 3) as primary_muscles
        FROM workouts w
        LEFT JOIN routines r ON w.routine_id = r.id
        ORDER BY w.date DESC
      `);
      
      setWorkouts(results);
    } catch (error) {
      console.error('Error loading workouts:', error);
      showToast('Failed to load workout history', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteWorkout = (workoutId: number) => {
    // Set the workout ID to delete and show the confirmation modal
    setWorkoutToDelete(workoutId);
    setDeleteConfirmationVisible(true);
  };
  
  // Add new function to handle the confirmed workout deletion
  const confirmDeleteWorkout = async () => {
    if (!workoutToDelete && selectedWorkouts.length === 0) return;
    
    try {
      setIsDeleting(true);
      const db = await getDatabase();
      
      // Transaction to ensure all related data is deleted
      await db.runAsync('BEGIN TRANSACTION');
      
      try {
        if (workoutToDelete) {
          // Single workout deletion
          // Delete workout exercises first due to foreign key constraint
          await db.runAsync('DELETE FROM workout_exercises WHERE workout_id = ?', [workoutToDelete]);
          
          // Then delete the workout
          await db.runAsync('DELETE FROM workouts WHERE id = ?', [workoutToDelete]);
        } else if (selectedWorkouts.length > 0) {
          // Batch deletion
          const placeholders = selectedWorkouts.map(() => '?').join(',');
          
          // Delete workout exercises first due to foreign key constraint
          await db.runAsync(`DELETE FROM workout_exercises WHERE workout_id IN (${placeholders})`, selectedWorkouts);
          
          // Then delete the workouts
          await db.runAsync(`DELETE FROM workouts WHERE id IN (${placeholders})`, selectedWorkouts);
        }
        
        // Commit the transaction
        await db.runAsync('COMMIT');
        
        // Refresh the workout list
        await loadWorkouts();
        
        // Exit edit mode after batch deletion
        if (selectedWorkouts.length > 0) {
          setEditMode(false);
          setSelectedWorkouts([]);
        }
        
        showToast(
          workoutToDelete ? 'Workout deleted successfully' : 'Selected workouts deleted successfully', 
          'success'
        );
      } catch (error) {
        // Rollback in case of error
        await db.runAsync('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting workout(s):', error);
      showToast('Failed to delete workout(s)', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteConfirmationVisible(false);
      setWorkoutToDelete(null);
    }
  };

  const confirmDeleteAllWorkouts = async () => {
    try {
      setIsDeleting(true);
      const db = await getDatabase();
      
      // Transaction to ensure all related data is deleted
      await db.runAsync('BEGIN TRANSACTION');
      
      try {
        // Delete all workout exercises first
        await db.runAsync('DELETE FROM workout_exercises');
        
        // Then delete all workouts
        await db.runAsync('DELETE FROM workouts');
        
        // Commit the transaction
        await db.runAsync('COMMIT');
        
        // Refresh the workout list
        await loadWorkouts();
        
        // Exit edit mode
        setEditMode(false);
        setSelectedWorkouts([]);
        
        showToast('All workout history deleted successfully', 'success');
      } catch (error) {
        // Rollback in case of error
        await db.runAsync('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting all workouts:', error);
      showToast('Failed to delete all workouts', 'error');
    } finally {
      setIsDeleting(false);
      setDeleteAllConfirmationVisible(false);
    }
  };

  const toggleWorkoutSelection = (workoutId: number) => {
    if (selectedWorkouts.includes(workoutId)) {
      setSelectedWorkouts(selectedWorkouts.filter(id => id !== workoutId));
    } else {
      setSelectedWorkouts([...selectedWorkouts, workoutId]);
    }
  };

  const toggleEditMode = () => {
    if (editMode) {
      // Exit edit mode
      setEditMode(false);
      setSelectedWorkouts([]);
    } else {
      // Enter edit mode
      setEditMode(true);
    }
  };

  const toggleExpandWorkout = (workoutId: number) => {
    if (expandedWorkouts.includes(workoutId)) {
      setExpandedWorkouts(expandedWorkouts.filter(id => id !== workoutId));
    } else {
      setExpandedWorkouts([...expandedWorkouts, workoutId]);
    }
  };

  const selectAllWorkouts = () => {
    if (selectedWorkouts.length === workouts.length) {
      // Deselect all
      setSelectedWorkouts([]);
    } else {
      // Select all
      setSelectedWorkouts(workouts.map(workout => workout.id));
    }
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

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const finishWorkout = async (workoutId: number) => {
    try {
      setFinishingWorkout(true);
      const db = await getDatabase();
      
      // Mark the workout as completed
      await db.runAsync(
        'UPDATE workouts SET completed_at = ? WHERE id = ?',
        [Date.now(), workoutId]
      );
      
      // Refresh the workouts list
      await loadWorkouts();
      showToast('Workout marked as completed', 'success');
    } catch (error) {
      console.error('Error finishing workout:', error);
      showToast('Failed to finish workout', 'error');
    } finally {
      setFinishingWorkout(false);
    }
  };

  const renderWorkoutItem = ({ item, index }: { item: Workout, index: number }) => {
    const isSelected = selectedWorkouts.includes(item.id);
    const isExpanded = expandedWorkouts.includes(item.id);
    const animDelay = index * 80;
    
    // Process primary muscle groups for display
    const muscleGroups = item.primary_muscles ? 
      [...new Set(item.primary_muscles.split(','))].join(', ') : 
      'Not specified';
    
    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: translateY }],
        }}
      >
        <TouchableOpacity 
          style={[
            styles.workoutCard, 
            { 
              backgroundColor: colors.card,
              borderColor: isSelected ? colors.primary : 'transparent',
              borderWidth: isSelected ? 1 : 0
            }
          ]}
          onPress={() => {
            if (editMode) {
              toggleWorkoutSelection(item.id);
            } else {
              router.push({ pathname: "/workout/[id]", params: { id: item.id } });
            }
          }}
          onLongPress={() => {
            if (!editMode) {
              setEditMode(true);
              toggleWorkoutSelection(item.id);
            }
          }}
          activeOpacity={0.7}
          disabled={isDeleting}
        >
          {editMode && (
            <View style={styles.selectionIndicator}>
              <View style={[
                styles.checkbox, 
                { 
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.primary : 'transparent'
                }
              ]}>
                {isSelected && <FontAwesome5 name="check" size={12} color="white" />}
              </View>
            </View>
          )}
          
          <View style={[styles.workoutHeader, editMode && styles.workoutHeaderWithSelection]}>
            <View style={styles.workoutTitleContainer}>
              <Text style={[styles.workoutName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.workoutDate, { color: colors.subtext }]}>
                {formatDate(item.date)}
              </Text>
            </View>
            
            {!editMode && (
              <View style={styles.workoutActions}>
                <TouchableOpacity
                  onPress={() => router.push(`/workout/analytics/${item.id}`)}
                  style={styles.expandButton}
                >
                  <FontAwesome5 
                    name="chart-bar" 
                    size={14} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => toggleExpandWorkout(item.id)}
                  style={styles.expandButton}
                >
                  <FontAwesome5 
                    name={isExpanded ? "chevron-up" : "chevron-down"} 
                    size={14} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Basic Info Summary */}
          <View style={styles.workoutSummary}>
            <View style={styles.summaryItem}>
              <FontAwesome5 name="dumbbell" size={14} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.subtext }]}>
                {item.exercise_count} exercise{item.exercise_count !== 1 ? 's' : ''}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <FontAwesome5 name="clock" size={14} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.subtext }]}>
                {formatDuration(item.duration)}
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <FontAwesome name={item.completed_at ? "check-circle" : "clock-o"} 
                size={14} 
                color={item.completed_at ? colors.success : colors.warning} 
              />
              <Text style={[styles.summaryText, { color: colors.subtext }]}>
                {item.completed_at ? 'Completed' : 'In Progress'}
              </Text>
              {!item.completed_at && (
                <TouchableOpacity 
                  style={[styles.resumeButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push({ pathname: "/workout/start", params: { workoutId: item.id } })}
                >
                  <Text style={styles.resumeButtonText}>Resume</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Expanded Details */}
          {isExpanded && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              
              <View style={styles.expandedDetails}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Sets</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{item.total_sets || 0}</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Max Weight</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{item.max_weight || 0} kg</Text>
                  </View>
                  
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.subtext }]}>Volume</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{item.total_volume || 0} kg</Text>
                  </View>
                </View>
                
                <View style={styles.muscleGroupsContainer}>
                  <Text style={[styles.muscleGroupsLabel, { color: colors.subtext }]}>Muscle Groups:</Text>
                  <Text style={[styles.muscleGroupsText, { color: colors.text }]}>{muscleGroups}</Text>
                </View>
                
                <View style={styles.routineContainer}>
                  <FontAwesome name="calendar" size={14} color={colors.primary} />
                  <Text style={[styles.routineText, { color: colors.subtext }]}>
                    {item.routine_name || 'Custom Workout'}
                  </Text>
                </View>
                
                {!item.completed_at && (
                  <View style={styles.workoutActionsContainer}>
                    <TouchableOpacity 
                      style={[styles.finishWorkoutButton, { backgroundColor: colors.primary }]}
                      onPress={() => finishWorkout(item.id)}
                    >
                      <FontAwesome name="check-circle" size={16} color="white" style={{ marginRight: 8 }} />
                      <Text style={styles.finishWorkoutText}>Finish Workout</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ 
        title: 'Workout History',
        headerRight: () => (
          <View style={styles.headerButtonsContainer}>
            {editMode ? (
              <>
                <TouchableOpacity 
                  style={[styles.headerButton, styles.selectAllButton]}
                  onPress={selectAllWorkouts}
                >
                  <Text style={[styles.headerButtonText, { color: colors.primary }]}>
                    {selectedWorkouts.length === workouts.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.headerButton, { marginLeft: 8 }]}
                  onPress={toggleEditMode}
                >
                  <Text style={[styles.headerButtonText, { color: colors.primary }]}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              workouts.length > 0 && (
                <TouchableOpacity 
                  style={styles.headerButton}
                  onPress={toggleEditMode}
                >
                  <Text style={[styles.headerButtonText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        ) 
      }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Workout History</Text>
        </View>

        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderWorkoutItem}
          contentContainerStyle={styles.workoutsList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: `${colors.primary}15` }]}>
                <FontAwesome5 name="history" size={32} color={colors.primary} style={{ opacity: 0.8 }} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Workouts Yet</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                Start tracking your workouts to see your progress here.
              </Text>
            </View>
          }
        />
        
        {/* Edit Mode Actions */}
        {editMode && workouts.length > 0 && (
          <View style={[styles.editModeActions, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[
                styles.editModeButton,
                { opacity: selectedWorkouts.length === 0 ? 0.5 : 1 }
              ]}
              onPress={() => {
                if (selectedWorkouts.length > 0) {
                  setWorkoutToDelete(null);
                  setDeleteConfirmationVisible(true);
                }
              }}
              disabled={selectedWorkouts.length === 0 || isDeleting}
            >
              <LinearGradient
                colors={['#FF6584', '#FF4D67']}
                style={styles.editModeButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <FontAwesome name="trash" size={18} color="white" />
                <Text style={styles.editModeButtonText}>
                  Delete Selected ({selectedWorkouts.length})
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.editModeButton}
              onPress={() => setDeleteAllConfirmationVisible(true)}
              disabled={isDeleting || workouts.length === 0}
            >
              <LinearGradient
                colors={['#FF4D67', '#E53E3E']}
                style={styles.editModeButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <FontAwesome name="trash" size={18} color="white" />
                <Text style={styles.editModeButtonText}>
                  Delete All History
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Single Workout Delete Confirmation */}
        <ConfirmationModal
          visible={deleteConfirmationVisible}
          title={workoutToDelete ? "Delete Workout" : "Delete Selected Workouts"}
          message={workoutToDelete 
            ? "Are you sure you want to delete this workout? This action cannot be undone."
            : `Are you sure you want to delete ${selectedWorkouts.length} selected workout${selectedWorkouts.length !== 1 ? 's' : ''}? This action cannot be undone.`
          }
          confirmText="Delete"
          cancelText="Cancel"
          confirmStyle="destructive"
          icon="trash-alt"
          onConfirm={confirmDeleteWorkout}
          onCancel={() => {
            setDeleteConfirmationVisible(false);
            setWorkoutToDelete(null);
          }}
        />
        
        {/* Delete All Confirmation */}
        <ConfirmationModal
          visible={deleteAllConfirmationVisible}
          title="Delete All Workout History"
          message="Are you sure you want to delete your entire workout history? This action cannot be undone and will remove all your workout data permanently."
          confirmText="Delete All"
          cancelText="Cancel"
          confirmStyle="destructive"
          icon="exclamation-triangle"
          onConfirm={confirmDeleteAllWorkouts}
          onCancel={() => {
            setDeleteAllConfirmationVisible(false);
          }}
        />
      </View>
    </>
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
  headerButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  headerButton: {
    padding: 8,
  },
  selectAllButton: {
    marginRight: 8,
  },
  headerButtonText: {
    fontSize: 16,
    fontWeight: '500',
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
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workoutHeaderWithSelection: {
    marginLeft: 32,
  },
  selectionIndicator: {
    position: 'absolute',
    left: 16,
    top: 20,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
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
  workoutActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandButton: {
    padding: 8,
    marginRight: 4,
  },
  deleteButton: {
    padding: 8,
  },
  deleteIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF4D67',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  workoutSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 14,
    marginLeft: 6,
  },
  divider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.6,
  },
  expandedDetails: {
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  muscleGroupsContainer: {
    marginBottom: 12,
  },
  muscleGroupsLabel: {
    fontSize: 13,
    marginBottom: 2,
  },
  muscleGroupsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  routineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routineText: {
    fontSize: 14,
    marginLeft: 6,
    fontStyle: 'italic',
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  editModeActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    flexDirection: 'column',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  editModeButton: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  editModeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    width: '100%',
  },
  editModeButtonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  resumeButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  resumeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  workoutActionsContainer: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  finishWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  finishWorkoutText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});