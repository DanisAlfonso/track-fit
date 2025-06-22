import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  useColorScheme
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDatabase } from '@/utils/database';
import { format } from 'date-fns';

const { height, width } = Dimensions.get('window');

interface RoutineBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  routineId: number | null;
  date: Date | null;
}

interface Exercise {
  id: number;
  name: string;
  sets: number;
  primary_muscle: string;
  category: string;
  instructions?: string;
}

interface RoutineDetail {
  id: number;
  name: string;
  description: string;
  exercises: Exercise[];
}

export const RoutineBottomSheet: React.FC<RoutineBottomSheetProps> = ({
  visible,
  onClose,
  routineId,
  date
}) => {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const insets = useSafeAreaInsets();
  
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(height)).current;
  const [loading, setLoading] = useState(true);
  const [routineDetail, setRoutineDetail] = useState<RoutineDetail | null>(null);

  useEffect(() => {
    if (visible) {
      loadRoutineData();
      // Show animation with spring for smooth entrance
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            tension: 65,
            friction: 11,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const loadRoutineData = async () => {
    if (!routineId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const db = await getDatabase();
      
      // Get routine details
      const routine = await db.getFirstAsync(`
        SELECT id, name, description
        FROM routines
        WHERE id = ?
      `, [routineId]) as { id: number; name: string; description: string } | null;

      if (!routine) {
        setRoutineDetail(null);
        setLoading(false);
        return;
      }

      // Get exercises for this routine
      const exercises = await db.getAllAsync(`
        SELECT 
          e.id,
          e.name,
          re.sets,
          e.primary_muscle,
          e.category,
          e.instructions
        FROM routine_exercises re
        JOIN exercises e ON re.exercise_id = e.id
        WHERE re.routine_id = ?
        ORDER BY re.order_num
      `, [routineId]) as Exercise[];

      setRoutineDetail({
        ...routine,
        exercises
      });
    } catch (error) {
      console.error('Error loading routine data:', error);
      setRoutineDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const getMuscleGroupColor = (muscle: string): string => {
    const muscleColors: { [key: string]: string } = {
      'chest': '#FF6B6B',
      'back': '#4ECDC4',
      'shoulders': '#45B7D1',
      'arms': '#96CEB4',
      'legs': '#FFEAA7',
      'core': '#DDA0DD',
      'cardio': '#FF7675',
      'full body': '#74B9FF'
    };
    return muscleColors[muscle.toLowerCase()] || '#6C5CE7';
  };

  const formatDate = (date: Date): string => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return format(date, 'EEEE, MMM d, yyyy');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading routine...</Text>
        </View>
      );
    }

    if (!routineDetail) {
      return (
        <View style={styles.emptyState}>
          <FontAwesome5 name="exclamation-triangle" size={48} color={colors.subtext} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Routine Not Found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.subtext }]}>Unable to load routine details</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
        {/* Routine Info */}
        <View style={styles.routineInfoCard}>
          <Text style={[styles.routineTitle, { color: colors.text }]}>{routineDetail.name}</Text>
          {routineDetail.description && (
            <Text style={[styles.routineDescription, { color: colors.subtext }]}>{routineDetail.description}</Text>
          )}
          <View style={styles.routineStats}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{routineDetail.exercises.length}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Exercises</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {routineDetail.exercises.reduce((total, ex) => total + ex.sets, 0)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Total Sets</Text>
            </View>
          </View>
        </View>

        {/* Exercises List */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Exercises</Text>
        {routineDetail.exercises.map((exercise, index) => (
          <View key={exercise.id} style={[styles.exerciseItem, { backgroundColor: colors.card }]}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseInfo}>
                <Text style={[styles.exerciseName, { color: colors.text }]}>{exercise.name}</Text>
                <View style={styles.exerciseMeta}>
                  <View style={[
                    styles.muscleTag,
                    { backgroundColor: getMuscleGroupColor(exercise.primary_muscle) + '20' }
                  ]}>
                    <Text style={[
                      styles.muscleTagText,
                      { color: getMuscleGroupColor(exercise.primary_muscle) }
                    ]}>
                      {exercise.primary_muscle}
                    </Text>
                  </View>
                  <Text style={[styles.categoryText, { color: colors.subtext }]}>{exercise.category}</Text>
                </View>
              </View>
              <View style={styles.exerciseStats}>
                <Text style={[styles.setsText, { color: colors.primary }]}>{exercise.sets} sets</Text>
              </View>
            </View>
            {exercise.instructions && (
              <Text style={[styles.exerciseInstructions, { color: colors.subtext }]} numberOfLines={2}>
                {exercise.instructions}
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    );
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        {/* Backdrop with blur */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity }
            ]}
          >
            <BlurView 
              intensity={currentTheme === 'dark' ? 30 : 25}
              tint={currentTheme === 'dark' ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </TouchableWithoutFeedback>
        
        {/* Bottom sheet */}
        <Animated.View
          style={[
            styles.container,
            {
              backgroundColor: colors.background,
              borderColor: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              transform: [{ translateY: sheetTranslateY }],
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <LinearGradient
              colors={['#F72585', '#B5179E']}
              style={styles.headerIcon}
            >
              <FontAwesome5 name="dumbbell" size={20} color="white" />
            </LinearGradient>
            
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Workout Details</Text>
              <Text style={[styles.headerValue, { color: colors.primary }]}>
                {date ? formatDate(date) : 'Routine'}
              </Text>
            </View>
            
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <FontAwesome5 name="times" size={20} color={colors.subtext} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {renderContent()}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    height: height * 0.8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  contentScroll: {
    flex: 1,
    padding: 20,
  },
  routineInfoCard: {
    marginBottom: 24,
  },
  routineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  routineDescription: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  routineStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  exerciseItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseInfo: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  muscleTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  muscleTagText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  categoryText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  exerciseStats: {
    alignItems: 'flex-end',
  },
  setsText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  exerciseInstructions: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});