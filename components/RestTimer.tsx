import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Dimensions, Vibration, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { useColorScheme } from 'react-native';
import { useToast } from '@/context/ToastContext';

const { width } = Dimensions.get('window');

interface RestTimerProps {
  visible: boolean;
  duration: number;
  onComplete: () => void;
  onSkip: () => void;
  onAddTime: (seconds: number) => void;
  exerciseName?: string;
}

export const RestTimer: React.FC<RestTimerProps> = ({
  visible,
  duration,
  onComplete,
  onSkip,
  onAddTime,
  exerciseName
}) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const { showToast } = useToast();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const isDark = currentTheme === 'dark';

  // Animation values
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(0.9)).current;
  const timeoutFlash = useRef(new Animated.Value(0)).current;

  // Timer state
  const [remainingTime, setRemainingTime] = useState(duration);
  const [progress, setProgress] = useState(0);
  const [initialDuration, setInitialDuration] = useState(duration);
  const animationFrameRef = useRef<number | null>(null);
  const restStartTimeRef = useRef<number>(0);
  const restEndTimeRef = useRef<number>(0);

  // Initialize timer when visible changes
  useEffect(() => {
    if (visible) {
      // Calculate exact start and end times
      const now = Date.now();
      restStartTimeRef.current = now;
      restEndTimeRef.current = now + (duration * 1000);

      // Reset state
      setRemainingTime(duration);
      setInitialDuration(duration);
      setProgress(0);
      timeoutFlash.setValue(0);

      // Animate timer in
      Animated.parallel([
        Animated.timing(timerOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(timerScale, {
          toValue: 1,
          tension: 65,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Start the animation frame loop
      updateRestTimer();
    } else {
      // Animate timer out
      Animated.parallel([
        Animated.timing(timerOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(timerScale, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [visible, duration]);

  // Update rest timer using animation frames
  const updateRestTimer = () => {
    const now = Date.now();

    // If time is up, complete the rest
    if (now >= restEndTimeRef.current) {
      setRemainingTime(0);
      setProgress(1);
      notifyRestComplete();
      return;
    }

    // Calculate remaining time and progress precisely
    const totalDuration = restEndTimeRef.current - restStartTimeRef.current;
    const remaining = restEndTimeRef.current - now;
    const secondsRemaining = Math.ceil(remaining / 1000);
    const calculatedProgress = 1 - (remaining / totalDuration);

    // Update state
    setRemainingTime(secondsRemaining);
    setProgress(calculatedProgress);

    // Vibrate at specific intervals
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const vibrationThresholds = [10, 5, 3, 2, 1];
      if (vibrationThresholds.includes(secondsRemaining)) {
        Vibration.vibrate(100);
      }
    }

    // Continue the animation loop
    animationFrameRef.current = requestAnimationFrame(updateRestTimer);
  };

  // Function to notify user that rest time is complete
  const notifyRestComplete = () => {
    // Cancel any existing animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Vibrate the device
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      try {
        Vibration.vibrate([100, 200, 100, 200, 100]);
      } catch (error) {
        console.log('Vibration may not work in Expo Go');
      }
    }
    
    // Visual notification with flash animation
    Animated.sequence([
      Animated.timing(timeoutFlash, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(timeoutFlash, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(timeoutFlash, {
        toValue: 1,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(timeoutFlash, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
    
    // Show toast to user
    showToast('Time to do your next set!', 'info');
    
    // Call the onComplete callback after a short delay
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  // Handle adding time to the timer
  const handleAddTime = (seconds: number) => {
    // Update the end time reference with the additional time
    restEndTimeRef.current += (seconds * 1000);
    
    // Update the initial duration for progress calculation
    const newTotalDuration = restEndTimeRef.current - restStartTimeRef.current;
    setInitialDuration(newTotalDuration / 1000);
    
    // Call the onAddTime callback
    onAddTime(seconds);
  };

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!visible) return null;

  const restColor = remainingTime < 5 ? '#FF3B30' : remainingTime < 15 ? '#FF9500' : '#34C759';
  const circumference = 2 * Math.PI * 88;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <Animated.View
      style={[
        styles.restTimerContainer,
        {
          opacity: timerOpacity,
          transform: [{ scale: timerScale }],
          backgroundColor: isDark ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.98)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
          borderWidth: isDark ? 1 : 0,
        }
      ]}
    >
      <Animated.View 
        style={[
          StyleSheet.absoluteFill, 
          { 
            backgroundColor: '#FF3B30',
            opacity: timeoutFlash 
          }
        ]} 
      />
      
      <View style={styles.restTimerContent}>
        <Text style={[styles.restTimerTitle, { color: colors.text }]}>
          Rest Time
        </Text>
        
        {exerciseName && (
          <Text style={[styles.exerciseName, { color: colors.subtext }]}>
            Next: {exerciseName}
          </Text>
        )}

        <View style={styles.timerCircleContainer}>
          <View style={styles.timerCircleOuter}>
            <Svg width={200} height={200} style={StyleSheet.absoluteFill}>
              <Circle
                cx="100"
                cy="100"
                r="88"
                strokeWidth="10"
                stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                fill="transparent"
              />
              <Circle
                cx="100"
                cy="100"
                r="88"
                strokeWidth="10"
                stroke={restColor}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90, 100, 100)`}
              />
            </Svg>

            <View style={styles.timerCircleInner}>
              <Text style={[styles.timerText, { color: colors.text }]}>
                {formatTime(remainingTime)}
              </Text>
              <Text style={[styles.timerSubtext, { color: colors.subtext }]}>
                remaining
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.restTimerActions}>
          <Text style={[styles.addTimeLabel, { color: colors.subtext }]}>
            Add time
          </Text>

          <View style={styles.addTimeButtons}>
            {[15, 30, 60].map(time => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.addTimeButton,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' }
                ]}
                onPress={() => handleAddTime(time)}
              >
                <Text style={[styles.addTimeButtonText, { color: colors.text }]}>
                  +{time}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.skipButton,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.primary + '15' }
            ]}
            onPress={onSkip}
          >
            <FontAwesome5 name="forward" size={14} color={isDark ? colors.text : colors.primary} style={styles.skipButtonIcon} />
            <Text style={[styles.skipButtonText, { color: isDark ? colors.text : colors.primary }]}>
              Skip Rest
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  restTimerContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: width * 0.85,
    maxWidth: 360,
    marginLeft: -(width * 0.85) / 2,
    marginTop: -200,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 1000,
  },
  restTimerContent: {
    padding: 24,
    alignItems: 'center',
  },
  restTimerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  timerCircleContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
  timerCircleOuter: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCircleInner: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  timerSubtext: {
    fontSize: 14,
    marginTop: -4,
  },
  restTimerActions: {
    width: '100%',
    marginTop: 16,
  },
  addTimeLabel: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  addTimeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addTimeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 6,
  },
  addTimeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 22,
    marginHorizontal: 20,
  },
  skipButtonIcon: {
    marginRight: 6,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
}); 