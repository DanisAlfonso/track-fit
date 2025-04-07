/**
 * Exercise instructions for the TrackFit app
 * This file contains detailed instructions for each exercise
 */

export interface ExerciseInstructions {
  [key: string]: string[];
}

export const exerciseInstructions: ExerciseInstructions = {
  'Bench Press': [
    'Lie on a flat bench with your feet firmly on the ground',
    'Grip the barbell slightly wider than shoulder-width',
    'Unrack the barbell and lower it to your chest under control',
    'Press the barbell back up until your arms are fully extended',
    'Repeat for the desired number of repetitions'
  ],
  'Squat': [
    'Stand with feet shoulder-width apart',
    'Place the barbell across your upper back (not on your neck)',
    'Bend at the knees and hips to lower your body',
    'Keep your chest up and back straight',
    'Lower until thighs are parallel to the ground',
    'Push through your heels to return to the starting position'
  ],
  'Deadlift': [
    'Stand with feet hip-width apart, toes pointing slightly outward',
    'Place the barbell over the middle of your feet',
    'Bend at the hips and knees to grip the barbell with hands just outside your legs',
    'Keep your back straight, chest up, and core engaged',
    'Lift the barbell by extending your hips and knees',
    'Stand fully upright with the barbell at hip level',
    'Lower the barbell by bending at the hips and knees, keeping it close to your body'
  ],
  'Pull-up': [
    'Hang from a pull-up bar with hands slightly wider than shoulder-width',
    'Engage your core and pull your shoulder blades down and back',
    'Pull your body up until your chin is over the bar',
    'Lower yourself with control until your arms are fully extended',
    'Repeat for the desired number of repetitions'
  ],
  'Overhead Press': [
    'Stand with feet shoulder-width apart',
    'Hold the barbell at shoulder level with hands slightly wider than shoulder-width',
    'Press the barbell overhead until your arms are fully extended',
    'Lower the barbell back to shoulder level with control',
    'Repeat for the desired number of repetitions'
  ],
  'Bicep Curl': [
    'Stand with feet shoulder-width apart, holding dumbbells at your sides',
    'Keeping your elbows close to your body, curl the dumbbells up toward your shoulders',
    'Pause briefly at the top, then lower the dumbbells with control',
    'Repeat for the desired number of repetitions'
  ],
  'Tricep Extension': [
    'Stand with feet shoulder-width apart, holding a dumbbell with both hands behind your head',
    'Extend your arms overhead until the dumbbell is directly above your head',
    'Lower the dumbbell back behind your head with control',
    'Repeat for the desired number of repetitions'
  ],
  'Leg Press': [
    'Sit in the leg press machine with your back against the pad',
    'Place your feet shoulder-width apart on the platform',
    'Release the safety handles and lower the platform toward your chest by bending your knees',
    'Push the platform back up to the starting position by extending your legs',
    'Repeat for the desired number of repetitions'
  ],
  'Lateral Raise': [
    'Stand with feet shoulder-width apart, holding dumbbells at your sides',
    'Raise your arms out to the sides until they are parallel to the ground',
    'Lower the dumbbells back to your sides with control',
    'Repeat for the desired number of repetitions'
  ],
  'Calf Raise': [
    'Stand with feet shoulder-width apart on a raised platform, heels hanging off the edge',
    'Raise your heels as high as possible by pushing through the balls of your feet',
    'Lower your heels below the platform level, feeling a stretch in your calves',
    'Repeat for the desired number of repetitions'
  ],
  'Romanian Deadlift': [
    'Stand with feet hip-width apart, holding a barbell in front of your thighs',
    'Hinge at the hips, pushing them back while keeping your back straight',
    'Lower the barbell along your legs until you feel a stretch in your hamstrings',
    'Return to the starting position by driving your hips forward',
    'Repeat for the desired number of repetitions'
  ],
  'Barbell Row': [
    'Stand with feet shoulder-width apart, holding a barbell with an overhand grip',
    'Hinge at the hips, keeping your back straight and core engaged',
    'Pull the barbell toward your lower chest, squeezing your shoulder blades together',
    'Lower the barbell with control to the starting position',
    'Repeat for the desired number of repetitions'
  ],
  'Dumbbell Shoulder Press': [
    'Sit on a bench with back support, holding dumbbells at shoulder level',
    'Press the dumbbells overhead until your arms are fully extended',
    'Lower the dumbbells back to shoulder level with control',
    'Repeat for the desired number of repetitions'
  ],
  'Incline Bench Press': [
    'Lie on an incline bench with your feet firmly on the ground',
    'Grip the barbell slightly wider than shoulder-width',
    'Unrack the barbell and lower it to your upper chest under control',
    'Press the barbell back up until your arms are fully extended',
    'Repeat for the desired number of repetitions'
  ],
  'Decline Bench Press': [
    'Lie on a decline bench with your feet secured, holding a barbell above your chest',
    'Lower the barbell to your lower chest under control',
    'Press the barbell back up until your arms are fully extended',
    'Repeat for the desired number of repetitions'
  ],
  'Dumbbell Fly': [
    'Lie on a flat bench with your feet firmly on the ground, holding dumbbells above your chest',
    'With a slight bend in your elbows, lower the dumbbells out to the sides in an arc motion',
    'Bring the dumbbells back together above your chest',
    'Repeat for the desired number of repetitions'
  ],
  'Face Pull': [
    'Attach a rope attachment to a cable machine at head height',
    'Stand facing the machine, holding the rope with both hands',
    'Pull the rope toward your face, separating the ends and raising your elbows',
    'Return to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Lat Pulldown': [
    'Sit at a lat pulldown machine with your knees secured under the pads',
    'Grip the bar slightly wider than shoulder-width with an overhand grip',
    'Pull the bar down toward your upper chest, squeezing your shoulder blades together',
    'Return the bar to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Leg Extension': [
    'Sit in a leg extension machine with your back against the pad',
    'Place your ankles behind the padded bar',
    'Extend your legs until they are straight',
    'Lower the weight back to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Leg Curl': [
    'Lie face down on a leg curl machine with your ankles against the padded bar',
    'Curl your legs up toward your glutes',
    'Lower the weight back to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Hip Thrust': [
    'Sit on the ground with your upper back against a bench, knees bent and feet flat on the floor',
    'Place a barbell across your hips',
    'Drive through your heels to lift your hips off the ground, squeezing your glutes at the top',
    'Lower your hips back to the ground with control',
    'Repeat for the desired number of repetitions'
  ],
  'Plank': [
    'Start in a push-up position with your forearms on the ground',
    'Keep your body in a straight line from head to heels',
    'Engage your core and hold this position for the desired duration'
  ],
  'Russian Twist': [
    'Sit on the ground with your knees bent and feet elevated',
    'Lean back slightly and hold a weight in front of your chest',
    'Rotate your torso to the right, bringing the weight to your right side',
    'Rotate to the left, bringing the weight to your left side',
    'Continue alternating sides for the desired number of repetitions'
  ],
  'default': [
    'Set up properly with good form',
    'Control the weight through the entire range of motion',
    'Breathe properly (exhale during exertion)',
    'Maintain proper posture throughout',
    'Complete the exercise with controlled movements'
  ]
};

/**
 * Get instructions for a specific exercise
 * @param exerciseName The name of the exercise
 * @returns An array of instruction strings
 */
export const getExerciseInstructions = (exerciseName: string): string[] => {
  return exerciseInstructions[exerciseName] || exerciseInstructions['default'];
}; 