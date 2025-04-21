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
  
  // For button press animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
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
      // Animate button press
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.97,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        })
      ]).start();
      
      router.push({
        pathname: "/workout/start",
        params: { workoutId: activeWorkout.id }
      });
    }
  };

  return (
    <Animated.View
      style={[
        styles.container, 
        { 
          backgroundColor: colors.card,
          borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
          bottom: tabBarHeight + 8, // Position above tab bar
          transform: [{ scale: scaleAnim }],
        }
      ]}
    >
      <TouchableOpacity 
        style={styles.touchableArea}
        onPress={navigateToWorkout}
        activeOpacity={0.9}
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
                  backgroundColor: colors.primary,
                  opacity: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1]
                  })
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
            <FontAwesome name="chevron-right" size={14} color={colors.primary} style={styles.chevron} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 998, // Below modals but above content
    overflow: 'hidden',
  },
  touchableArea: {
    width: '100%',
    padding: 14,
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
    fontWeight: '700',
    marginBottom: 4,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  chevron: {
    marginLeft: 2,
  },
}); 