import React, { RefObject, useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { WorkoutExercise } from '@/hooks/useWorkoutSession';
import Colors from '@/constants/Colors';

export type GroupingType = 'muscle' | 'category';

export interface GroupedExerciseListProps {
  exercises: WorkoutExercise[];
  groupingType: GroupingType;
  renderExerciseItem: (params: { item: WorkoutExercise; index: number; muscleColor?: string }) => React.ReactNode;
  getMuscleColor?: (muscle: string) => string;
  onMeasureGroupPosition?: (groupKey: string, y: number) => void;
  colors: typeof Colors[keyof typeof Colors];
  scrollViewRef?: React.MutableRefObject<ScrollView | null>;
}

export const GroupedExerciseList: React.FC<GroupedExerciseListProps> = ({
  exercises,
  groupingType,
  renderExerciseItem,
  getMuscleColor,
  onMeasureGroupPosition,
  colors,
  scrollViewRef,
}) => {
  // State to track which groups are collapsed
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Function to toggle group collapse state
  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  // Create the groups based on groupingType
  const groups = React.useMemo(() => {
    const groupedItems: Record<string, WorkoutExercise[]> = {};
    
    exercises.forEach(exercise => {
      const groupKey = groupingType === 'muscle' 
        ? exercise.primary_muscle || 'Other'
        : exercise.category || 'Other';
        
      if (!groupedItems[groupKey]) {
        groupedItems[groupKey] = [];
      }
      
      groupedItems[groupKey].push({
        ...exercise,
        originalIndex: exercises.findIndex(e => e.routine_exercise_id === exercise.routine_exercise_id)
      });
    });
    
    return groupedItems;
  }, [exercises, groupingType]);

  return (
    <ScrollView 
      ref={scrollViewRef}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {Object.entries(groups).map(([groupKey, groupExercises]) => (
        <View 
          key={`${groupingType}-${groupKey}`}
          style={styles.groupContainer}
          onLayout={onMeasureGroupPosition ? 
            (event) => onMeasureGroupPosition(groupKey, event.nativeEvent.layout.y) : 
            undefined
          }
        >
          <TouchableOpacity 
            style={[
              styles.groupHeader, 
              { backgroundColor: colors.card },
              groupingType === 'muscle' && getMuscleColor ? {
                borderLeftColor: getMuscleColor(groupKey),
                borderLeftWidth: 4
              } : {}
            ]}
            onPress={() => toggleGroupCollapse(groupKey)}
            activeOpacity={0.7}
          >
            <View style={styles.groupHeaderContent}>
              <View style={styles.groupHeaderText}>
                {groupingType === 'muscle' && getMuscleColor && (
                  <View 
                    style={[
                      styles.muscleColorIndicator, 
                      { backgroundColor: getMuscleColor(groupKey) }
                    ]} 
                  />
                )}
                <Text style={[styles.groupTitle, { color: colors.text }]}>
                  {groupKey}
                </Text>
                <Text style={[styles.groupCount, { color: colors.subtext }]}>
                  {groupExercises.length} exercise{groupExercises.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <FontAwesome 
                name={collapsedGroups.has(groupKey) ? 'chevron-right' : 'chevron-down'}
                size={14}
                color={colors.text}
                style={styles.chevronIcon}
              />
            </View>
          </TouchableOpacity>
          
          {!collapsedGroups.has(groupKey) && groupExercises.map((exercise, index) => (
            <View key={`${exercise.routine_exercise_id}`}>
              {renderExerciseItem({ 
                item: exercise, 
                index,
                muscleColor: groupingType === 'muscle' && getMuscleColor ? 
                  getMuscleColor(groupKey) : undefined
              })}
            </View>
          ))}
        </View>
      ))}
      
      {/* Bottom padding to ensure last item is visible above any bottom UI */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100, // Extra padding for bottom UI
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupHeader: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  groupHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupHeaderText: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  muscleColorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  groupCount: {
    fontSize: 12,
    marginLeft: 8,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  bottomPadding: {
    height: 50,
  },
});