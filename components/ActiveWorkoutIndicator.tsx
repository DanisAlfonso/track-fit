import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Colors from '@/constants/Colors';
import { useWorkout } from '@/context/WorkoutContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export default function ActiveWorkoutIndicator() {
  const router = useRouter();
  const { activeWorkout } = useWorkout();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const timerRef = useRef<number | null>(null);
  
  // For button press animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // For drag functionality
  const { height: screenHeight } = Dimensions.get('window');
  const defaultBottom = Platform.OS === 'android' ? 60 + insets.bottom : 60;
  const [dragPosition, setDragPosition] = useState(defaultBottom);
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef(0);
  
  // Calculate formatted time (hours and minutes) from total workout time
  const formatHoursMinutes = (totalTime: string) => {
    const timeParts = totalTime.split(':');
    if (timeParts.length !== 2) return '0m';
    
    const minutes = parseInt(timeParts[0]);
    return `${minutes}m`;
  };
  
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

  // Handle drag gesture
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY } = event.nativeEvent;
      const newBottom = Math.max(
        20, // Minimum distance from bottom
        Math.min(
          screenHeight - 120, // Maximum distance from bottom (leave space for component)
          dragPosition - translationY
        )
      );
      
      setDragPosition(newBottom);
      translateY.setValue(0);
    }
  };

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
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
    >
      <Animated.View
        style={[
          styles.container, 
          { 
            bottom: dragPosition,
            transform: [
              { scale: scaleAnim },
              { translateY: translateY }
            ]
          }
        ]}
      >
      <View style={styles.innerContainer}>
        {Platform.OS === 'ios' && (
          <BlurView
            style={[styles.blurBackground, { borderRadius: 16 }]}
            intensity={120}
            tint={theme === 'dark' ? 'dark' : 'light'}
          />
        )}
        <LinearGradient
          colors={theme === 'dark' 
            ? ['rgba(50,50,70,0.92)', 'rgba(30,30,40,0.98)'] 
            : ['rgba(255,255,255,0.92)', 'rgba(240,240,245,0.98)']}
          style={styles.gradientBackground}
        />
        
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
                <Text style={[styles.timerText, { color: colors.text }]}>
                  {elapsedTime}
                </Text>
                
                <Text style={[styles.totalTimeText, { color: colors.subtext }]}>
                  ({formatHoursMinutes(elapsedTime)})
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={navigateToWorkout}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                style={styles.actionButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.actionButtonText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
    </PanGestureHandler>
  );
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(400, width - 32); // Card width with 16px padding on each side

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: (width - CARD_WIDTH) / 2, // Center horizontally
    width: CARD_WIDTH,
    zIndex: 998, // Below modals but above content
  },
  innerContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  blurBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 16,
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

  timerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalTimeText: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '400',
  },
  actionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
});