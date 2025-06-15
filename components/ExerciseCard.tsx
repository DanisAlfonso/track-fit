import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, TextInput, Animated, Easing, PanResponder, Platform, Vibration } from 'react-native';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Progress from 'react-native-progress';
import Colors from '@/constants/Colors';
import { WeightUnit } from '@/app/profile';
import { useTheme } from '@/context/ThemeContext';
import { kgToLb } from '@/app/profile';

// Define necessary types
type Set = {
  id?: number;
  set_number: number;
  reps: number;
  weight: number;
  rest_time: number;
  completed: boolean;
  training_type?: 'heavy' | 'moderate' | 'light';
  notes: string;
};

type WorkoutExercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  completedSets: number;
  exercise_order: number;
  primary_muscle: string;
  category: string;
  sets_data: Set[];
  notes: string;
  originalIndex?: number;
};

// Define props interface
interface ExerciseCardProps {
  item: WorkoutExercise;
  index: number;
  muscleColor?: string;
  workoutStarted: boolean;
  onOpenSetModal: (exerciseIndex: number, setIndex: number) => void;
  onUpdateNotes: (exerciseIndex: number, notes: string) => void;
  onAddSet: (exerciseIndex: number) => void;
  onRemoveSet: (exerciseIndex: number) => void;
  weightUnit: WeightUnit;
  showingMenu: number | null;
  onToggleMenu: (index: number | null) => void;
}

