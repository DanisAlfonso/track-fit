import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { useWorkout } from '@/context/WorkoutContext';

export default function ActiveWorkoutIndicator() {
  const router = useRouter();
  const { activeWorkout } = useWorkout();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get screen dimensions to position properly
  const { height } = Dimensions.get('window');
  const tabBarHeight = 50; // Approximate tab bar height
  
  // Pulsing animation effect
  useEffect(() => {
    if (activeWorkout.isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
    
    return () => {
      pulseAnim.setValue(0);
    };
  }, [activeWorkout.isActive]);

  // Timer effect to update elapsed time
  useEffect(() => {
    if (activeWorkout.id && activeWorkout.startTime) {
      // Immediately calculate current time
      updateElapsedTime();
      
      // Set up timer to update every second
      timerRef.current = setInterval(updateElapsedTime, 1000);
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeWorkout.id, activeWorkout.startTime]);
  
  // Function to update the elapsed time
  const updateElapsedTime = () => {
    if (!activeWorkout.startTime) {
      setElapsedTime('00:00');
      return;
    }
    
    const elapsed = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  };

  // Only show the indicator when the workout exists AND is NOT active
  // This means it only appears when minimized
  if (!activeWorkout.id || activeWorkout.isActive) return null;

  // Direct navigation to workout/start with the correct ID
  const navigateToWorkout = () => {
    if (activeWorkout.id) {
      router.push({
        pathname: "/workout/start",
        params: { workoutId: activeWorkout.id }
      });
    }
  };

  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        { 
          backgroundColor: colors.card,
          bottom: tabBarHeight + 8, // Position above tab bar
        }
      ]}
      onPress={navigateToWorkout}
      activeOpacity={0.8}
    >
      <View style={styles.contentContainer}>
        <View style={styles.workoutInfo}>
          <Text style={[styles.workoutTitle, { color: colors.text }]}>
            {activeWorkout.routineName}
          </Text>
          <View style={styles.timerContainer}>
            <Animated.View style={[
              styles.timerDot,
              { 
                backgroundColor: activeWorkout.isActive ? colors.primary : colors.subtext,
                opacity: activeWorkout.isActive ? pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1]
                }) : 0.5
              }
            ]} />
            <Text style={[styles.timerText, { color: colors.subtext }]}>
              {elapsedTime}
            </Text>
          </View>
        </View>
        <View style={styles.actionContainer}>
          <Text style={[styles.actionText, { color: colors.primary }]}>
            Continue
          </Text>
          <FontAwesome name="chevron-right" size={14} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 998, // Below modals but above content
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutInfo: {
    flex: 1,
  },
  workoutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  timerText: {
    fontSize: 14,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
}); 