/**
 * Exercise images for the TrackFit app
 * This file contains references to exercise images/animations
 */

// Using the app icon as a placeholder for now
// In the future, we'll replace these with actual exercise images/animations
const defaultIcon = require('@/assets/images/icon.png');

export interface ExerciseImages {
  [key: string]: any;
}

export const exerciseImages: ExerciseImages = {
  default: {
    icon: defaultIcon,
  },
  'Bench Press': {
    icon: defaultIcon,
  },
  'Squat': {
    icon: defaultIcon,
  },
  'Deadlift': {
    icon: defaultIcon,
  },
  'Pull-up': {
    icon: defaultIcon,
  },
  'Overhead Press': {
    icon: defaultIcon,
  },
  'Bicep Curl': {
    icon: defaultIcon,
  },
  'Tricep Extension': {
    icon: defaultIcon,
  },
  'Leg Press': {
    icon: defaultIcon,
  },
  'Lateral Raise': {
    icon: defaultIcon,
  },
  'Calf Raise': {
    icon: defaultIcon,
  },
  'Romanian Deadlift': {
    icon: defaultIcon,
  },
  'Barbell Row': {
    icon: defaultIcon,
  },
  'Dumbbell Shoulder Press': {
    icon: defaultIcon,
  },
  'Incline Bench Press': {
    icon: defaultIcon,
  },
  'Decline Bench Press': {
    icon: defaultIcon,
  },
  'Dumbbell Fly': {
    icon: defaultIcon,
  },
  'Face Pull': {
    icon: defaultIcon,
  },
  'Lat Pulldown': {
    icon: defaultIcon,
  },
  'Leg Extension': {
    icon: defaultIcon,
  },
  'Leg Curl': {
    icon: defaultIcon,
  },
  'Hip Thrust': {
    icon: defaultIcon,
  },
  'Plank': {
    icon: defaultIcon,
  },
  'Russian Twist': {
    icon: defaultIcon,
  },
};

/**
 * Get the image for a specific exercise
 * @param exerciseName The name of the exercise
 * @param customImageUri Optional custom image URI for user-added exercises
 * @returns The image reference for the exercise
 */
export const getExerciseImage = (exerciseName: string, customImageUri?: string | null): any => {
  // If a custom image URI is provided, return it
  if (customImageUri) {
    return { uri: customImageUri };
  }
  
  // Otherwise, return the predefined exercise image or the default
  return exerciseImages[exerciseName] || exerciseImages['default'];
}; 