import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Dimensions, Vibration, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Circle } from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { useColorScheme } from 'react-native';

const { width } = Dimensions.get('window');

interface RestTimerProps {
  visible: boolean;
  duration: number;
  onComplete: () => void;
  onSkip: () => void;
  onAddTime: (seconds: number) => void;
}

export const RestTimer: React.FC<RestTimerProps> = ({
  visible,
  duration,
  onComplete,
  onSkip,
  onAddTime,
}) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const isDark = currentTheme === 'dark';

  // Animation values
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(0.9)).current;

  // Timer state
  const [remainingTime, setRemainingTime] = useState(duration);
  const [progress, setProgress] = useState(0);
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
      setProgress(0);

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
      Vibration.vibrate([100, 200, 100, 200, 100]);
      onComplete();
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
      <View style={styles.restTimerContent}>
        <Text style={[styles.restTimerTitle, { color: colors.text }]}>
          Rest Time
        </Text>

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
                onPress={() => onAddTime(time)}
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
    padding: 30,
    alignItems: 'center',
  },
  restTimerTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  timerCircleContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  timerCircleOuter: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerCircleInner: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'transparent',
  },
  timerText: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  timerSubtext: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.7,
  },
  restTimerActions: {
    width: '100%',
    marginTop: 30,
  },
  addTimeLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  addTimeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  addTimeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTimeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
  },
  skipButtonIcon: {
    marginRight: 8,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 