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
  'Single Arm Tricep Extension (Dumbbell)': [
    'Stand or sit with feet shoulder-width apart, holding a dumbbell in one hand',
    'Raise your arm overhead with elbow pointing up and the dumbbell behind your head',
    'Keeping your upper arm stationary, extend your forearm to lift the dumbbell',
    'Slowly lower the dumbbell back behind your head with control',
    'Complete all repetitions with one arm before switching to the other',
    'Focus on isolating the tricep muscle throughout the movement'
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
  'Wrist Curl with Dumbbells': [
    'Sit on a bench with your forearms resting on your thighs, palms facing up',
    'Hold dumbbells with a full grip',
    'Lower the dumbbells by extending your wrists',
    'Curl the dumbbells up by flexing your wrists',
    'Hold the contraction briefly at the top',
    'Repeat for the desired number of repetitions'
  ],
  'Wrist Curl with Barbell': [
    'Sit on a bench with your forearms resting on your thighs, palms facing up',
    'Hold a barbell with an underhand grip',
    'Lower the barbell by extending your wrists',
    'Curl the barbell up by flexing your wrists',
    'Hold the contraction briefly at the top',
    'Repeat for the desired number of repetitions'
  ],
  'Wrist Curl with Cable': [
    'Sit on a bench in front of a low pulley cable',
    'Grasp the cable attachment with palms facing up',
    'Rest your forearms on your thighs',
    'Lower the weight by extending your wrists',
    'Curl the weight up by flexing your wrists',
    'Hold the contraction briefly at the top',
    'Repeat for the desired number of repetitions'
  ],
  'Reverse Wrist Curl with Dumbbells': [
    'Sit on a bench with your forearms resting on your thighs, palms facing down',
    'Hold dumbbells with a full grip',
    'Lower the dumbbells by flexing your wrists downward',
    'Raise the dumbbells by extending your wrists upward',
    'Hold the contraction briefly at the top',
    'Repeat for the desired number of repetitions'
  ],
  'Reverse Wrist Curl with Barbell': [
    'Sit on a bench with your forearms resting on your thighs, palms facing down',
    'Hold a barbell with an overhand grip',
    'Lower the barbell by flexing your wrists downward',
    'Raise the barbell by extending your wrists upward',
    'Hold the contraction briefly at the top',
    'Repeat for the desired number of repetitions'
  ],
  'Reverse Wrist Curl with Cable': [
    'Sit on a bench in front of a low pulley cable',
    'Grasp the cable attachment with palms facing down',
    'Rest your forearms on your thighs',
    'Lower the weight by flexing your wrists downward',
    'Raise the weight by extending your wrists upward',
    'Hold the contraction briefly at the top',
    'Repeat for the desired number of repetitions'
  ],
  'Farmer\'s Walk with Dumbbells': [
    'Stand holding a heavy dumbbell in each hand at your sides',
    'Keep your shoulders back, chest up, and core engaged',
    'Walk forward with controlled steps for the designated distance or time',
    'Maintain a strong grip and upright posture throughout the movement'
  ],
  'Farmer\'s Walk with Kettlebells': [
    'Stand holding a kettlebell in each hand at your sides',
    'Keep your shoulders back, chest up, and core engaged',
    'Walk forward with controlled steps for the designated distance or time',
    'Maintain a strong grip and upright posture throughout the movement'
  ],
  'Farmer\'s Walk with Trap Bar': [
    'Position yourself inside a trap bar with feet shoulder-width apart',
    'Grip the handles and lift the bar by extending your hips and knees',
    'Stand tall with shoulders back and core engaged',
    'Walk forward with controlled steps for the designated distance or time',
    'Maintain a strong grip and upright posture throughout the movement'
  ],
  'Reverse Curl with Dumbbells': [
    'Stand holding dumbbells in front of your thighs with palms facing down',
    'Keep your elbows close to your sides',
    'Curl the dumbbells up toward your shoulders while maintaining the overhand grip',
    'Lower the dumbbells back to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Reverse Curl with Barbell': [
    'Stand holding a barbell in front of your thighs with palms facing down',
    'Keep your elbows close to your sides',
    'Curl the barbell up toward your shoulders while maintaining the overhand grip',
    'Lower the barbell back to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Reverse Curl with Cable': [
    'Stand facing a cable machine with a straight bar attachment set to the lowest position',
    'Grasp the bar with palms facing down',
    'Keep your elbows close to your sides',
    'Curl the bar up toward your shoulders while maintaining the overhand grip',
    'Lower the bar back to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Reverse Curl with EZ Bar': [
    'Stand holding an EZ bar in front of your thighs with palms facing down',
    'Keep your elbows close to your sides',
    'Curl the bar up toward your shoulders while maintaining the overhand grip',
    'Lower the bar back to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Glute Kickback Machine': [
    'Adjust the machine to your height and stand facing the pad',
    'Place one foot on the footplate and grasp the support handles',
    'Keep your core engaged and your standing leg slightly bent',
    'Push the footplate back and up by extending your leg and contracting your glutes',
    'Hold the contraction briefly at the top of the movement',
    'Return to the starting position with control',
    'Complete all repetitions on one side before switching to the other leg'
  ],
  'Wide Grip Chest Press Machine': [
    'Adjust the seat height so the handles align with your mid-chest',
    'Sit with your back firmly against the backrest and feet flat on the floor',
    'Grasp the handles with a wide grip, wider than shoulder-width',
    'Push the handles forward until your arms are fully extended, but not locked',
    'Slowly return to the starting position, feeling a stretch in your chest',
    'Maintain control throughout the movement and avoid letting the weight plates touch'
  ],
  'Incline Chest Press Machine': [
    'Adjust the seat height so the handles align with your upper chest',
    'Sit with your back firmly against the inclined backrest',
    'Grip the handles at shoulder width or slightly wider',
    'Push the handles forward until your arms are fully extended, but not locked',
    'Slowly return to the starting position, feeling a stretch in your upper chest',
    'Keep your back against the pad throughout the movement',
    'Focus on contracting your upper chest muscles during the exercise'
  ],
  'default': [
    'Set up properly with good form',
    'Control the weight through the entire range of motion',
    'Breathe properly (exhale during exertion)',
    'Maintain proper posture throughout',
    'Complete the exercise with controlled movements'
  ],
  'Lat Pulldown (Cable)': [
    'Sit at a lat pulldown machine with your knees secured under the pads',
    'Grip the bar slightly wider than shoulder-width with an overhand grip',
    'Pull the bar down toward your upper chest, squeezing your shoulder blades together',
    'Return the bar to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Lat Pulldown Machine': [
    'Adjust the seat height so your thighs are secured under the pads',
    'Grip the machine handles with a comfortable width',
    'Pull the handles down toward your chest by engaging your back muscles',
    'Squeeze your shoulder blades together at the bottom of the movement',
    'Return to the starting position with control, feeling a stretch in your lats',
    'Maintain good posture throughout the exercise'
  ],
  'Seated Cable Row (Cable)': [
    'Sit at a cable row machine with your feet against the platform',
    'Bend your knees slightly and grasp the handle with both hands',
    'Keep your back straight and chest up',
    'Pull the handle toward your lower abdomen by driving your elbows back',
    'Squeeze your shoulder blades together at the end of the movement',
    'Return to the starting position with control',
    'Repeat for the desired number of repetitions'
  ],
  'Seated Row Machine': [
    'Adjust the seat height so the handles align with your chest',
    'Sit with your chest against the pad and grasp the handles',
    'Pull the handles toward you by driving your elbows back',
    'Squeeze your shoulder blades together at the end of the movement',
    'Return to the starting position with control',
    'Maintain proper posture throughout the exercise'
  ],
  'Bicep Curl (Machine)': [
    'Adjust the seat height so your arms rest comfortably on the pad',
    'Grip the handles with your palms facing up',
    'Curl the handles toward your shoulders by flexing your biceps',
    'Hold the contraction briefly at the top',
    'Lower the weight with control back to the starting position',
    'Keep your upper arms and elbows stationary throughout the movement'
  ],
  'Chin Up (Weighted)': [
    'Attach a weight to a dip belt and secure it around your waist',
    'Hang from a pull-up bar with hands slightly narrower than shoulder-width and palms facing toward you',
    'Engage your core and pull your body up until your chin is over the bar',
    'Lower yourself with control until your arms are fully extended',
    'Keep the movement controlled despite the added weight',
    'Repeat for the desired number of repetitions'
  ],
  'Hack Squat (Machine)': [
    'Position yourself on the hack squat machine with your shoulders under the pads',
    'Place your feet shoulder-width apart on the platform',
    'Release the safety handles and lower your body by bending your knees',
    'Descend until your thighs are parallel to the platform',
    'Push through your heels to return to the starting position',
    'Keep your back against the pad throughout the movement'
  ],
  'Hip Thrust (Machine)': [
    'Adjust the machine to fit your body size',
    'Position your upper back against the pad and place your feet on the platform',
    'Start with your hips low, then drive through your heels to lift the weight',
    'At the top position, your body should form a straight line from shoulders to knees',
    'Squeeze your glutes at the top of the movement',
    'Lower the weight with control and repeat'
  ],
  'Hip Thrust (Barbell)': [
    'Sit on the ground with your upper back against a bench, knees bent and feet flat on the floor',
    'Place a barbell across your hips, optionally with a pad for comfort',
    'Drive through your heels to lift your hips off the ground, squeezing your glutes at the top',
    'At the top, your body should form a straight line from shoulders to knees',
    'Lower your hips back to the ground with control',
    'Repeat for the desired number of repetitions'
  ],
  'Iso-Lateral Low Row': [
    'Adjust the seat height so you can reach the handles with arms fully extended',
    'Sit facing the machine with your chest against the pad',
    'Grasp the low handles with a neutral grip (palms facing each other)',
    'Pull the handles toward your body by driving your elbows back',
    'Squeeze your shoulder blades together at the end of the movement',
    'Return to the starting position with control',
    'You can work each arm independently or together'
  ],
  'Iso-Lateral Row (Machine)': [
    'Adjust the seat height so the handles align with your mid-chest',
    'Sit facing the machine with your chest against the pad if available',
    'Grasp the handles with a neutral grip (palms facing each other)',
    'Pull the handles toward your body by driving your elbows back',
    'Squeeze your back muscles at the end of the movement',
    'Return to the starting position with control',
    'The independent arms allow you to correct any muscle imbalances'
  ],
  'Lat Pulldown (Machine)': [
    'Adjust the seat height so your thighs are secured under the pads',
    'Grasp the machine handles with your palms facing forward or in a neutral position',
    'Pull the handles down toward your chest by engaging your back muscles',
    'Keep your chest up and back straight throughout the movement',
    'Return to the starting position with control, feeling a stretch in your lats',
    'Maintain a steady, controlled tempo throughout the exercise'
  ],
  'Leg Horizontal (Machine)': [
    'Adjust the machine to fit your body size',
    'Lie on your side on the machine pad with your bottom leg straight',
    'Place your top leg on the movement arm pad',
    'Keeping your body stable, raise your top leg by abducting at the hip',
    'Control the movement as you lower your leg back to the starting position',
    'Complete all repetitions on one side before switching to the other'
  ],
  'Pause Squat (Barbell)': [
    'Position a barbell across your upper back (not on your neck)',
    'Stand with feet shoulder-width apart and toes slightly pointed out',
    'Descend by bending at the hips and knees while keeping your chest up',
    'At the bottom position (thighs parallel to ground), pause for 2-3 seconds',
    'Maintain tension in your muscles during the pause',
    'Drive through your heels to return to the standing position',
    'The pause eliminates momentum and increases muscle engagement'
  ],
  'Preacher Curl (Barbell)': [
    'Adjust the preacher bench so your armpits rest comfortably on the top of the pad',
    'Grasp a barbell with an underhand grip at shoulder width',
    'Rest your arms against the pad with the barbell hanging at full extension',
    'Curl the barbell up toward your shoulders while keeping your upper arms on the pad',
    'Hold the contraction briefly at the top',
    'Lower the barbell with control back to the starting position',
    'Repeat for the desired number of repetitions'
  ],
  'Preacher Curl (Dumbbell)': [
    'Adjust the preacher bench so your armpits rest comfortably on the top of the pad',
    'Hold a dumbbell in one hand with an underhand grip',
    'Rest your arm against the pad with the dumbbell hanging at full extension',
    'Curl the dumbbell up toward your shoulder while keeping your upper arm on the pad',
    'Hold the contraction briefly at the top',
    'Lower the dumbbell with control back to the starting position',
    'Complete all repetitions with one arm before switching to the other'
  ],
  'Overhead Tricep Extension (Cable)': [
    'Stand facing away from a cable machine with a rope attachment set at a high position',
    'Grasp the rope with both hands and position your elbows next to your head',
    'Keep your upper arms stationary as you extend your forearms forward and down',
    'Squeeze your triceps at full extension',
    'Slowly return to the starting position, maintaining tension on the triceps',
    'Keep your elbows close to your head throughout the movement'
  ],
  'Tricep Extension (EZ Bar)': [
    'Stand with feet shoulder-width apart or sit on a bench with back support',
    'Hold an EZ bar with an overhand grip, hands 8-12 inches apart',
    'Raise the bar overhead with arms fully extended',
    'While keeping your upper arms stationary and close to your head, bend at the elbows',
    'Lower the bar behind your head in a controlled motion',
    'Extend your arms back to the starting position by contracting your triceps',
    'Maintain proper form with elbows pointed forward, not outward',
    'Focus on the triceps doing the work rather than using momentum'
  ],
  'Prone Leg Curl (Machine)': [
    'Lie face down on the leg curl machine with your ankles positioned under the padded lever',
    'Grasp the handles or sides of the machine for stability',
    'Keep your body flat against the bench throughout the movement',
    'Curl your legs up by bending at the knees, bringing your heels toward your buttocks',
    'Squeeze your hamstrings at the top of the movement',
    'Lower the weight back to the starting position with control',
    'Avoid lifting your hips off the bench during the exercise'
  ],
  'Seated Leg Curl (Machine)': [
    'Sit on the leg curl machine with your back against the pad and knees aligned with the pivot point',
    'Position your legs on top of the padded lever, just above your ankles',
    'Secure any additional stabilization pads or belts',
    'Grasp the handles or sides of the machine for stability',
    'Curl your legs down and back by bending at the knees',
    'Squeeze your hamstrings at the point of maximum contraction',
    'Return to the starting position with control',
    'Keep your torso stationary throughout the movement'
  ],
  'Standing Leg Curl (Machine)': [
    'Stand facing the machine, holding the support handles for stability',
    'Position your working leg on the padded lever, just above the ankle',
    'Keep your supporting leg slightly bent and hip-width apart from the machine',
    'Curl your leg up by bending at the knee, bringing your heel toward your buttocks',
    'Squeeze your hamstring at the top of the movement',
    'Lower your leg back to the starting position with control',
    'Complete all repetitions with one leg before switching to the other',
    'Maintain an upright posture throughout the exercise'
  ],
};

/**
 * Get instructions for a specific exercise
 * @param exerciseName The name of the exercise
 * @returns An array of instruction strings
 */
export const getExerciseInstructions = (exerciseName: string): string[] => {
  return exerciseInstructions[exerciseName] || exerciseInstructions['default'];
}; 