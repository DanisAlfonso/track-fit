import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  useColorScheme,
  TextInput,
  ScrollView,
  Vibration,
  BackHandler,
  AppState
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Svg, Circle } from 'react-native-svg';
import * as Notifications from 'expo-notifications';
import { getDatabase } from '@/utils/database';

const { height, width } = Dimensions.get('window');

// Define training type options for reuse
const TRAINING_TYPES = [
  { value: 'heavy', label: 'Heavy', description: '1-5 reps', color: '#6F74DD', icon: 'trophy' },
  { value: 'moderate', label: 'Moderate', description: '6-12 reps', color: '#FFB300', icon: 'fire' },
  { value: 'light', label: 'Light', description: '13+ reps', color: '#4CAF50', icon: 'bolt' },
];

type SetData = {
  set_number: number;
  reps: number;
  weight: number;
  rest_time: number;
  completed: boolean;
  training_type?: 'heavy' | 'moderate' | 'light';
  notes: string;
};

type TouchedFields = {
  reps: boolean;
  weight: boolean;
};

type PreviousSet = {
  reps: number;
  weight: number;
};

interface SetBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (setData: SetData) => void;
  currentSet: SetData;
  exerciseName?: string;
  weightUnit: 'kg' | 'lb';
  previousPerformance?: PreviousSet;
  showRestTimer?: boolean;
}

