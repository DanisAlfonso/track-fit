import React from 'react';
import { FlatList, View, StyleSheet, ListRenderItemInfo } from 'react-native';
import { WorkoutExercise } from '@/hooks/useWorkoutSession';

interface DefaultExerciseListProps {
  exercises: WorkoutExercise[];
  renderExerciseItem: (params: { item: WorkoutExercise; index: number }) => React.ReactNode;
}

export const DefaultExerciseList: React.FC<DefaultExerciseListProps> = ({
  exercises,
  renderExerciseItem,
}) => {
  // Create a proper renderItem function for FlatList
  const renderItem = ({ item, index }: ListRenderItemInfo<WorkoutExercise>) => {
    return renderExerciseItem({ item, index }) as React.ReactElement;
  };

  return (
    <FlatList
      data={exercises}
      renderItem={renderItem}
      keyExtractor={(item) => `exercise-${item.routine_exercise_id}`}
      contentContainerStyle={styles.exerciseList}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={<View style={styles.bottomPadding} />}
    />
  );
};

const styles = StyleSheet.create({
  exerciseList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100, // Extra padding for bottom UI
  },
  bottomPadding: {
    height: 50,
  },
}); 