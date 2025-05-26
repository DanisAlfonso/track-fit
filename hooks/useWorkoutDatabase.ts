import { useState, useRef } from 'react';
import { getDatabase } from '@/utils/database';
import { useToast } from '@/context/ToastContext';

// Type definitions
export type Exercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  exercise_order: number;
  primary_muscle: string;
  category: string;
};

export type Set = {
  id?: number;
  set_number: number;
  reps: number;
  weight: number;
  rest_time: number;
  completed: boolean;
  training_type?: 'heavy' | 'moderate' | 'light';
  notes: string;
};

export type WorkoutExercise = {
  routine_exercise_id: number;
  exercise_id: number;
  name: string;
  sets: number;
  completedSets: number;
  exercise_order: number;
  primary_muscle: string;
  category: string;
  sets_data: Set[];
  notes: string;
  originalIndex?: number;
};

export function useWorkoutDatabase() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const workoutStartTime = useRef<number | null>(null);
  const saveInProgress = useRef<boolean>(false);
  const lastSaveAttempt = useRef<number>(0);

  /**
   * Save current workout progress to the database
   */
  const saveWorkoutProgress = async (
    workoutId: number | null, 
    exercises: WorkoutExercise[], 
    isUrgent: boolean = false
  ): Promise<void> => {
    if (!workoutId) return;
    
    // Mark that a save attempt is in progress
    saveInProgress.current = true;
    lastSaveAttempt.current = Date.now();
    
    try {
      const db = await getDatabase();
      
      // Update workout duration and notes
      const now = Date.now();
      const durationMs = now - (workoutStartTime.current || now);
      const durationSec = Math.floor(durationMs / 1000);
      
      // Save progress with retry logic
      const saveWithRetry = async (retryCount = 0, maxRetries = isUrgent ? 5 : 3) => {
        try {
          // First update the main workout record
          await db.runAsync(
            'UPDATE workouts SET duration = ? WHERE id = ?',
            [durationSec, workoutId]
          );
          
          // Save each exercise and its sets
          for (const exercise of exercises) {
            // Skip exercises with no sets or all sets are empty
            const hasCompletedSets = exercise.sets_data.some(set => set.completed);
            const hasAnySetData = exercise.sets_data.some(set => set.reps > 0 || set.weight > 0);
            
            if (!hasCompletedSets && !hasAnySetData && !exercise.notes) {
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
                try {
                  // Skip empty sets that haven't been completed
                  if (!set.completed && set.reps === 0 && set.weight === 0 && !set.notes) {
                    continue;
                  }
                  
                  if (set.id) {
                    // Update existing set
                    await db.runAsync(
                      `UPDATE sets SET reps = ?, weight = ?, completed = ?, training_type = ?, rest_time = ?, notes = ? WHERE id = ?`,
                      [set.reps, set.weight, set.completed ? 1 : 0, set.training_type || null, set.rest_time || 60, set.notes || '', set.id]
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
                } catch (setError) {
                  console.error('Error saving set:', setError);
                  // Continue with other sets even if one fails
                }
              }
            }
          }
          console.log('Workout progress saved successfully');
        } catch (error) {
          console.error(`Error saving workout progress (attempt ${retryCount + 1}):`, error);
          if (retryCount < maxRetries) {
            // Wait a bit before retrying, with exponential backoff
            const delay = Math.min(500 * Math.pow(2, retryCount), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
            return saveWithRetry(retryCount + 1, maxRetries);
          } else {
            throw error;
          }
        }
      };
      
      await saveWithRetry();
    } catch (error) {
      console.error('Error saving workout progress after retries:', error);
      // Don't throw here to prevent UI disruption, but caller can catch if needed
    } finally {
      saveInProgress.current = false;
    }
  };

  /**
   * Refresh workout data from the database
   */
  const refreshWorkoutDataFromDatabase = async (
    workoutId: number, 
    exercises: WorkoutExercise[]
  ): Promise<WorkoutExercise[]> => {
    try {
      const db = await getDatabase();
      
      // Get all workout exercises
      const exerciseRecords = await db.getAllAsync<{
        id: number;
        exercise_id: number;
        sets_completed: number;
        notes: string | null;
      }>('SELECT id, exercise_id, sets_completed, notes FROM workout_exercises WHERE workout_id = ?', [workoutId]);
      
      // Temp map to store workout exercise records by exercise_id
      const exerciseMap = new Map();
      for (const record of exerciseRecords) {
        exerciseMap.set(record.exercise_id, record);
      }
      
      // Update exercises with latest data from database
      const updatedExercises = [...exercises];
      let dataChanged = false;
      
      for (let i = 0; i < updatedExercises.length; i++) {
        const exercise = updatedExercises[i];
        const dbRecord = exerciseMap.get(exercise.exercise_id);
        
        if (dbRecord) {
          // Update notes
          if (exercise.notes !== (dbRecord.notes || '')) {
            exercise.notes = dbRecord.notes || '';
            dataChanged = true;
          }
          
          // Get all sets for this exercise
          const sets = await db.getAllAsync<Set>(
            `SELECT id, set_number, reps, weight, rest_time, completed, training_type, notes
             FROM sets
             WHERE workout_exercise_id = ?
             ORDER BY set_number`,
            [dbRecord.id]
          );
          
          if (sets.length > 0) {
            // Map existing sets by set_number for comparison
            const existingSetsMap = new Map();
            exercise.sets_data.forEach(set => {
              existingSetsMap.set(set.set_number, set);
            });
            
            // Update sets with data from database
            const updatedSets: Set[] = [];
            let setsChanged = false;
            
            for (const dbSet of sets) {
              const existingSet = existingSetsMap.get(dbSet.set_number);
              
              if (existingSet) {
                // Check if any properties have changed
                if (existingSet.reps !== dbSet.reps || 
                    existingSet.weight !== dbSet.weight ||
                    existingSet.completed !== !!dbSet.completed ||
                    existingSet.training_type !== dbSet.training_type ||
                    existingSet.notes !== (dbSet.notes || '')) {
                  setsChanged = true;
                }
                
                // Update with latest data from database
                updatedSets.push({
                  ...dbSet,
                  completed: !!dbSet.completed,
                  notes: dbSet.notes || ''
                });
              } else {
                // New set added in database
                updatedSets.push({
                  ...dbSet,
                  completed: !!dbSet.completed,
                  notes: dbSet.notes || ''
                });
                setsChanged = true;
              }
            }
            
            // Add any missing sets from the original data
            for (const existingSet of exercise.sets_data) {
              if (!sets.some(s => s.set_number === existingSet.set_number)) {
                updatedSets.push(existingSet);
                setsChanged = true;
              }
            }
            
            // Sort sets by set_number
            updatedSets.sort((a, b) => a.set_number - b.set_number);
            
            if (setsChanged) {
              exercise.sets_data = updatedSets;
              exercise.completedSets = updatedSets.filter(s => s.completed).length;
              dataChanged = true;
            }
          }
        }
      }
      
      return dataChanged ? updatedExercises : exercises;
    } catch (error) {
      console.error('Error refreshing workout data:', error);
      throw error;
    }
  };

  /**
   * Resume an existing workout
   */
  const resumeExistingWorkout = async (workoutId: number): Promise<{
    workoutData: {
      routineId: number;
      routineName: string;
      workoutStartTime: number;
    };
    exercises: WorkoutExercise[];
    previousWorkoutData: Map<number, { reps: number, weight: number }[]>;
  }> => {
    setIsLoading(true);
    
    try {
      const db = await getDatabase();
      
      // Get the workout details
      const workout = await db.getFirstAsync<{ 
        routine_id: number; 
        name: string; 
        date: number;
        notes: string | null;
      }>(
        'SELECT routine_id, name, date, notes FROM workouts WHERE id = ?',
        [workoutId]
      );
      
      if (!workout) {
        throw new Error('Workout not found');
      }
      
      // Store workout start time
      workoutStartTime.current = workout.date;
      
      // Load workout exercises and sets
      const exerciseRecords = await db.getAllAsync<{
        id: number;
        exercise_id: number;
        sets_completed: number;
        notes: string | null;
      }>(
        'SELECT id, exercise_id, sets_completed, notes FROM workout_exercises WHERE workout_id = ?',
        [workoutId]
      );
      
      // Get all routine exercises for this routine
      const routineExercises = await db.getAllAsync<{
        id: number;
        exercise_id: number;
        sets: number;
        order_num: number;
        primary_muscle: string;
        category: string;
        name: string;
      }>(
        `SELECT re.id, re.exercise_id, re.sets, re.order_num, e.primary_muscle, e.category, e.name
         FROM routine_exercises re
         JOIN exercises e ON re.exercise_id = e.id
         WHERE re.routine_id = ?
         ORDER BY re.order_num`,
        [workout.routine_id]
      );
      
      if (routineExercises.length === 0) {
        throw new Error('No exercises found for this routine');
      }
      
      // Create a map for quick lookup of routine exercises by exercise_id
      const routineExerciseMap = new Map();
      routineExercises.forEach(re => {
        routineExerciseMap.set(re.exercise_id, re);
      });
      
      // Create a map for saved workout exercises and their sets
      const workoutExerciseMap = new Map();
      for (const exerciseRecord of exerciseRecords) {
        // Get all sets for this workout exercise
        const sets = await db.getAllAsync<Set>(
          `SELECT id, set_number, reps, weight, rest_time, completed, training_type, notes
           FROM sets
           WHERE workout_exercise_id = ?
           ORDER BY set_number`,
          [exerciseRecord.id]
        );
        
        workoutExerciseMap.set(exerciseRecord.exercise_id, {
          record: exerciseRecord,
          sets: sets
        });
      }
      
      // Create workout exercises list using ALL routine exercises as the base
      const workoutExercises: WorkoutExercise[] = routineExercises.map(re => {
        // Check if we have saved data for this exercise
        const savedExercise = workoutExerciseMap.get(re.exercise_id);
        
        // Create default sets data
        let sets_data: Set[] = [];
        let completedSets = 0;
        let notes = '';
        
        if (savedExercise) {
          // Use saved notes if available
          notes = savedExercise.record.notes || '';
          completedSets = savedExercise.record.sets_completed || 0;
          
          // Create a full array of sets
          for (let i = 1; i <= re.sets; i++) {
            // Look for existing set
            const existingSet = savedExercise.sets.find((s: Set) => s.set_number === i);
            
            if (existingSet) {
              sets_data.push({
                ...existingSet,
                completed: !!existingSet.completed,
                notes: existingSet.notes || ''
              });
            } else {
              // Create a new default set
              sets_data.push({
                set_number: i,
                reps: 0,
                weight: 0,
                rest_time: 60,
                completed: false,
                notes: ''
              });
            }
          }
        } else {
          // No saved data - create default sets
          for (let i = 1; i <= re.sets; i++) {
            sets_data.push({
              set_number: i,
              reps: 0,
              weight: 0,
              rest_time: 60,
              completed: false,
              notes: ''
            });
          }
        }
        
        return {
          routine_exercise_id: re.id,
          exercise_id: re.exercise_id,
          name: re.name,
          sets: re.sets,
          completedSets: completedSets,
          exercise_order: re.order_num,
          primary_muscle: re.primary_muscle,
          category: re.category,
          sets_data: sets_data,
          notes: notes
        };
      });
      
      // Sort workout exercises by order number
      workoutExercises.sort((a, b) => a.exercise_order - b.exercise_order);
      
      // Load previous workout data for reference
      const exerciseResults = routineExercises.map(re => ({
        routine_exercise_id: re.id,
        exercise_id: re.exercise_id,
        name: re.name,
        sets: re.sets,
        exercise_order: re.order_num,
        primary_muscle: re.primary_muscle,
        category: re.category
      }));
      const previousWorkoutData = await loadPreviousWorkoutData(workout.routine_id, exerciseResults);
      
      return {
        workoutData: {
          routineId: workout.routine_id,
          routineName: workout.name,
          workoutStartTime: workout.date
        },
        exercises: workoutExercises,
        previousWorkoutData
      };
    } catch (error) {
      console.error('Error resuming workout:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load routine exercises
   */
  const loadRoutineExercises = async (routineId: number): Promise<{
    routineName: string;
    exercises: WorkoutExercise[];
    previousWorkoutData: Map<number, { reps: number, weight: number }[]>;
  }> => {
    setIsLoading(true);
    
    try {
      const db = await getDatabase();
      
      // Get routine name
      const routineResult = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM routines WHERE id = ?',
        [routineId]
      );
      
      if (!routineResult) {
        throw new Error('Routine not found');
      }

      // Get routine exercises
      const exerciseResults = await db.getAllAsync<Exercise>(
        `SELECT re.id as routine_exercise_id, e.id as exercise_id, e.name, re.sets, re.order_num as exercise_order,
         e.primary_muscle, e.category
         FROM routine_exercises re
         JOIN exercises e ON re.exercise_id = e.id
         WHERE re.routine_id = ?
         ORDER BY re.order_num`,
        [routineId]
      );
      
      // Load previous workout data
      const previousWorkoutData = await loadPreviousWorkoutData(routineId, exerciseResults);
      
      // Transform exercise data
      const workoutExercises: WorkoutExercise[] = exerciseResults.map(exercise => {
        const sets_data: Set[] = [];
        
        // Create default sets
        for (let i = 1; i <= exercise.sets; i++) {
          sets_data.push({
            set_number: i,
            reps: 0,
            weight: 0,
            rest_time: 60,
            completed: false,
            notes: ''
          });
        }
        
        return {
          routine_exercise_id: exercise.routine_exercise_id,
          exercise_id: exercise.exercise_id,
          name: exercise.name,
          sets: exercise.sets,
          completedSets: 0,
          exercise_order: exercise.exercise_order,
          primary_muscle: exercise.primary_muscle,
          category: exercise.category,
          sets_data,
          notes: ''
        };
      });
      
      return {
        routineName: routineResult.name,
        exercises: workoutExercises,
        previousWorkoutData
      };
    } catch (error) {
      console.error('Error loading routine exercises:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load previous workout data for reference
   */
  const loadPreviousWorkoutData = async (
    routineId: number, 
    exercises: Exercise[]
  ): Promise<Map<number, { reps: number, weight: number }[]>> => {
    try {
      const db = await getDatabase();
      
      const workoutData = new Map<number, { reps: number, weight: number }[]>();
      
      // For each exercise, find the most recent workout where that specific exercise was performed
      for (const exercise of exercises) {
        // Find the most recent completed workout where this specific exercise was performed
        const recentWorkoutExercise = await db.getFirstAsync<{ 
          workout_exercise_id: number, 
          workout_id: number, 
          workout_date: string 
        }>(
          `SELECT we.id as workout_exercise_id, w.id as workout_id, w.date as workout_date
           FROM workout_exercises we
           JOIN workouts w ON we.workout_id = w.id
           WHERE we.exercise_id = ? AND w.routine_id = ? AND w.completed_at IS NOT NULL
           ORDER BY w.date DESC
           LIMIT 1`,
          [exercise.exercise_id, routineId]
        );
        
        if (recentWorkoutExercise) {
          const sets = await db.getAllAsync<{ set_number: number, reps: number, weight: number }>(
            `SELECT set_number, reps, weight FROM sets
             WHERE workout_exercise_id = ? AND completed = 1
             ORDER BY set_number`,
            [recentWorkoutExercise.workout_exercise_id]
          );
          
          if (sets.length > 0) {
            workoutData.set(exercise.routine_exercise_id, sets);
          }
        }
      }
      
      return workoutData;
    } catch (error) {
      console.error('Error loading previous workout data:', error);
      return new Map();
    }
  };

  /**
   * Create a new workout
   */
  const createNewWorkout = async (routineId: number, routineName: string): Promise<number> => {
    try {
      const db = await getDatabase();
      
      // Create a new workout
      const result = await db.runAsync(
        'INSERT INTO workouts (routine_id, name, date) VALUES (?, ?, ?)',
        [routineId, routineName, Date.now()]
      );
      
      const newWorkoutId = Number(result.lastInsertRowId);
      workoutStartTime.current = Date.now();
      
      return newWorkoutId;
    } catch (error) {
      console.error('Error creating workout:', error);
      throw error;
    }
  };

  return {
    isLoading,
    saveWorkoutProgress,
    refreshWorkoutDataFromDatabase,
    resumeExistingWorkout,
    loadRoutineExercises,
    loadPreviousWorkoutData,
    createNewWorkout,
    workoutStartTime: workoutStartTime
  };
} 