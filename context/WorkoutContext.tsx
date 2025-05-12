import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase } from '@/utils/database';

type WorkoutContextType = {
  activeWorkout: {
    id: number | null;
    routineName: string;
    startTime: number | null;
    isActive: boolean;
  };
  startWorkout: (id: number, name: string) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  endWorkout: () => void;
  checkForAbandonedWorkout: () => Promise<boolean>;
}

// Storage key for persisting active workout
const ACTIVE_WORKOUT_STORAGE_KEY = 'trackfit_active_workout';

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState({
    id: null as number | null,
    routineName: '',
    startTime: null as number | null,
    isActive: false
  });
  
  // Check for abandoned workouts on app start
  useEffect(() => {
    checkForAbandonedWorkout();
  }, []);
  
  // Save active workout state to AsyncStorage whenever it changes
  useEffect(() => {
    // Only save when there's an active workout
    if (activeWorkout.id) {
      const saveWorkout = async () => {
        try {
          await AsyncStorage.setItem(
            ACTIVE_WORKOUT_STORAGE_KEY, 
            JSON.stringify(activeWorkout)
          );
        } catch (error) {
          console.error('Error saving active workout:', error);
        }
      };
      
      saveWorkout();
    } else {
      // Clear the storage when there's no active workout
      AsyncStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY)
        .catch(error => console.error('Error clearing active workout:', error));
    }
  }, [activeWorkout]);
  
  // Check for abandoned workouts
  const checkForAbandonedWorkout = async (): Promise<boolean> => {
    try {
      // Check for saved workout in AsyncStorage
      const savedWorkoutJSON = await AsyncStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
      
      if (savedWorkoutJSON) {
        const savedWorkout = JSON.parse(savedWorkoutJSON);
        
        // Verify that this workout still exists and is not completed
        const db = await getDatabase();
        const workoutResult = await db.getFirstAsync<{
          id: number;
          name: string;
          completed_at: number | null;
        }>(
          'SELECT id, name, completed_at FROM workouts WHERE id = ?',
          [savedWorkout.id]
        );
        
        // If workout exists and is still in progress (not completed)
        if (workoutResult && workoutResult.id && !workoutResult.completed_at) {
          // Restore the workout state
          setActiveWorkout({
            id: workoutResult.id,
            routineName: workoutResult.name,
            startTime: savedWorkout.startTime,
            isActive: false // Always start as inactive (showing indicator)
          });
          
          return true; // Workout was restored
        } else {
          // Workout doesn't exist or is already completed - clear the saved state
          await AsyncStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
        }
      }
      
      return false; // No workout was restored
    } catch (error) {
      console.error('Error checking for abandoned workouts:', error);
      return false;
    }
  };
  
  // Start a new workout
  const startWorkout = (id: number, name: string) => {
    console.log("Starting workout in context:", id, name);
    setActiveWorkout({
      id,
      routineName: name,
      startTime: Date.now(),
      isActive: true // When starting a workout, it's active (showing on screen)
    });
  };

  // Pause the workout (when user minimizes it)
  const pauseWorkout = () => {
    console.log("Pausing workout in context");
    setActiveWorkout(prev => ({
      ...prev,
      isActive: false // When minimizing, set to inactive (showing indicator)
    }));
  };

  // Resume the workout (when user returns to it)
  const resumeWorkout = () => {
    console.log("Resuming workout in context");
    setActiveWorkout(prev => ({
      ...prev,
      isActive: true // When returning to workout screen, set active again
    }));
  };

  // End the workout (when user finishes it)
  const endWorkout = () => {
    console.log("Ending workout in context");
    setActiveWorkout({
      id: null,
      routineName: '',
      startTime: null,
      isActive: false
    });
  };

  return (
    <WorkoutContext.Provider value={{
      activeWorkout,
      startWorkout,
      pauseWorkout,
      resumeWorkout,
      endWorkout,
      checkForAbandonedWorkout
    }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error('useWorkout must be used within a WorkoutProvider');
  }
  return context;
} 