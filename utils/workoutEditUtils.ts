import { getDatabase } from './database';

export interface SetUpdateData {
  reps?: number;
  weight?: number;
  rest_time?: number;
  training_type?: 'heavy' | 'moderate' | 'light';
  notes?: string;
}

/**
 * Update a completed set in the database
 */
export const updateCompletedSet = async (
  setId: number, 
  updates: SetUpdateData
): Promise<void> => {
  const database = await getDatabase();
  
  const updateFields = Object.keys(updates)
    .map(key => `${key} = ?`)
    .join(', ');
  
  const values = Object.values(updates);
  
  if (updateFields.length === 0) {
    throw new Error('No fields to update');
  }
  
  await database.runAsync(
    `UPDATE sets SET ${updateFields} WHERE id = ?`,
    [...values, setId]
  );
};

/**
 * Delete a completed set from the database
 * If this is the only set for an exercise, the entire exercise will be removed from the workout
 */
export const deleteCompletedSet = async (setId: number): Promise<void> => {
  const database = await getDatabase();
  
  // First check if this is the only set for the exercise
  const setInfo = await database.getFirstAsync<{
    workout_exercise_id: number;
    set_count: number;
  }>(
    `SELECT 
       s.workout_exercise_id,
       (SELECT COUNT(*) FROM sets WHERE workout_exercise_id = s.workout_exercise_id) as set_count
     FROM sets s 
     WHERE s.id = ?`,
    [setId]
  );
  
  if (!setInfo) {
    throw new Error('Set not found');
  }
  
  if (setInfo.set_count === 1) {
    // If this is the only set, delete the entire exercise from the workout
    // The CASCADE DELETE will automatically remove all sets for this exercise
    await database.runAsync('DELETE FROM workout_exercises WHERE id = ?', [setInfo.workout_exercise_id]);
    return;
  }
  
  // Delete the set
  await database.runAsync('DELETE FROM sets WHERE id = ?', [setId]);
  
  // Renumber remaining sets for this exercise
  const remainingSets = await database.getAllAsync<{id: number, set_number: number}>(
    'SELECT id, set_number FROM sets WHERE workout_exercise_id = ? ORDER BY set_number',
    [setInfo.workout_exercise_id]
  );
  
  // Update set numbers to be sequential
  for (let i = 0; i < remainingSets.length; i++) {
    if (remainingSets[i].set_number !== i + 1) {
      await database.runAsync(
        'UPDATE sets SET set_number = ? WHERE id = ?',
        [i + 1, remainingSets[i].id]
      );
    }
  }
};

/**
 * Get set details by ID
 */
export const getSetById = async (setId: number) => {
  const database = await getDatabase();
  
  return await database.getFirstAsync<{
    id: number;
    workout_exercise_id: number;
    set_number: number;
    reps: number;
    weight: number;
    rest_time: number | null;
    training_type: string | null;
    notes: string | null;
  }>(
    'SELECT * FROM sets WHERE id = ?',
    [setId]
  );
};

/**
 * Check if a workout is completed (has completed_at timestamp)
 */
export const isWorkoutCompleted = async (workoutId: number): Promise<boolean> => {
  const database = await getDatabase();
  
  const result = await database.getFirstAsync<{completed_at: string | null}>(
    'SELECT completed_at FROM workouts WHERE id = ?',
    [workoutId]
  );
  
  return result?.completed_at !== null;
};