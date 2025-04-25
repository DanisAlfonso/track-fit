import { useState, useRef, useEffect } from 'react';
import { StyleSheet, FlatList, View, Text, TouchableOpacity, ActivityIndicator, Platform, Alert, ActionSheetIOS, Modal, Pressable, Animated, Dimensions, TouchableWithoutFeedback, Easing } from 'react-native';
import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { BlurView } from 'expo-blur';
import { useToast } from '@/context/ToastContext';

type Routine = {
  id: number;
  name: string;
  description: string | null;
  created_at: number;
  exerciseCount?: number;
  scheduledDays?: string; // Comma-separated list of scheduled days
};

// Custom context menu component with blur effect
interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  routine: Routine | null;
  onViewDetails: (id: number) => void;
  onEdit: (id: number) => void;
  onShare: (id: number) => void;
  onDelete: (id: number) => void;
  colors: any;
  theme: string;
}

const ContextMenu = ({ 
  visible, 
  onClose, 
  routine, 
  onViewDetails, 
  onEdit, 
  onShare, 
  onDelete,
  colors,
  theme
}: ContextMenuProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.quad)
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic)
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
          easing: Easing.in(Easing.quad)
        }),
        Animated.timing(scale, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.in(Easing.cubic)
        })
      ]).start();
    }
  }, [visible]);
  
  if (!routine) return null;
  
  const menuItem = (icon: string, label: string, action: () => void, textColor: string, isDestructive = false) => (
    <TouchableOpacity 
      style={[
        styles.menuItem, 
        isDestructive && styles.destructiveItem
      ]}
      onPress={() => {
        onClose();
        setTimeout(action, 50);
      }}
      activeOpacity={0.7}
    >
      <FontAwesome5 
        name={icon} 
        size={20} 
        color={isDestructive ? colors.error : textColor} 
        style={styles.menuItemIcon}
      />
      <Text 
        style={[
          styles.menuItemText, 
          { color: isDestructive ? colors.error : textColor }
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
  
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[
              styles.menuOverlay,
              { opacity }
            ]}
          >
            <TouchableWithoutFeedback>
              <Animated.View 
                style={[
                  styles.menuContainer, 
                  { 
                    transform: [{ scale }],
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: theme === 'dark' ? 0.5 : 0.3,
                    shadowRadius: 12,
                    elevation: 8,
                  }
                ]}
              >
                {/* Solid background with proper corners */}
                <View style={[
                  StyleSheet.absoluteFill, 
                  { 
                    backgroundColor: theme === 'dark' ? 'rgba(25,25,30,0.97)' : 'rgba(245,245,250,0.97)', 
                    borderRadius: 16 
                  }
                ]} />
                
                {/* BlurView for additional effect */}
                <BlurView 
                  style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
                  intensity={theme === 'dark' ? 60 : 75}
                  tint={theme === 'dark' ? 'dark' : 'light'}
                />
                
                {/* Header section with icon and title */}
                <View style={[styles.menuHeader, { borderBottomColor: theme === 'dark' ? 'rgba(127,127,127,0.2)' : 'rgba(127,127,127,0.15)' }]}>
                  <View style={styles.routineIconContainer}>
                    <LinearGradient
                      colors={[colors.primary, colors.secondary]}
                      style={styles.menuRoutineIcon}
                    >
                      <FontAwesome5 name="dumbbell" size={24} color="white" />
                    </LinearGradient>
                  </View>
                  <Text style={[styles.menuTitle, { color: colors.text }]} numberOfLines={1}>
                    {routine.name}
                  </Text>
                  <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                    <MaterialIcons name="close" size={22} color={colors.subtext} />
                  </TouchableOpacity>
                </View>
                
                {/* Menu items with uniform styling */}
                <View style={styles.menuContent}>
                  {menuItem('eye', 'View Details', () => onViewDetails(routine.id), colors.primary)}
                  {menuItem('edit', 'Edit Routine', () => onEdit(routine.id), colors.primary)}
                  {menuItem('share-alt', 'Share Routine', () => onShare(routine.id), colors.primary)}
                  {menuItem('trash-alt', 'Delete Routine', () => onDelete(routine.id), colors.error, true)}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default function RoutinesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const { showToast } = useToast();

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [activeRoutineId, setActiveRoutineId] = useState<number | null>(null);
  
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadRoutines();
    }, [])
  );

  const loadRoutines = async () => {
    setLoading(true);
    try {
      const db = await getDatabase();
      const results = await db.getAllAsync<Routine>(`
        SELECT 
          r.id, 
          r.name, 
          r.description, 
          r.created_at, 
          (SELECT COUNT(*) FROM routine_exercises WHERE routine_id = r.id) as exerciseCount,
          (
            SELECT GROUP_CONCAT(CASE ws.day_of_week 
              WHEN 0 THEN 'Sun'
              WHEN 1 THEN 'Mon'
              WHEN 2 THEN 'Tue'
              WHEN 3 THEN 'Wed'
              WHEN 4 THEN 'Thu'
              WHEN 5 THEN 'Fri'
              WHEN 6 THEN 'Sat'
            END, ', ')
            FROM weekly_schedule ws
            WHERE ws.routine_id = r.id
          ) as scheduledDays
        FROM routines r
        ORDER BY r.created_at DESC
      `);
      
      setRoutines(results);
    } catch (error) {
      console.error('Error loading routines:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const navigateToCreateRoutine = () => {
    router.push('/routine/create');
  };

  const navigateToRoutineDetail = (routineId: number) => {
    router.push(`/routine/${routineId}`);
  };

  const editRoutine = (routineId: number) => {
    router.push(`/routine/edit/${routineId}`);
  };
  
  const shareRoutine = async (routineId: number) => {
    setIsSharing(true);
    setActiveRoutineId(routineId);
    
    try {
      const db = await getDatabase();
      
      // Get routine details with proper typing
      type RoutineDetail = {
        id: number;
        name: string;
        description: string | null;
        created_at: number;
      };
      
      type ExerciseDetail = {
        id: number;
        name: string;
        sets: number;
        exercise_order: number;
        exercise_id: number;
        primary_muscle: string;
        category: string;
      };
      
      const routine = await db.getFirstAsync<RoutineDetail>(
        'SELECT * FROM routines WHERE id = ?',
        [routineId]
      );
      
      if (!routine) {
        throw new Error('Routine not found');
      }
      
      // Get exercises for this routine
      const exercises = await db.getAllAsync<ExerciseDetail>(
        `SELECT re.id, e.name, re.sets, re.order_num as exercise_order, e.id as exercise_id,
         e.primary_muscle, e.category
         FROM routine_exercises re
         JOIN exercises e ON re.exercise_id = e.id
         WHERE re.routine_id = ?
         ORDER BY re.order_num`,
        [routineId]
      );
      
      // Create an object with all the routine information
      const routineData = {
        name: routine.name,
        description: routine.description,
        created_at: routine.created_at,
        exercises: exercises.map(exercise => ({
          name: exercise.name,
          sets: exercise.sets,
          primary_muscle: exercise.primary_muscle,
          category: exercise.category
        }))
      };
      
      const jsonData = JSON.stringify(routineData, null, 2);
      
      const sanitizedName = routine.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const fileName = `${sanitizedName}_routine.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, jsonData);
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: `Share ${routine.name} Routine`,
          UTI: 'public.json'
        });
      } else {
        showToast('Sharing is not available on this device', 'error');
      }
    } catch (error) {
      console.error('Error sharing routine:', error);
      showToast('Failed to share routine', 'error');
    } finally {
      setIsSharing(false);
      setActiveRoutineId(null);
    }
  };
  
  const deleteRoutine = async (routineId: number) => {
    const routineToDelete = routines.find(r => r.id === routineId);
    if (!routineToDelete) return;
    
    // Use a toast with confirmation action
    showToast(
      `Delete "${routineToDelete.name}"?`,
      'info',
      10000, // Longer duration since this is an important decision
      {
        label: 'Delete',
        onPress: async () => {
          setIsDeleting(true);
          setActiveRoutineId(routineId);
          
          try {
            const db = await getDatabase();
            await db.runAsync('DELETE FROM routines WHERE id = ?', [routineId]);
            
            loadRoutines();
            
            showToast('Routine deleted successfully', 'success');
          } catch (error) {
            console.error('Error deleting routine:', error);
            showToast('Failed to delete routine', 'error');
          } finally {
            setIsDeleting(false);
            setActiveRoutineId(null);
          }
        }
      }
    );
  };
  
  const showRoutineOptions = (routine: Routine) => {
    console.log(`Showing options for routine: ${routine.name}`);
    setSelectedRoutine(routine);
    setContextMenuVisible(true);
  };
  
  const closeContextMenu = () => {
    setContextMenuVisible(false);
  };
  
  const handleLongPress = (routine: Routine) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    
    longPressTimeoutRef.current = setTimeout(() => {
      showRoutineOptions(routine);
    }, 10);
  };

  const renderRoutineItem = ({ item }: { item: Routine }) => {
    const isActive = activeRoutineId === item.id;
    
    return (
      <TouchableOpacity 
        style={[
          styles.routineCard, 
          { 
            backgroundColor: colors.card,
            opacity: isActive ? 0.7 : 1 
          }
        ]}
        onPress={() => navigateToRoutineDetail(item.id)}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
        activeOpacity={0.7}
        disabled={isDeleting || isSharing}
      >
        <View style={styles.routineIconContainer}>
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.routineIcon}
          >
            <FontAwesome5 name="dumbbell" size={22} color="white" />
          </LinearGradient>
        </View>
        
        <View style={styles.routineContent}>
          <Text style={[styles.routineName, { color: colors.text }]}>
            {item.name}
            {isActive && isSharing && ' (Sharing...)'}
            {isActive && isDeleting && ' (Deleting...)'}
          </Text>
          {item.description && (
            <Text style={[styles.routineDescription, { color: colors.subtext }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.routineFooter}>
            <View style={styles.routineMetaItem}>
              <FontAwesome5 name="list" size={14} color={colors.subtext} style={styles.metaIcon} />
              <Text style={[styles.routineMeta, { color: colors.subtext }]}>
                {item.exerciseCount} exercise{item.exerciseCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.routineMetaItem}>
              <FontAwesome5 name="calendar-alt" size={14} color={colors.subtext} style={styles.metaIcon} />
              <Text style={[styles.routineMeta, { color: colors.subtext }]}>
                {formatDate(item.created_at)}
              </Text>
            </View>
          </View>
          
          {item.scheduledDays && (
            <View style={[styles.scheduledDaysContainer, { borderTopColor: colors.border }]}>
              <FontAwesome5 name="calendar-week" size={14} color={colors.primary} style={styles.metaIcon} />
              <Text style={[styles.scheduledDaysText, { color: colors.primary }]}>
                Scheduled: {item.scheduledDays}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.chevronContainer}>
          <Ionicons name="chevron-forward" size={24} color={colors.subtext} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { color: colors.text }]}>My Routines</Text>
        
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.scheduleButton, { backgroundColor: colors.card }]}
            onPress={() => router.push('/weekly-schedule')}
          >
            <FontAwesome5 name="calendar-alt" size={16} color={colors.primary} />
            <Text style={[styles.scheduleButtonText, { color: colors.primary }]} numberOfLines={1}>Schedule</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.addButton}
            onPress={navigateToCreateRoutine}
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              style={styles.addButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <FontAwesome5 name="plus" size={14} color="white" />
              <Text style={styles.addButtonText} numberOfLines={1}>New Routine</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading routines...</Text>
        </View>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRoutineItem}
          contentContainerStyle={styles.routinesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
                <FontAwesome5 name="dumbbell" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Routines Yet</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                Click the "New Routine" button to create your first workout routine
              </Text>
            </View>
          }
        />
      )}
      
      {/* Beautiful custom context menu with blur effect */}
      <ContextMenu
        visible={contextMenuVisible}
        onClose={closeContextMenu}
        routine={selectedRoutine}
        onViewDetails={navigateToRoutineDetail}
        onEdit={editRoutine}
        onShare={shareRoutine}
        onDelete={deleteRoutine}
        colors={colors}
        theme={currentTheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerContainer: {
    marginBottom: 24,
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
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flex: 1,
    maxWidth: '48%',
  },
  scheduleButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
    flexShrink: 1,
  },
  addButton: {
    overflow: 'hidden',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    flex: 1,
    maxWidth: '48%',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
    flexShrink: 1,
  },
  routinesList: {
    paddingBottom: 20,
  },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 110,
  },
  routineIconContainer: {
    marginRight: 20,
  },
  routineIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineContent: {
    flex: 1,
    paddingVertical: 4,
  },
  routineName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  routineDescription: {
    fontSize: 15,
    marginBottom: 12,
    lineHeight: 20,
  },
  routineFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  routineMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  metaIcon: {
    marginRight: 6,
  },
  routineMeta: {
    fontSize: 14,
  },
  chevronContainer: {
    marginLeft: 8,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  scheduledDaysContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  scheduledDaysText: {
    fontSize: 14,
    fontWeight: '500',
  },
  longPressHint: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  longPressHintText: {
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(127,127,127,0.2)',
    backgroundColor: 'transparent',
  },
  menuRoutineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  closeButton: {
    padding: 6,
  },
  menuContent: {
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(127,127,127,0.1)',
    backgroundColor: 'transparent',
  },
  menuItemIcon: {
    width: 30,
    textAlign: 'center',
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveItem: {
    backgroundColor: 'rgba(255,59,48,0.1)',
  },
}); 