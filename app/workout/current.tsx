import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useWorkout } from '@/context/WorkoutContext';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { FontAwesome } from '@expo/vector-icons';

export default function CurrentWorkoutScreen() {
  const { workoutId } = useLocalSearchParams();
  const router = useRouter();
  const { resumeWorkout, activeWorkout } = useWorkout();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  useEffect(() => {
    const checkWorkoutValidity = async () => {
      if (!workoutId) {
        router.replace('/(tabs)/workouts');
        return;
      }
      
      try {
        // Check if the workout exists and is not completed
        const db = await getDatabase();
        const workout = await db.getFirstAsync(
          'SELECT * FROM workouts WHERE id = ? AND completed_at IS NULL',
          [Number(workoutId)]
        );
        
        if (!workout) {
          console.log("Workout not found or already completed");
          router.replace('/(tabs)/workouts');
          return;
        }

        // Small delay to ensure context is ready
        setTimeout(() => {
          console.log("Workout is valid, resuming:", workoutId);
          resumeWorkout();
          
          // Redirect to the workout screen with the workout ID
          router.replace({
            pathname: '/workout/start',
            params: { workoutId }
          });
        }, 500);
      } catch (error) {
        console.error("Error checking workout validity:", error);
        router.replace('/(tabs)/workouts');
      }
    };
    
    checkWorkoutValidity();
  }, [workoutId, router, resumeWorkout]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.loadingCard}>
        <FontAwesome name="refresh" size={32} color={colors.primary} style={styles.icon} />
        <Text style={[styles.title, { color: colors.text }]}>Resuming Workout</Text>
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        <Text style={[styles.text, { color: colors.subtext }]}>
          Loading your workout data...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  spinner: {
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  }
}); 