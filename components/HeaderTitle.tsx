import React from 'react';
import { View, StyleSheet } from 'react-native';
import WorkoutTimer from '@/components/WorkoutTimer';

interface HeaderTitleProps {
  workoutStarted: boolean;
  workoutStartTime: React.MutableRefObject<number | null>;
  onDurationChange: (duration: number) => void;
  renderCircularProgress: React.ReactNode;
}

export const HeaderTitle: React.FC<HeaderTitleProps> = ({
  workoutStarted,
  workoutStartTime,
  onDurationChange,
  renderCircularProgress,
}) => {
  return (
    <View style={styles.headerTitleContainer}>
      <WorkoutTimer
        workoutStarted={workoutStarted}
        workoutStartTime={workoutStartTime}
        onDurationChange={onDurationChange}
      />
      {/* Conditionally render circular progress */}
      {workoutStarted && renderCircularProgress}
    </View>
  );
};

const styles = StyleSheet.create({
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // Remove flex: 1 and marginRight, let React Navigation handle centering
  },
}); 