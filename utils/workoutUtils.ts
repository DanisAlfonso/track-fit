import { WorkoutExercise } from '@/hooks/useWorkoutSession';

/**
 * Formats a duration in seconds to a human-readable string
 * @param seconds The duration in seconds
 * @returns Formatted string in the format HH:MM:SS or MM:SS
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours > 0 ? `${hours}:` : ''}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Returns a color based on muscle group
 * @param muscle The muscle group name
 * @returns A color code for the muscle
 */
export const getMuscleColor = (muscle: string): string => {
  const muscleColors: Record<string, string> = {
    'Chest': '#E91E63',
    'Back': '#3F51B5',
    'Shoulders': '#009688',
    'Biceps': '#FF5722',
    'Triceps': '#FF9800',
    'Legs': '#8BC34A',
    'Quadriceps': '#8BC34A',
    'Hamstrings': '#CDDC39',
    'Calves': '#FFEB3B',
    'Glutes': '#FFC107',
    'Abs': '#00BCD4',
    'Core': '#00BCD4',
    'Forearms': '#795548',
    'Traps': '#9C27B0',
    'Full Body': '#607D8B',
  };
  
  return muscleColors[muscle] || '#4CAF50'; // Default to green if no match
};

/**
 * Sorts exercises by muscle group
 * @param exercises The list of exercises to sort
 * @returns A new array of exercises sorted by muscle
 */
export const sortExercisesByMuscle = (exercises: WorkoutExercise[]): WorkoutExercise[] => {
  return [...exercises].sort((a, b) => {
    const muscleA = a.primary_muscle || 'Other';
    const muscleB = b.primary_muscle || 'Other';
    return muscleA.localeCompare(muscleB);
  });
};

/**
 * Sorts exercises by category
 * @param exercises The list of exercises to sort
 * @returns A new array of exercises sorted by category
 */
export const sortExercisesByCategory = (exercises: WorkoutExercise[]): WorkoutExercise[] => {
  return [...exercises].sort((a, b) => {
    const categoryA = a.category || 'Other';
    const categoryB = b.category || 'Other';
    return categoryA.localeCompare(categoryB);
  });
}; 