export const ExerciseCard = ({
  item,
  index,
  muscleColor,
  workoutStarted,
  onOpenSetModal,
  onUpdateNotes,
  onAddSet,
  onRemoveSet,
  weightUnit,
  showingMenu,
  onToggleMenu
}: ExerciseCardProps) => {
  const router = useRouter();
  const { theme, currentTheme } = useTheme();
  const colorScheme = currentTheme; // Use the actual current theme from context
  const colors = Colors[colorScheme];
  // State for collapsible content
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Animation values
  const collapsibleHeight = useRef(new Animated.Value(1)).current; // 1 = open, 0 = collapsed
  const rotateAnimation = useRef(new Animated.Value(0)).current; // 0 = not rotated, 1 = rotated
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  
  // Use the original index if it exists (for grouped views), otherwise use the provided index
  const exerciseIndex = item.originalIndex !== undefined ? item.originalIndex : index;
  
  // Calculate exercise completion percentage
  const totalSets = item.sets_data.length;
  const completedSets = item.sets_data.filter(set => set.completed).length;
  const progress = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  const allSetsCompleted = completedSets === totalSets && totalSets > 0;

  // Configure pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to horizontal swipes
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 50) {
          // Swipe right - expand
          setIsCollapsed(false);
        } else if (gestureState.dx < -50) {
          // Swipe left - collapse
          setIsCollapsed(true);
        }
      },
    })
  ).current;

  // Auto-collapse when all sets are completed
  useEffect(() => {
    if (allSetsCompleted && workoutStarted) {
      // Add a small delay to make it noticeable that all sets are completed
      const timeout = setTimeout(() => {
        setIsCollapsed(true);
        
        // Add a subtle "completion" animation
        Animated.sequence([
          Animated.timing(scaleAnimation, {
            toValue: 1.03,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          }),
          Animated.timing(scaleAnimation, {
            toValue: 1,
            duration: 200,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true
          })
        ]).start();
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [allSetsCompleted, workoutStarted]);
  
  // Use the muscle color if provided, otherwise use the default primary/success color
  const borderColor = allSetsCompleted 
    ? colors.success 
    : (muscleColor || colors.primary);
  
  // Rotate the collapse arrow when the card is collapsed/expanded
  const arrowRotation = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  // Trigger animations when collapsed state changes
  useEffect(() => {
    Animated.parallel([
      Animated.timing(collapsibleHeight, {
        toValue: isCollapsed ? 0 : 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      }),
      Animated.timing(rotateAnimation, {
        toValue: isCollapsed ? 1 : 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(fadeAnimation, {
        toValue: isCollapsed ? 0 : 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false
      })
    ]).start();
  }, [isCollapsed]);

  // Function to toggle collapsed state
  const toggleCollapsed = () => {
    // Add haptic feedback on toggle
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Vibration.vibrate(5); // very short vibration
    }
    setIsCollapsed(!isCollapsed);
  };

  // Use different border styles for collapsed vs expanded
  const getBorderStyles = () => {
    if (isCollapsed) {
      return {
        borderBottomWidth: 0,
        paddingBottom: 8
      };
    }
    return {
      borderBottomWidth: 1,
      paddingBottom: 16
    };
  };

  // Function to render set items with the correct exercise index
  const renderExerciseSetItem = (setItem: Set, setIndex: number) => {
    // Get training type display
    const getTrainingTypeColor = () => {
      if (!setItem.training_type) return colors.border;
      switch(setItem.training_type) {
        case 'heavy': return '#6F74DD';  // Blue/purple for heavy sets
        case 'moderate': return '#FFB300'; // Orange for moderate sets
        case 'light': return '#4CAF50';  // Green for light sets
        default: return colors.border;
      }
    };
    
    return (
      <TouchableOpacity 
        style={[
          styles.setItem, 
          { 
            backgroundColor: colors.card,
            borderColor: setItem.completed ? 
              (setItem.training_type ? getTrainingTypeColor() : '#8477EB') : 
              colors.border,
            borderWidth: 1.5,
            borderRadius: 12,
            overflow: 'hidden'
          }
        ]}
        onPress={() => {
          if (workoutStarted) {
            onOpenSetModal(exerciseIndex, setIndex);
          }
        }}
        disabled={!workoutStarted}
        activeOpacity={0.7}
      >
        {setItem.completed && (
          <LinearGradient
            colors={setItem.training_type ? 
              [getTrainingTypeColor() + '20', getTrainingTypeColor() + '10'] : 
              ['#8477EB20', '#5E72EB10']}
            style={styles.completedGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <View style={styles.setContent}>
          <View style={styles.setHeaderRow}>
            <Text style={[styles.setText, { color: colors.text }]}>
              SET {setItem.set_number}
            </Text>
            {setItem.completed && (
              <FontAwesome 
                name="check" 
                size={12} 
                color={setItem.training_type ? getTrainingTypeColor() : '#8477EB'} 
              />
            )}
          </View>
          
          {setItem.completed ? (
            <>
              <Text style={[styles.setDetail, { color: colors.text, fontWeight: '600' }]}>
                {setItem.reps} reps
              </Text>
              <Text style={[styles.setDetail, { color: colors.text }]}>
                {weightUnit === 'lb' ? `${kgToLb(setItem.weight).toFixed(1)} lb` : `${setItem.weight} kg`}
              </Text>
            </>
          ) : (
            <Text style={[styles.tapToLog, { color: colors.primary }]}>
              Tap to log
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View 
      {...panResponder.panHandlers}
      style={[
        styles.exerciseItem, 
        { 
          backgroundColor: colors.card,
          borderLeftWidth: 4,
          borderLeftColor: borderColor,
          transform: [{ scale: scaleAnimation }]
        },
        allSetsCompleted && {
          borderColor: colors.success,
          borderWidth: 0.5
        }
      ]}
    >
      {/* Add ellipsis menu in top right corner */}
      {workoutStarted && (
        <View style={styles.cardMenuContainer}>
          <TouchableOpacity
            style={styles.cardMenuButton}
            onPress={() => {
              onToggleMenu(showingMenu === exerciseIndex ? null : exerciseIndex);
            }}
          >
            <FontAwesome5 name="ellipsis-v" size={16} color={colors.text} />
          </TouchableOpacity>
          
          {showingMenu === exerciseIndex && (
            <View style={[styles.menuPopup, { backgroundColor: colors.card }]}>
              <TouchableOpacity 
                style={styles.menuOption}
                onPress={() => {
                  onToggleMenu(null);
                  onAddSet(exerciseIndex);
                }}
              >
                <FontAwesome5 name="plus" size={14} color={colors.success} style={styles.menuIcon} />
                <Text style={[styles.menuText, { color: colors.text }]}>Add Set</Text>
              </TouchableOpacity>
              
              {item.sets_data.length > 1 && (
                <TouchableOpacity 
                  style={styles.menuOption}
                  onPress={() => {
                    onToggleMenu(null);
                    onRemoveSet(exerciseIndex);
                  }}
                >
                  <FontAwesome5 name="minus" size={14} color={colors.error} style={styles.menuIcon} />
                  <Text style={[styles.menuText, { color: colors.text }]}>Remove Set</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.menuOption}
                onPress={() => {
                  onToggleMenu(null);
                  toggleCollapsed();
                }}
              >
                <FontAwesome5 
                  name={isCollapsed ? "chevron-down" : "chevron-up"} 
                  size={14} 
                  color={colors.primary} 
                  style={styles.menuIcon} 
                />
                <Text style={[styles.menuText, { color: colors.text }]}>
                  {isCollapsed ? "Expand" : "Collapse"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      
      <View style={[styles.exerciseHeader, getBorderStyles()]}>
        <TouchableOpacity 
          style={styles.exerciseTitleArea}
          onPress={toggleCollapsed}
          activeOpacity={0.7}
        >
          <View style={styles.exerciseTitleRow}>
            <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
            <Animated.View style={{ transform: [{ rotate: arrowRotation }], marginRight: 32 }}>
              <FontAwesome 
                name="chevron-down" 
                size={14} 
                color={colors.text} 
                style={styles.collapseIcon}
              />
            </Animated.View>
          </View>
          <View style={styles.exerciseProgressRow}>
            <Text style={[
              styles.exerciseSets, 
              { color: allSetsCompleted ? colors.success : colors.subtext }
            ]}>
              {completedSets}/{totalSets} sets completed
            </Text>
            {isCollapsed && allSetsCompleted && (
              <FontAwesome 
                name="check-circle" 
                size={14} 
                color={colors.success} 
                style={{ marginLeft: 6 }}
              />
            )}
          </View>
        </TouchableOpacity>
        
        <View style={styles.exerciseHeaderRight}>
          {/* Elegant circular progress indicator */}
          <View style={styles.progressCircleContainer}>
            <Progress.Circle
              size={36}
              progress={progress / 100}
              color={progress === 100 ? colors.success : borderColor}
              unfilledColor={colorScheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
              borderWidth={0}
              thickness={3}
              strokeCap="round"
              showsText={false}
            />
            <Text style={[styles.progressText, { 
              color: progress === 100 ? colors.success : borderColor,
              fontSize: 10,
              position: 'absolute'
            }]}>
              {progress.toFixed(0)}%
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.exerciseHistoryButton, { borderColor: colors.primary }]}
            onPress={() => router.push(`/exercise/history/${item.exercise_id}`)}
          >
            <FontAwesome name="history" size={16} color={colors.primary} style={styles.historyIcon} />
            <Text style={[styles.historyButtonText, { color: colors.primary }]}>History</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <Animated.View 
        style={[
          { opacity: fadeAnimation, maxHeight: collapsibleHeight.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 1000] // Use a high value that will accommodate any content
          }) }
        ]}
      >
        <View style={[styles.setsContainer, { backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)' }]}>
          <Text style={[styles.setsLabel, { color: colors.subtext }]}>Sets</Text>
          
          <FlatList
            data={item.sets_data}
            renderItem={({ item: setItem, index: setIndex }) => {
              return renderExerciseSetItem(setItem, setIndex);
            }}
            keyExtractor={(set) => `set-${set.set_number}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.setsList}
            contentContainerStyle={styles.setsListContent}
          />
        </View>

        <View style={styles.exerciseNotes}>
          <Text style={[styles.notesLabel, { color: colors.subtext }]}>Exercise Notes</Text>
          <TextInput
            style={[styles.notesInput, { 
              color: colors.text, 
              borderColor: colors.border,
              backgroundColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'
            }]}
            placeholder="Add notes for this exercise..."
            placeholderTextColor={colors.subtext}
            value={item.notes}
            onChangeText={(text) => onUpdateNotes(exerciseIndex, text)}
            multiline
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  exerciseItem: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  exerciseTitleArea: {
    marginBottom: 8,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  exerciseName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    flex: 1,
  },
  exerciseSets: {
    fontSize: 14,
    fontWeight: '500',
  },
  collapseIcon: {
    marginLeft: 8,
  },
  exerciseHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  progressCircleContainer: {
    width: 36,
    height: 36,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 10,
    position: 'absolute',
  },
  setsContainer: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  setsLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  setsList: {
    marginBottom: 8,
  },
  setsListContent: {
    paddingRight: 16,
  },
  setItem: {
    borderRadius: 12,
    marginRight: 10,
    width: 100,
    height: 85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  completedGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  setContent: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  setHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  setText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  setDetail: {
    fontSize: 13,
    marginBottom: 2,
  },
  tapToLog: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  exerciseNotes: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 40,
    fontSize: 15,
  },
  exerciseHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  historyIcon: {
    marginRight: 6,
  },
  historyButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  cardMenuContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  cardMenuButton: {
    padding: 8,
    backgroundColor: 'transparent',
  },
  menuPopup: {
    position: 'absolute',
    top: 35,
    right: 0,
    width: 150,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  menuIcon: {
    marginRight: 10,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '500',
  },
});