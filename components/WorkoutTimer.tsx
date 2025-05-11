import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';

type WorkoutTimerProps = {
  workoutStarted: boolean;
  workoutStartTime: React.MutableRefObject<number | null>;
  onDurationChange?: (duration: number) => void;
};

export default function WorkoutTimer({ 
  workoutStarted, 
  workoutStartTime,
  onDurationChange 
}: WorkoutTimerProps) {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme as keyof typeof Colors];
  
  const [workoutDuration, setWorkoutDuration] = useState(0);
  const timerAnimation = useRef(new Animated.Value(0)).current;
  const workoutTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation pulse for timer
  useEffect(() => {
    if (workoutStarted) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(timerAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(timerAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      timerAnimation.setValue(0);
    }
    
    return () => {
      timerAnimation.setValue(0);
    };
  }, [workoutStarted]);

  // Update workout duration every second
  useEffect(() => {
    // Clear any existing timer
    if (workoutTimer.current) {
      clearInterval(workoutTimer.current);
      workoutTimer.current = null;
    }
    
    if (workoutStarted) {
      // Initialize the workout start time if it hasn't been set
      if (!workoutStartTime.current) {
        workoutStartTime.current = Date.now();
      }
      
      const calculateElapsedTime = () => {
        if (!workoutStartTime.current) return;
        
        const elapsed = Math.floor((Date.now() - workoutStartTime.current) / 1000);
        setWorkoutDuration(elapsed);
        
        // Notify parent component of duration change if callback is provided
        if (onDurationChange) {
          onDurationChange(elapsed);
        }
      };
      
      // Initial calculation immediately
      calculateElapsedTime();
      
      // Then set up interval for updates
      workoutTimer.current = setInterval(calculateElapsedTime, 1000);
    }
    
    return () => {
      if (workoutTimer.current) {
        clearInterval(workoutTimer.current);
        workoutTimer.current = null;
      }
    };
  }, [workoutStarted, onDurationChange]);

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours > 0 ? `${hours}:` : ''}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.timerContainer}>
      <Animated.View style={[
        styles.timerIcon,
        { 
          backgroundColor: colors.primary + '22',
          opacity: timerAnimation.interpolate({
            inputRange: [0, 1],
            outputRange: [0.6, 1]
          })
        }
      ]}>
        <FontAwesome name="clock-o" size={16} color={colors.primary} />
      </Animated.View>
      <Text style={[styles.workoutDuration, { color: colors.text }]}>
        {formatDuration(workoutDuration)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  workoutDuration: {
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 