export const SetBottomSheet: React.FC<SetBottomSheetProps> = ({
  visible,
  onClose,
  onSave,
  currentSet,
  exerciseName,
  weightUnit,
  previousPerformance,
  showRestTimer = true
}) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const isDark = currentTheme === 'dark';
  const insets = useSafeAreaInsets();
  
  // State for the set data
  const [setData, setSetData] = useState<SetData>(currentSet);
  const [touchedFields, setTouchedFields] = useState<TouchedFields>({ reps: false, weight: false });
  
  // UI State
  const [showBottomSheet, setShowBottomSheet] = useState(true);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [shouldBlockClose, setShouldBlockClose] = useState(false);
  
  // Rest timer states
  const [remainingTime, setRemainingTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initialRestTime = useRef(0);
  const savedRef = useRef(false);
  const restStartTimeRef = useRef<number>(0);
  const restEndTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const appStateRef = useRef(AppState.currentState);
  
  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(height)).current;
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerScale = useRef(new Animated.Value(0.9)).current;
  
  // Reset state when new currentSet is provided
  useEffect(() => {
    // Preserve rest time when it's not explicitly set in the currentSet
    if (currentSet.rest_time === 0 && setData?.rest_time > 0) {
      // Keep previous rest time if none is provided in the new set
      setSetData({...currentSet, rest_time: setData.rest_time});
    } else {
      setSetData(currentSet);
    }
    
    setTouchedFields({ reps: false, weight: false });
    setShowBottomSheet(true);
    setIsTimerActive(false);
    setShouldBlockClose(false);
    savedRef.current = false;
    
    // Reset timer state
    setRemainingTime(0);
    setProgress(0);
    clearTimer();
  }, [currentSet, visible]);
  
  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible && showRestTimer) {
        // If rest timer is showing, skip it on back press
        skipRestTimer();
        return true;
      }
      return false;
    });
    
    return () => backHandler.remove();
  }, [visible, showRestTimer]);
  
  // Animate backdrop and bottom sheet
  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Reset states when modal is hidden
      clearTimer();
      setIsTimerActive(false);
      setShowBottomSheet(true);
      setShouldBlockClose(false);
      savedRef.current = false;
      
      // Hide animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
  
  // Handle app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const now = Date.now();
      
      // App is coming back to foreground
      if (nextAppState === 'active' && (appStateRef.current === 'background' || appStateRef.current === 'inactive')) {
        // If timer was active when app went to background, update the time
        if (isTimerActive && restEndTimeRef.current > 0) {
          // Calculate the new remaining time
          const remaining = Math.max(0, restEndTimeRef.current - now);
          const secondsRemaining = Math.ceil(remaining / 1000);
          
          // Update the timer state
          setRemainingTime(secondsRemaining);
          
          // If time is up while in background, complete the timer
          if (secondsRemaining <= 0) {
            // Timer complete while in background
            setProgress(1);
            
            // Close after a small delay
            setTimeout(() => {
              hideRestTimer();
            }, 1000);
          } else {
            // Resume the animation frame loop
            if (!animationFrameRef.current) {
              updateRestTimer();
            }
          }
        }
      }
      
      appStateRef.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, [isTimerActive]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);
  
  // Create a wrapper around onClose to block closing during timer
  const handleClose = () => {
    if (shouldBlockClose) {
      return;
    }
    
    onClose();
  };
  
  // Clear the timer
  const clearTimer = () => {
    // Clear interval if using one
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Cancel animation frame if using one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };
  
  // Handle input changes with auto-suggestion for training type
  const handleInputChange = (field: keyof TouchedFields | 'rest_time' | 'training_type' | 'notes', value: string | number | 'heavy' | 'moderate' | 'light') => {
    if (field === 'reps' || field === 'weight') {
      setTouchedFields(prev => ({ ...prev, [field]: true }));
    }
    
    if (field === 'reps') {
      const repCount = typeof value === 'string' ? parseInt(value) || 0 : value;
      
      // Automatically suggest a training type based on rep count
      let suggestedType = setData.training_type;
      if (repCount > 0) {
        if (repCount <= 5) {
          suggestedType = 'heavy';
        } else if (repCount <= 12) {
          suggestedType = 'moderate';
        } else {
          suggestedType = 'light';
        }
      }
      
      setSetData(prev => ({...prev, reps: repCount as number, training_type: suggestedType}));
    } else if (field === 'weight') {
      const weightValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      setSetData(prev => ({...prev, weight: weightValue as number}));
    } else if (field === 'rest_time') {
      const restTime = typeof value === 'string' ? parseInt(value) || 0 : value;
      setSetData(prev => ({...prev, rest_time: restTime as number}));
    } else if (field === 'training_type') {
      setSetData(prev => ({...prev, training_type: value as 'heavy' | 'moderate' | 'light'}));
    } else if (field === 'notes') {
      setSetData(prev => ({...prev, notes: value as string}));
    }
  };
  
  // Check if there are validation errors
  const hasErrors = () => {
    return (touchedFields.reps && setData.reps === 0) || 
           (touchedFields.weight && setData.weight === 0);
  };
  
  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  // Handle save button press
  const handleSave = () => {
    // Mark fields as touched for validation
    setTouchedFields({ reps: true, weight: true });
    
    // Validate
    if (setData.reps === 0 || setData.weight === 0) {
      return; // Don't save if there are errors
    }
    
    // Create the updated set data
    const updatedSet = {
      ...setData,
      completed: true
    };
    
    // Mark as saved so we block auto-close from parent
    savedRef.current = true;
    setShouldBlockClose(true);
    
    // Save the data in the parent component
    onSave(updatedSet);
    
    // Determine if the timer should be shown
    const shouldShowTimer = updatedSet.rest_time > 0;
    
    // Start rest timer if rest time is set
    if (shouldShowTimer) {
      startRestTimer();
    } else {
      // No rest time, close immediately
      setShouldBlockClose(false);
      onClose();
    }
  };
  
  // Schedule notifications for timer vibrations
  const scheduleTimerNotifications = async (duration: number, endTime: number) => {
    // Cancel any existing notifications first
    Notifications.cancelAllScheduledNotificationsAsync();
    
    // Check notification settings
    try {
      const db = await getDatabase();
      
      // First check if all notifications are enabled
      const masterPref = await db.getFirstAsync<{enabled: number}>(`
        SELECT enabled FROM notification_preferences WHERE key = 'all_notifications'
      `);
      
      // If master switch is off, don't schedule any notifications
      if (masterPref && masterPref.enabled === 0) {
        return;
      }
      
      // Check timer completion notification setting
      const timerCompletePref = await db.getFirstAsync<{enabled: number}>(`
        SELECT enabled FROM notification_preferences WHERE key = 'timer_complete'
      `);
      
      // If timer completion is enabled, schedule the final notification
      if (!timerCompletePref || timerCompletePref.enabled === 1) {
        // Only schedule the final notification
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Timer Complete",
            body: "Rest time is over!",
            data: { type: 'timer-complete' },
          },
          trigger: { 
            date: new Date(endTime),
            type: Notifications.SchedulableTriggerInputTypes.DATE
          },
        });
      }
    } catch (error) {
      console.log('Error checking notification settings:', error);
      
      // If there's an error, fall back to default behavior - just schedule the final notification
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Timer Complete",
          body: "Rest time is over!",
          data: { type: 'timer-complete' },
        },
        trigger: { 
          date: new Date(endTime),
          type: Notifications.SchedulableTriggerInputTypes.DATE
        },
      });
    }
  };
  
  // Start rest timer
  const startRestTimer = () => {
    // Set initial time
    initialRestTime.current = setData.rest_time;
    setRemainingTime(setData.rest_time);
    
    // Initialize progress to 0 (empty circle)
    setProgress(0);
    
    // Show timer and hide bottom sheet
    setIsTimerActive(true);
    setShowBottomSheet(false);
    
    // Calculate exact start and end times
    const now = Date.now();
    restStartTimeRef.current = now;
    restEndTimeRef.current = now + (setData.rest_time * 1000);
    
    // Schedule background notifications for vibrations
    scheduleTimerNotifications(setData.rest_time, restEndTimeRef.current);
    
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
    
    // Start the animation frame loop for the timer UI updates
    updateRestTimer();
  };
  
  // Update rest timer using animation frames
  const updateRestTimer = async () => {
    const now = Date.now();
    
    // If time is up, complete the rest
    if (now >= restEndTimeRef.current) {
      setRemainingTime(0);
      setProgress(1);
      
      // Vibrate pattern for completion
      Vibration.vibrate([100, 200, 100, 200, 100]);
      
      // Clean up animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Close after a small delay
      setTimeout(() => {
        hideRestTimer();
      }, 1000);
      
      return;
    }
    
    // Calculate remaining time and progress precisely
    const totalDuration = restEndTimeRef.current - restStartTimeRef.current;
    const remaining = restEndTimeRef.current - now;
    const secondsRemaining = Math.ceil(remaining / 1000); // Round up to nearest second
    const previousSecondsRemaining = remainingTime;
    
    // Calculate progress as a value from 0 to 1
    const calculatedProgress = 1 - (remaining / totalDuration);
    
    // Update state with precise values
    setRemainingTime(secondsRemaining);
    setProgress(calculatedProgress);
    
    // Vibrate at specific intervals - check if we just crossed a threshold
    if (appStateRef.current === 'active') {
      const vibrationThresholds = [10, 5, 3, 2, 1];
      if (vibrationThresholds.includes(secondsRemaining) && previousSecondsRemaining !== secondsRemaining) {
        try {
          // Check if vibration feedback is enabled
          const db = await getDatabase();
          const vibrationPref = await db.getFirstAsync<{enabled: number}>(`
            SELECT enabled FROM notification_preferences WHERE key = 'timer_vibration'
          `);
          
          // Only vibrate if the setting is enabled or the table doesn't exist yet
          if (!vibrationPref || vibrationPref.enabled === 1) {
            Vibration.vibrate(100);
          }
        } catch (error) {
          // If there's an error, fall back to default behavior
          Vibration.vibrate(100);
        }
      }
    }
    
    // Continue the animation loop
    animationFrameRef.current = requestAnimationFrame(updateRestTimer);
  };
  
  // Hide rest timer and close modal
  const hideRestTimer = () => {
    clearTimer();
    
    // Cancel any scheduled notifications
    Notifications.cancelAllScheduledNotificationsAsync();
    
    // Animate timer out
    Animated.parallel([
      Animated.timing(timerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(timerScale, {
        toValue: 0.9,
        tension: 65,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsTimerActive(false);
      setShowBottomSheet(true);
      setShouldBlockClose(false);
      onClose(); // Close the entire modal
    });
  };
  
  // Skip rest timer
  const skipRestTimer = () => {
    hideRestTimer();
  };
  
  // Add more rest time
  const addMoreRestTime = (seconds: number) => {
    // Update the end time reference with the additional time
    restEndTimeRef.current += (seconds * 1000);
    
    // Recalculate the total duration
    const totalDuration = restEndTimeRef.current - restStartTimeRef.current;
    initialRestTime.current = totalDuration / 1000;
    
    // Calculate new remaining time
    const now = Date.now();
    const remaining = Math.max(0, restEndTimeRef.current - now);
    const secondsRemaining = Math.ceil(remaining / 1000);
    
    // Update state
    setRemainingTime(secondsRemaining);
    
    // Update progress
    const calculatedProgress = 1 - (remaining / totalDuration);
    setProgress(calculatedProgress);
    
    // Reschedule notifications with updated time
    scheduleTimerNotifications(secondsRemaining, restEndTimeRef.current);
    
    // Vibration feedback
    Vibration.vibrate(50);
  };
  
  // Render previous performance card
  const renderPreviousPerformance = () => {
    if (!previousPerformance) return null;
    
    const displayWeight = weightUnit === 'lb' ? 
      `${previousPerformance.weight.toFixed(1)} lb` : 
      `${previousPerformance.weight} kg`;
    
    return (
      <View style={[styles.previousPerformanceCard, { backgroundColor: colors.primary + '15' }]}>
        <Text style={[styles.previousPerformanceTitle, { color: colors.subtext }]}>
          Previous Performance
        </Text>
        <Text style={[styles.previousPerformanceData, { color: colors.text }]}>
          {previousPerformance.reps} reps × {displayWeight}
        </Text>
        <Text style={[styles.previousPerformanceHint, { color: colors.subtext }]}>
          Try to match or exceed your previous performance!
        </Text>
      </View>
    );
  };
  
  // Don't render if not visible
  if (!visible) return null;
  
  // Render main content
  const renderBottomSheet = () => {
    if (!showBottomSheet) {
      return null;
    }
    
    return (
      <Animated.View
        style={[
          styles.sheetContainer,
          { 
            transform: [{ translateY: sheetTranslateY }],
            paddingBottom: insets.bottom,
          }
        ]}
      >
        {/* Pull indicator */}
        <View style={styles.pullIndicatorContainer}>
          <View style={[styles.pullIndicator, { backgroundColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)' }]} />
        </View>
        
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? 'rgba(30,30,35,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              {exerciseName && (
                <Text style={[styles.exerciseName, { color: colors.subtext }]}>
                  {exerciseName}
                </Text>
              )}
              <Text style={[styles.setTitle, { color: colors.text }]}>
                Set {currentSet.set_number}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}
              onPress={handleClose}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <FontAwesome5 name="times" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Previous performance card */}
            {renderPreviousPerformance()}
            
            {/* Main content */}
            <View style={styles.content}>
              {/* Reps and Weight row */}
              <View style={styles.inputRow}>
                {/* Reps input */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputLabelRow}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Reps</Text>
                    <Text style={[styles.requiredIndicator, { color: colors.error }]}>*</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: touchedFields.reps && setData.reps === 0 ? colors.error : colors.border,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)'
                      }
                    ]}
                    keyboardType="number-pad"
                    value={setData.reps === 0 ? '' : setData.reps.toString()}
                    onChangeText={(text) => handleInputChange('reps', text)}
                    placeholder="0"
                    placeholderTextColor={colors.subtext}
                  />
                  {touchedFields.reps && setData.reps === 0 && (
                    <Text style={[styles.errorText, { color: colors.error }]}>Required</Text>
                  )}
                </View>
                
                {/* Weight input */}
                <View style={styles.inputContainer}>
                  <View style={styles.inputLabelRow}>
                    <Text style={[styles.inputLabel, { color: colors.text }]}>Weight</Text>
                    <Text style={[styles.weightUnit, { color: colors.subtext }]}>({weightUnit})</Text>
                    <Text style={[styles.requiredIndicator, { color: colors.error }]}>*</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: touchedFields.weight && setData.weight === 0 ? colors.error : colors.border,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)'
                      }
                    ]}
                    keyboardType="decimal-pad"
                    value={setData.weight === 0 ? '' : setData.weight.toString()}
                    onChangeText={(text) => handleInputChange('weight', text)}
                    placeholder="0"
                    placeholderTextColor={colors.subtext}
                  />
                  {touchedFields.weight && setData.weight === 0 && (
                    <Text style={[styles.errorText, { color: colors.error }]}>Required</Text>
                  )}
                </View>
              </View>
              
              {/* Training Type Cards */}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Training Type</Text>
              <View style={styles.trainingTypeContainer}>
                {TRAINING_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.trainingTypeCard,
                      {
                        backgroundColor: setData.training_type === type.value
                          ? type.color + '15'
                          : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                        borderColor: setData.training_type === type.value
                          ? type.color
                          : colors.border,
                        borderWidth: setData.training_type === type.value ? 2 : 1,
                      }
                    ]}
                    onPress={() => handleInputChange('training_type', type.value)}
                  >
                    <View
                      style={[
                        styles.trainingTypeIcon,
                        {
                          backgroundColor: type.color + '20',
                          borderColor: type.color
                        }
                      ]}
                    >
                      <FontAwesome5
                        name={type.icon}
                        size={16}
                        color={type.color}
                      />
                    </View>
                    <View style={styles.trainingTypeContent}>
                      <Text
                        style={[
                          styles.trainingTypeText,
                          {
                            color: setData.training_type === type.value ? type.color : colors.text,
                            fontWeight: setData.training_type === type.value ? 'bold' : '500',
                          }
                        ]}
                      >
                        {type.label}
                      </Text>
                      <Text style={[styles.trainingTypeDescription, { color: colors.subtext }]}>
                        {type.description}
                      </Text>
                    </View>
                    {setData.training_type === type.value && (
                      <View style={[styles.trainingTypeSelected, { backgroundColor: type.color }]}>
                        <FontAwesome5 name="check" size={10} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              
              {/* Rest Timer */}
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Rest Timer (sec)</Text>
              <View style={styles.restTimeContainer}>
                <TextInput
                  style={[
                    styles.restTimeInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)'
                    }
                  ]}
                  keyboardType="number-pad"
                  value={setData.rest_time.toString()}
                  onChangeText={(text) => handleInputChange('rest_time', text)}
                  placeholder="60"
                  placeholderTextColor={colors.subtext}
                />
                <Text style={[styles.restTimeUnit, { color: colors.text }]}>sec</Text>
              </View>
              
              {/* Rest Time Presets */}
              <View style={styles.presetContainer}>
                {[30, 60, 90, 120, 180].map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.presetButton,
                      {
                        backgroundColor: setData.rest_time === time
                          ? colors.primary + '20'
                          : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                        borderColor: setData.rest_time === time ? colors.primary : 'transparent',
                        borderWidth: setData.rest_time === time ? 1 : 0,
                      }
                    ]}
                    onPress={() => handleInputChange('rest_time', time)}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        {
                          color: setData.rest_time === time ? colors.primary : colors.text,
                          fontWeight: setData.rest_time === time ? '600' : 'normal',
                        }
                      ]}
                    >
                      {time >= 60 ? `${time / 60}m` : `${time}s`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
          
          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: hasErrors() ? colors.border : colors.primary,
                opacity: hasErrors() ? 0.7 : 1,
              }
            ]}
            onPress={handleSave}
            disabled={hasErrors()}
          >
            <FontAwesome5 name="check" size={18} color="white" style={styles.saveButtonIcon} />
            <Text style={styles.saveButtonText}>Save Set</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };
  
  // Render rest timer
  const renderRestTimer = () => {
    if (!isTimerActive) {
      return null;
    }
    
    const restColor = remainingTime < 5 ? '#FF3B30' : remainingTime < 15 ? '#FF9500' : '#34C759';
    
    // Calculate stroke dash values for the circle progress
    const circumference = 2 * Math.PI * 88; // Match the circle radius (r="88")
    
    // Calculate strokeDashoffset from progress (0 = empty, 1 = full)
    // When progress is 0, we want full circumference (empty circle)
    // When progress is 1, we want 0 (full circle)
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
        {/* Timer content */}
        <View style={styles.restTimerContent}>
          <Text style={[styles.restTimerTitle, { color: colors.text }]}>
            Rest Time
          </Text>
          
          {/* Timer Circle */}
          <View style={styles.timerCircleContainer}>
            <View style={styles.timerCircleOuter}>
              {/* Progress circle */}
              <Svg width={200} height={200} style={StyleSheet.absoluteFill}>
                {/* Background circle */}
                <Circle
                  cx="100"
                  cy="100"
                  r="88"
                  strokeWidth="10"
                  stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                  fill="transparent"
                />
                {/* Progress circle */}
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
                  // Rotate to start from the top
                  transform={`rotate(-90, 100, 100)`}
                />
              </Svg>
              
              {/* Timer display */}
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
          
          {/* Add time buttons */}
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
                  onPress={() => addMoreRestTime(time)}
                >
                  <Text style={[styles.addTimeButtonText, { color: colors.text }]}>
                    +{time}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Skip button */}
            <TouchableOpacity
              style={[
                styles.skipButton,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.primary + '15' }
              ]}
              onPress={skipRestTimer}
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
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Backdrop with blur */}
        <TouchableWithoutFeedback onPress={showRestTimer ? skipRestTimer : handleClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity }
            ]}
          >
            <BlurView 
              intensity={isDark ? 30 : 25}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </TouchableWithoutFeedback>
        
        {/* Bottom sheet */}
        {renderBottomSheet()}
        
        {/* Rest Timer */}
        {renderRestTimer()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    width: '100%',
  },
  pullIndicatorContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pullIndicator: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    marginBottom: 4,
  },
  setTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    maxHeight: height * 0.7,
  },
  content: {
    padding: 20,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  inputContainer: {
    width: '48%',
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  weightUnit: {
    fontSize: 14,
    marginLeft: 4,
  },
  requiredIndicator: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  trainingTypeContainer: {
    marginBottom: 24,
  },
  trainingTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  trainingTypeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  trainingTypeContent: {
    flex: 1,
  },
  trainingTypeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  trainingTypeDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  trainingTypeSelected: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  restTimeInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    width: 100,
    textAlign: 'center',
  },
  restTimeUnit: {
    marginLeft: 8,
    fontSize: 16,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  presetButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  presetText: {
    fontSize: 14,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previousPerformanceCard: {
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  previousPerformanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  previousPerformanceData: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  previousPerformanceHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Timer container and content
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
  
  // Timer circle
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
  
  // Action buttons
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
    paddingVertical: 16,
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