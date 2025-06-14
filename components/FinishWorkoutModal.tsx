import React from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { getDatabase } from '@/utils/database';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { useToast } from '@/context/ToastContext';
import { useWorkout } from '@/context/WorkoutContext';

// Type for WorkoutExercise
type WorkoutExercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  completedSets: number;
  exercise_order: number;
  primary_muscle: string;
  category: string;
  sets_data: {
    id?: number;
    set_number: number;
    reps: number;
    weight: number;
    rest_time: number;
    completed: boolean;
    training_type?: 'heavy' | 'moderate' | 'light';
    notes: string;
  }[];
  notes: string;
};

interface FinishWorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  workoutId: number | null;
  workoutDuration: number;
  exercises: WorkoutExercise[];
  isSaving: boolean;
  onSavingChange: (isSaving: boolean) => void;
  onSaveProgress: (isUrgent: boolean) => Promise<void>;
}

export const FinishWorkoutModal: React.FC<FinishWorkoutModalProps> = ({
  visible,
  onClose,
  workoutId,
  workoutDuration,
  exercises,
  isSaving,
  onSavingChange,
  onSaveProgress,
}) => {
  const router = useRouter();
  const { showToast } = useToast();
  const { endWorkout: endGlobalWorkout } = useWorkout();

  const confirmFinishWorkout = async () => {
    if (!workoutId) return;

    onSavingChange(true);
    try {
      // First save all incomplete sets
      await onSaveProgress(true);
      
      // Then mark the workout as complete
      await saveWorkoutCompletion();
      
      // Clear the active workout from global context
      endGlobalWorkout();
    } catch (error) {
      console.error('Error finishing workout:', error);
      showToast('Failed to save workout. Please try again.', 'error');
    } finally {
      onSavingChange(false);
      onClose();
    }
  };

  // Function to save workout completion details
  const saveWorkoutCompletion = async () => {
    if (!workoutId) return;
    
    try {
      const db = await getDatabase();
      
      // Update workout with completion time and duration
      await db.runAsync(
        'UPDATE workouts SET date = ?, duration = ?, completed_at = ? WHERE id = ?',
        [Date.now(), workoutDuration, Date.now(), workoutId]
      );
      
      // Save completed exercises and sets
      for (const exercise of exercises) {
        // Skip exercises with no sets or all sets are empty
        const hasCompletedSets = exercise.sets_data.some(set => set.completed);
        const hasAnySetData = exercise.sets_data.some(set => set.reps > 0 || set.weight > 0);
        
        if (!hasCompletedSets && !hasAnySetData) {
          continue; // Skip this exercise entirely
        }
        
        // Ensure the workout_exercise record exists
        let workoutExerciseId = null;
        const existingExercise = await db.getFirstAsync<{id: number}>(
          `SELECT id FROM workout_exercises WHERE workout_id = ? AND exercise_id = ?`,
          [workoutId, exercise.exercise_id]
        );
        
        if (existingExercise) {
          workoutExerciseId = existingExercise.id;
          // Update existing workout exercise
          await db.runAsync(
            `UPDATE workout_exercises SET sets_completed = ?, notes = ? WHERE id = ?`,
            [exercise.completedSets, exercise.notes || '', workoutExerciseId]
          );
        } else {
          // Create new workout exercise record
          const result = await db.runAsync(
            `INSERT INTO workout_exercises (workout_id, exercise_id, sets_completed, notes) VALUES (?, ?, ?, ?)`,
            [workoutId, exercise.exercise_id, exercise.completedSets, exercise.notes || '']
          );
          workoutExerciseId = Number(result.lastInsertRowId);
        }
        
        // Save all sets for this exercise
        if (workoutExerciseId && exercise.sets_data) {
          for (const set of exercise.sets_data) {
            if (set.id) {
              // Update existing set
              await db.runAsync(
                `UPDATE sets SET reps = ?, weight = ?, completed = ?, training_type = ?, notes = ? WHERE id = ?`,
                [set.reps, set.weight, set.completed ? 1 : 0, set.training_type || null, set.notes || '', set.id]
              );
            } else {
              // Create new set
              const result = await db.runAsync(
                `INSERT INTO sets (workout_exercise_id, set_number, reps, weight, rest_time, completed, training_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  workoutExerciseId, 
                  set.set_number, 
                  set.reps, 
                  set.weight, 
                  set.rest_time || 60, 
                  set.completed ? 1 : 0,
                  set.training_type || null,
                  set.notes || ''
                ]
              );
              
              // Update the set with its ID
              set.id = Number(result.lastInsertRowId);
            }
          }
        }
      }
      
      setTimeout(() => {
        router.replace(`/workout/${workoutId}`);
      }, 1000); 
    } catch (error) {
      console.error('Error saving workout completion:', error);
      showToast('Failed to save workout. Please try again.', 'error');
      throw error; // Re-throw to be caught by the caller
    }
  };
  
  // Handle the confirm action, wrapping it to disable the button while saving
  const handleConfirm = () => {
    if (isSaving) return;
    confirmFinishWorkout();
  };

  return (
    <ConfirmationModal
      visible={visible}
      title="Finish Workout"
      message="Are you sure you want to finish your workout? All progress will be saved."
      confirmText={isSaving ? "Saving..." : "Finish"}
      cancelText="Cancel"
      confirmStyle="primary"
      icon="check-circle"
      onConfirm={handleConfirm}
      onCancel={onClose}
    />
  );
};