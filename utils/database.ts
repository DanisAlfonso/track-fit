import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

// Open the database
let db: SQLiteDatabase | null = null;

// Initialize the database
export const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (!db) {
    db = await openDatabaseAsync('trackfit.db');
  }
  return db;
};

// Migrate database - add new columns if needed
export const migrateDatabase = async (): Promise<void> => {
  const database = await getDatabase();
  
  try {
    // Check if image_uri column exists in exercises table
    const tableInfo = await database.getAllAsync(
      "PRAGMA table_info(exercises)"
    );
    
    const hasImageUriColumn = tableInfo.some((column: any) => 
      column.name === 'image_uri'
    );
    
    // Add image_uri column if it doesn't exist
    if (!hasImageUriColumn) {
      console.log('Adding image_uri column to exercises table...');
      await database.execAsync(
        'ALTER TABLE exercises ADD COLUMN image_uri TEXT;'
      );
      console.log('Migration completed successfully');
    }

    // Check if training_type column exists in sets table
    const setsTableInfo = await database.getAllAsync(
      "PRAGMA table_info(sets)"
    );
    
    const hasTrainingTypeColumn = setsTableInfo.some((column: any) => 
      column.name === 'training_type'
    );
    
    // Add training_type column if it doesn't exist
    if (!hasTrainingTypeColumn) {
      console.log('Adding training_type column to sets table...');
      await database.execAsync(
        'ALTER TABLE sets ADD COLUMN training_type TEXT;'
      );
      console.log('Training type column added successfully');
    }

    // Check if dismissed_rest_timer column exists in workouts table
    const workoutsTableInfo = await database.getAllAsync(
      "PRAGMA table_info(workouts)"
    );
    
    const hasDismissedRestTimerColumn = workoutsTableInfo.some((column: any) => 
      column.name === 'dismissed_rest_timer'
    );
    
    // Add dismissed_rest_timer column if it doesn't exist
    if (!hasDismissedRestTimerColumn) {
      console.log('Adding dismissed_rest_timer column to workouts table...');
      await database.execAsync(
        'ALTER TABLE workouts ADD COLUMN dismissed_rest_timer TEXT;'
      );
      console.log('Dismissed rest timer column added successfully');
    }

    // Check if background_color column exists in routines table
    const routinesTableInfo = await database.getAllAsync(
      "PRAGMA table_info(routines)"
    );
    
    const hasBackgroundColorColumn = routinesTableInfo.some((column: any) => 
      column.name === 'background_color'
    );
    
    // Add background_color column if it doesn't exist
    if (!hasBackgroundColorColumn) {
      console.log('Adding background_color column to routines table...');
      await database.execAsync(
        'ALTER TABLE routines ADD COLUMN background_color TEXT;'
      );
      console.log('Background color column added successfully');
    }

    // Check if weekly_schedule table needs to be modified for multiple routines per day
    try {
      // Try to insert two routines for the same day to see if it fails
      // If it succeeds, we don't need to modify the schema
      // If it fails with a UNIQUE constraint error, we need to modify the schema
      const testDay = 999; // Use a high number unlikely to be used
      const testRoutineId1 = -1;
      const testRoutineId2 = -2;
      
      // First delete any test entries if they exist
      await database.runAsync(
        'DELETE FROM weekly_schedule WHERE day_of_week = ?',
        [testDay]
      );
      
      // Try to insert two test entries
      await database.runAsync(
        'INSERT INTO weekly_schedule (day_of_week, routine_id, created_at) VALUES (?, ?, ?)',
        [testDay, testRoutineId1, Date.now()]
      );
      
      try {
        await database.runAsync(
          'INSERT INTO weekly_schedule (day_of_week, routine_id, created_at) VALUES (?, ?, ?)',
          [testDay, testRoutineId2, Date.now()]
        );
        
        // If we get here, the schema already supports multiple routines per day
        console.log('Weekly schedule schema already supports multiple routines per day');
      } catch (error) {
        // If we get a UNIQUE constraint error, we need to modify the schema
        if (error instanceof Error && error.toString().includes('UNIQUE constraint failed')) {
          console.log('Modifying weekly_schedule schema to support multiple routines per day...');
          
          // Create a new table with the correct schema
          await database.execAsync(`
            CREATE TABLE weekly_schedule_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              day_of_week INTEGER NOT NULL,
              routine_id INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE,
              UNIQUE (day_of_week, routine_id)
            );
          `);
          
          // Copy data from old table to new table
          await database.execAsync(`
            INSERT INTO weekly_schedule_new (id, day_of_week, routine_id, created_at)
            SELECT id, day_of_week, routine_id, created_at FROM weekly_schedule;
          `);
          
          // Drop old table and rename new table
          await database.execAsync(`
            DROP TABLE weekly_schedule;
            ALTER TABLE weekly_schedule_new RENAME TO weekly_schedule;
          `);
          
          console.log('Weekly schedule migration completed successfully');
        }
      } finally {
        // Clean up test entries
        await database.runAsync(
          'DELETE FROM weekly_schedule WHERE day_of_week = ?',
          [testDay]
        );
      }
    } catch (error) {
      console.error('Error migrating weekly_schedule:', error instanceof Error ? error.message : String(error));
    }
  } catch (error) {
    console.error('Error migrating database:', error instanceof Error ? error.message : String(error));
    throw error;
  }
};

// Initialize database with all required tables
export const initDatabase = async (): Promise<void> => {
  const database = await getDatabase();
  
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        primary_muscle TEXT,
        secondary_muscle TEXT,
        equipment TEXT,
        instructions TEXT,
        image_uri TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS routines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS routine_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        sets INTEGER NOT NULL,
        order_num INTEGER NOT NULL,
        FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        date INTEGER NOT NULL,
        completed_at INTEGER,
        duration INTEGER, -- Duration in seconds
        notes TEXT,
        dismissed_rest_timer TEXT, -- JSON string for dismissed rest timer state
        FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workout_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        sets_completed INTEGER NOT NULL,
        notes TEXT,
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_exercise_id INTEGER NOT NULL,
        set_number INTEGER NOT NULL,
        reps INTEGER,
        weight REAL,
        rest_time INTEGER, -- Rest time in seconds
        completed INTEGER NOT NULL DEFAULT 0,
        training_type TEXT, -- Can be 'heavy', 'moderate', or 'light'
        notes TEXT,
        FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exercise_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
        UNIQUE(exercise_id)
      );

      CREATE TABLE IF NOT EXISTS weekly_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_of_week INTEGER NOT NULL, -- 0 = Sunday, 1 = Monday, etc.
        routine_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE,
        UNIQUE (day_of_week, routine_id)
      );
      
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        enabled INTEGER NOT NULL DEFAULT 1,
        category TEXT NOT NULL
      );
    `);
  } catch (error) {
    console.error('Error creating database tables:', error);
    throw error;
  }
};

// Insert pre-defined exercises into the database
export const insertDefaultExercises = async (): Promise<void> => {
  const database = await getDatabase();
  
  const exercises = [
    { name: 'Bench Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
    { name: 'Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Deadlift', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Hamstrings,Glutes' },
    { name: 'Pull-up', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Overhead Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
    { name: 'Bicep Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
    { name: 'Single Arm Tricep Extension (Dumbbell)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
    { name: 'Leg Press', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
    { name: 'Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
    { name: 'Romanian Deadlift', category: 'Compound', primary_muscle: 'Hamstrings', secondary_muscle: 'Glutes,Back' },
    { name: 'Barbell Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Dumbbell Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
    { name: 'Incline Bench Press', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
    { name: 'Inclined Bench Press (Dumbbell)', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
    { name: 'Decline Bench Press', category: 'Compound', primary_muscle: 'Lower Chest', secondary_muscle: 'Triceps,Shoulders' },
    { name: 'Dumbbell Fly', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
    { name: 'Face Pull', category: 'Compound', primary_muscle: 'Upper Back', secondary_muscle: 'Rear Deltoids,Biceps' },
    { name: 'Lat Pulldown (Cable)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Leg Extension', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: '' },
    { name: 'Hip Thrust (Machine)', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
    { name: 'Plank', category: 'Isolation', primary_muscle: 'Core', secondary_muscle: 'Shoulders' },
    { name: 'Russian Twist', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
    // New exercises - traditional gym only
    { name: 'Dumbbell Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Cable Fly', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
    { name: 'Seated Cable Row (Cable)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Hammer Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: 'Forearms' },
    { name: 'Skull Crusher', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
    { name: 'Front Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
    { name: 'Reverse Fly', category: 'Isolation', primary_muscle: 'Rear Deltoids', secondary_muscle: 'Upper Back' },
    { name: 'Bulgarian Split Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Step Up', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Hanging Leg Raise', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: 'Hip Flexors' },
    { name: 'Cable Crunch', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: '' },
    { name: 'Side Plank', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
    { name: 'Good Morning', category: 'Compound', primary_muscle: 'Hamstrings', secondary_muscle: 'Glutes,Back' },
    { name: 'Cable Pull-Through', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
    { name: 'Seated Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
    { name: 'Standing Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
    { name: 'Arnold Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
    { name: 'Dumbbell Pullover', category: 'Compound', primary_muscle: 'Lats', secondary_muscle: 'Chest,Triceps' },
    { name: 'Wrist Curl with Dumbbells', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
    { name: 'Wrist Curl with Barbell', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
    { name: 'Wrist Curl with Cable', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
    { name: 'Reverse Wrist Curl with Dumbbells', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
    { name: 'Reverse Wrist Curl with Barbell', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
    { name: 'Reverse Wrist Curl with Cable', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
    { name: 'Shrug', category: 'Isolation', primary_muscle: 'Traps', secondary_muscle: '' },
    { name: 'Upright Row', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Traps,Biceps' },
    { name: 'Dips', category: 'Compound', primary_muscle: 'Triceps', secondary_muscle: 'Chest,Shoulders' },
    { name: 'Push-up', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
    { name: 'Chin-up', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Pistol Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Box Jump', category: 'Plyometric', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Burpee', category: 'Plyometric', primary_muscle: 'Full Body', secondary_muscle: '' },
    { name: 'Mountain Climber', category: 'Cardio', primary_muscle: 'Core', secondary_muscle: 'Shoulders,Hip Flexors' },
    { name: 'Jump Rope', category: 'Cardio', primary_muscle: 'Calves', secondary_muscle: 'Shoulders' },
    { name: 'Battle Ropes', category: 'Cardio', primary_muscle: 'Shoulders', secondary_muscle: 'Core,Arms' },
    { name: 'Kettlebell Swing', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings,Shoulders' },
    { name: 'Turkish Get-up', category: 'Compound', primary_muscle: 'Full Body', secondary_muscle: '' },
    { name: 'Farmer\'s Walk with Dumbbells', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
    { name: 'Farmer\'s Walk with Kettlebells', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
    { name: 'Farmer\'s Walk with Trap Bar', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
    { name: 'Sled Push', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Shoulders' },
    { name: 'Sled Pull', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Legs,Core' },
    { name: 'Medicine Ball Slam', category: 'Plyometric', primary_muscle: 'Core', secondary_muscle: 'Shoulders' },
    { name: 'Wall Ball', category: 'Compound', primary_muscle: 'Legs', secondary_muscle: 'Shoulders,Core' },
    { name: 'Preacher Curl (Barbell)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
    { name: 'Concentration Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
    { name: 'EZ Bar Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: 'Forearms' },
    { name: 'Close-Grip Bench Press', category: 'Compound', primary_muscle: 'Triceps', secondary_muscle: 'Chest,Shoulders' },
    { name: 'Tricep Kickback', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
    { name: 'Overhead Tricep Extension (Cable)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
    { name: 'Cable Tricep Pushdown', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
    { name: 'Pec Deck', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: '' },
    { name: 'Cable Crossover', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
    { name: 'Machine Chest Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
    { name: 'Smith Machine Bench Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
    { name: 'T-Bar Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Wide-Grip Pulldown', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
    { name: 'Close-Grip Pulldown', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
    { name: 'Machine Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
    { name: 'Cable Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Machine Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
    { name: 'Smith Machine Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
    { name: 'Reverse Pec Deck', category: 'Isolation', primary_muscle: 'Rear Deltoids', secondary_muscle: 'Upper Back' },
    { name: 'Machine Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
    { name: 'Cable Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
    { name: 'Smith Machine Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Hack Squat (Machine)', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'V-Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Goblet Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Sissy Squat', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: '' },
    { name: 'Leg Press Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
    { name: 'Smith Machine Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
    { name: 'Ab Crunch Machine', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: '' },
    { name: 'Cable Woodchoppers', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
    { name: 'Decline Sit-up', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: 'Hip Flexors' },
    { name: 'Machine Back Extension', category: 'Isolation', primary_muscle: 'Lower Back', secondary_muscle: 'Glutes' },
    { name: 'Hyperextension', category: 'Isolation', primary_muscle: 'Lower Back', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Machine Abductor', category: 'Isolation', primary_muscle: 'Hip Abductors', secondary_muscle: '' },
    { name: 'Machine Adductor', category: 'Isolation', primary_muscle: 'Hip Adductors', secondary_muscle: '' },
    { name: 'Glute Kickback Machine', category: 'Isolation', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
    { name: 'Wide Grip Chest Press Machine', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
    { name: 'Incline Chest Press Machine', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
    // Equipment-specific exercises
    { name: 'Seated Row Machine', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Bicep Curl (Machine)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
    { name: 'Chin Up (Weighted)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Hip Thrust (Barbell)', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
    { name: 'Iso-Lateral Low Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Iso-Lateral Row (Machine)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Lat Pulldown (Machine)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Leg Horizontal (Machine)', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: 'Hamstrings' },
    { name: 'Pause Squat (Barbell)', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Preacher Curl (Dumbbell)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
    { name: 'Tricep Extension (EZ Bar)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
    { name: 'Prone Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
    { name: 'Seated Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
    { name: 'Standing Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
    { name: 'Bench Press (Dumbbell)', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
    { name: 'Hack Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
  ];

  try {
    // Check if we need to insert exercises
    const countResult = await database.getFirstAsync<{count: number}>(
      'SELECT COUNT(*) as count FROM exercises'
    );
    
    // If table is empty, insert all exercises
    if (countResult && countResult.count === 0) {
      // Insert exercises one by one
      await database.withTransactionAsync(async () => {
        for (const exercise of exercises) {
          await database.runAsync(
            'INSERT INTO exercises (name, category, primary_muscle, secondary_muscle, created_at) VALUES (?, ?, ?, ?, ?)',
            [exercise.name, exercise.category, exercise.primary_muscle, exercise.secondary_muscle, Date.now()]
          );
        }
      });
      console.log('Default exercises inserted successfully');
    } 
    // If table has exactly the original 23 exercises, insert the new ones
    else if (countResult && countResult.count === 23) {
      await database.withTransactionAsync(async () => {
        // Skip the first 23 exercises which are already in the database
        for (let i = 23; i < exercises.length; i++) {
          const exercise = exercises[i];
          // Check if exercise already exists
          const existingExercise = await database.getFirstAsync(
            'SELECT id FROM exercises WHERE name = ?',
            [exercise.name]
          );
          
          if (!existingExercise) {
            await database.runAsync(
              'INSERT INTO exercises (name, category, primary_muscle, secondary_muscle, created_at) VALUES (?, ?, ?, ?, ?)',
              [exercise.name, exercise.category, exercise.primary_muscle, exercise.secondary_muscle, Date.now()]
            );
          }
        }
      });
      console.log('Additional exercises inserted successfully');
    }
    else {
      console.log('Exercises table already contains data, skipping default exercises');
    }
  } catch (error) {
    console.error('Error inserting default exercises:', error);
    throw error;
  }
};

// Initialize default notification preferences
export const initNotificationPreferences = async (): Promise<void> => {
  const database = await getDatabase();
  
  try {
    // Check if we need to insert default preferences
    const countResult = await database.getFirstAsync<{count: number}>(
      'SELECT COUNT(*) as count FROM notification_preferences'
    );
    
    // If table is empty, insert default preferences
    if (countResult && countResult.count === 0) {
      await database.withTransactionAsync(async () => {
        // Master switch
        await database.runAsync(
          'INSERT INTO notification_preferences (key, enabled, category) VALUES (?, ?, ?)',
          ['all_notifications', 1, 'system']
        );
        
        // Timer notifications
        await database.runAsync(
          'INSERT INTO notification_preferences (key, enabled, category) VALUES (?, ?, ?)',
          ['timer', 1, 'timer']
        );
        await database.runAsync(
          'INSERT INTO notification_preferences (key, enabled, category) VALUES (?, ?, ?)',
          ['timer_complete', 1, 'timer']
        );
        await database.runAsync(
          'INSERT INTO notification_preferences (key, enabled, category) VALUES (?, ?, ?)',
          ['timer_vibration', 1, 'timer']
        );
      });
      
      console.log('Default notification preferences inserted successfully');
    }
  } catch (error) {
    console.error('Error inserting default notification preferences:', error);
  }
};

// Check if an exercise is favorited
export const isExerciseFavorited = async (exerciseId: number): Promise<boolean> => {
  const database = await getDatabase();
  try {
    const result = await database.getFirstAsync<{count: number}>(
      'SELECT COUNT(*) as count FROM favorites WHERE exercise_id = ?',
      [exerciseId]
    );
    return result ? result.count > 0 : false;
  } catch (error) {
    console.error('Error checking if exercise is favorited:', error);
    return false;
  }
};

// Add an exercise to favorites
export const addToFavorites = async (exerciseId: number): Promise<void> => {
  const database = await getDatabase();
  try {
    await database.runAsync(
      'INSERT OR REPLACE INTO favorites (exercise_id, created_at) VALUES (?, ?)',
      [exerciseId, Date.now()]
    );
  } catch (error) {
    console.error('Error adding exercise to favorites:', error);
    throw error;
  }
};

// Remove an exercise from favorites
export const removeFromFavorites = async (exerciseId: number): Promise<void> => {
  const database = await getDatabase();
  try {
    await database.runAsync(
      'DELETE FROM favorites WHERE exercise_id = ?',
      [exerciseId]
    );
  } catch (error) {
    console.error('Error removing exercise from favorites:', error);
    throw error;
  }
};

// Toggle favorite status for an exercise
export const toggleFavorite = async (exerciseId: number): Promise<boolean> => {
  const isFavorited = await isExerciseFavorited(exerciseId);
  if (isFavorited) {
    await removeFromFavorites(exerciseId);
    return false;
  } else {
    await addToFavorites(exerciseId);
    return true;
  }
};

// Delete an exercise by ID
export const deleteExercise = async (exerciseId: number): Promise<void> => {
  const database = await getDatabase();
  try {
    await database.runAsync(
      'DELETE FROM exercises WHERE id = ?',
      [exerciseId]
    );
  } catch (error) {
    console.error('Error deleting exercise:', error);
    throw error;
  }
};

// Create a custom exercise with optional image URI
export const createCustomExercise = async (
  name: string,
  category: string,
  primaryMuscle: string,
  secondaryMuscles: string,
  description: string,
  imageUri?: string
): Promise<number> => {
  const database = await getDatabase();
  try {
    const result = await database.runAsync(
      'INSERT INTO exercises (name, category, primary_muscle, secondary_muscle, description, image_uri, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, category, primaryMuscle, secondaryMuscles, description, imageUri || null, Date.now()]
    );
    return result.lastInsertRowId;
  } catch (error) {
    console.error('Error creating custom exercise:', error);
    throw error;
  }
};

// Get all favorited exercises
export const getFavoritedExercises = async (): Promise<number[]> => {
  const database = await getDatabase();
  try {
    const results = await database.getAllAsync<{exercise_id: number}>(
      'SELECT exercise_id FROM favorites ORDER BY created_at DESC'
    );
    return results.map(result => result.exercise_id);
  } catch (error) {
    console.error('Error getting favorited exercises:', error);
    return [];
  }
};

// Reset database by dropping and recreating all tables
export const resetDatabase = async (): Promise<void> => {
  const database = await getDatabase();
  
  try {
    // Drop all tables
    await database.execAsync(`
      DROP TABLE IF EXISTS favorites;
      DROP TABLE IF EXISTS sets;
      DROP TABLE IF EXISTS workout_exercises;
      DROP TABLE IF EXISTS workouts;
      DROP TABLE IF EXISTS routine_exercises;
      DROP TABLE IF EXISTS routines;
      DROP TABLE IF EXISTS exercises;
      DROP TABLE IF EXISTS weekly_schedule;
      DROP TABLE IF EXISTS notification_preferences;
    `);
    
    console.log('Database reset: All tables dropped');
    
    // Reinitialize the database
    await initDatabase();
    console.log('Database reset: Tables recreated');
    
    // Insert default exercises
    await insertDefaultExercises();
    console.log('Database reset: Default exercises inserted');
    
    // Initialize notification preferences
    await initNotificationPreferences();
    console.log('Database reset: Notification preferences initialized');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
};

// Reset only the exercises table, preserving favorites
export const resetExercisesTable = async (): Promise<void> => {
  const database = await getDatabase();
  
  try {
    // Get existing favorites
    const favorites = await database.getAllAsync<{exercise_id: number}>(
      'SELECT exercise_id FROM favorites'
    );
    
    // Delete exercises (this will cascade delete from favorites due to foreign key)
    await database.execAsync('DELETE FROM exercises');
    
    // Insert all exercises
    await insertDefaultExercises();
    console.log('Exercises table reset: All exercises inserted');
    
    // Restore favorites for exercises that still exist
    for (const fav of favorites) {
      try {
        // Check if exercise exists
        const exerciseExists = await database.getFirstAsync<{count: number}>(
          'SELECT COUNT(*) as count FROM exercises WHERE id = ?',
          [fav.exercise_id]
        );
        
        if (exerciseExists && exerciseExists.count > 0) {
          await database.runAsync(
            'INSERT OR IGNORE INTO favorites (exercise_id, created_at) VALUES (?, ?)',
            [fav.exercise_id, Date.now()]
          );
        }
      } catch (error) {
        console.error('Error restoring favorite:', error);
      }
    }
    
    console.log('Favorites restored where possible');
  } catch (error) {
    console.error('Error resetting exercises table:', error);
    throw error;
  }
};

// Function to check for and add new exercises that don't already exist in the database
export const updateExercisesWithNewOnes = async (): Promise<void> => {
  const database = await getDatabase();
  
  try {
    // Get all existing exercise names
    const existingExercises = await database.getAllAsync<{ name: string }>('SELECT name FROM exercises');
    const existingNames = new Set(existingExercises.map(e => e.name));
    
    // Create an array of all exercises that should be in the database
    // This should match the array in insertDefaultExercises
    const allExercises = [
      { name: 'Bench Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Deadlift', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Hamstrings,Glutes' },
      { name: 'Pull-up', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Overhead Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Bicep Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'Single Arm Tricep Extension (Dumbbell)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Leg Press', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
      { name: 'Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Romanian Deadlift', category: 'Compound', primary_muscle: 'Hamstrings', secondary_muscle: 'Glutes,Back' },
      { name: 'Barbell Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Dumbbell Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Incline Bench Press', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
      { name: 'Inclined Bench Press (Dumbbell)', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
      { name: 'Decline Bench Press', category: 'Compound', primary_muscle: 'Lower Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Dumbbell Fly', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
      { name: 'Face Pull', category: 'Compound', primary_muscle: 'Upper Back', secondary_muscle: 'Rear Deltoids,Biceps' },
      { name: 'Lat Pulldown (Cable)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Leg Extension', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: '' },
      { name: 'Hip Thrust (Machine)', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
      { name: 'Plank', category: 'Isolation', primary_muscle: 'Core', secondary_muscle: 'Shoulders' },
      { name: 'Russian Twist', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
      // New exercises - traditional gym only
      { name: 'Dumbbell Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Cable Fly', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
      { name: 'Seated Cable Row (Cable)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Hammer Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: 'Forearms' },
      { name: 'Skull Crusher', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Front Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
      { name: 'Reverse Fly', category: 'Isolation', primary_muscle: 'Rear Deltoids', secondary_muscle: 'Upper Back' },
      { name: 'Bulgarian Split Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Step Up', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Hanging Leg Raise', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: 'Hip Flexors' },
      { name: 'Cable Crunch', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: '' },
      { name: 'Side Plank', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
      { name: 'Good Morning', category: 'Compound', primary_muscle: 'Hamstrings', secondary_muscle: 'Glutes,Back' },
      { name: 'Cable Pull-Through', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
      { name: 'Seated Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Standing Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Arnold Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Dumbbell Pullover', category: 'Compound', primary_muscle: 'Lats', secondary_muscle: 'Chest,Triceps' },
      { name: 'Wrist Curl with Dumbbells', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Wrist Curl with Barbell', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Wrist Curl with Cable', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Reverse Wrist Curl with Dumbbells', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Reverse Wrist Curl with Barbell', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Reverse Wrist Curl with Cable', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Shrug', category: 'Isolation', primary_muscle: 'Traps', secondary_muscle: '' },
      { name: 'Upright Row', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Traps,Biceps' },
      { name: 'Dips', category: 'Compound', primary_muscle: 'Triceps', secondary_muscle: 'Chest,Shoulders' },
      { name: 'Push-up', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Chin-up', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Pistol Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Box Jump', category: 'Plyometric', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Burpee', category: 'Plyometric', primary_muscle: 'Full Body', secondary_muscle: '' },
      { name: 'Mountain Climber', category: 'Cardio', primary_muscle: 'Core', secondary_muscle: 'Shoulders,Hip Flexors' },
      { name: 'Jump Rope', category: 'Cardio', primary_muscle: 'Calves', secondary_muscle: 'Shoulders' },
      { name: 'Battle Ropes', category: 'Cardio', primary_muscle: 'Shoulders', secondary_muscle: 'Core,Arms' },
      { name: 'Kettlebell Swing', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings,Shoulders' },
      { name: 'Turkish Get-up', category: 'Compound', primary_muscle: 'Full Body', secondary_muscle: '' },
      { name: 'Farmer\'s Walk with Dumbbells', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
      { name: 'Farmer\'s Walk with Kettlebells', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
      { name: 'Farmer\'s Walk with Trap Bar', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
      { name: 'Sled Push', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Shoulders' },
      { name: 'Sled Pull', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Legs,Core' },
      { name: 'Medicine Ball Slam', category: 'Plyometric', primary_muscle: 'Core', secondary_muscle: 'Shoulders' },
      { name: 'Wall Ball', category: 'Compound', primary_muscle: 'Legs', secondary_muscle: 'Shoulders,Core' },
      { name: 'Preacher Curl (Barbell)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'Concentration Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'EZ Bar Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: 'Forearms' },
      { name: 'Close-Grip Bench Press', category: 'Compound', primary_muscle: 'Triceps', secondary_muscle: 'Chest,Shoulders' },
      { name: 'Tricep Kickback', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Overhead Tricep Extension (Cable)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Cable Tricep Pushdown', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Pec Deck', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: '' },
      { name: 'Cable Crossover', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
      { name: 'Machine Chest Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Smith Machine Bench Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'T-Bar Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Wide-Grip Pulldown', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
      { name: 'Close-Grip Pulldown', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
      { name: 'Machine Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
      { name: 'Cable Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Machine Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Smith Machine Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Reverse Pec Deck', category: 'Isolation', primary_muscle: 'Rear Deltoids', secondary_muscle: 'Upper Back' },
      { name: 'Machine Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
      { name: 'Cable Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
      { name: 'Smith Machine Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Hack Squat (Machine)', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'V-Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Goblet Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Sissy Squat', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: '' },
      { name: 'Leg Press Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Smith Machine Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Ab Crunch Machine', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: '' },
      { name: 'Cable Woodchoppers', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
      { name: 'Decline Sit-up', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: 'Hip Flexors' },
      { name: 'Machine Back Extension', category: 'Isolation', primary_muscle: 'Lower Back', secondary_muscle: 'Glutes' },
      { name: 'Hyperextension', category: 'Isolation', primary_muscle: 'Lower Back', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Machine Abductor', category: 'Isolation', primary_muscle: 'Hip Abductors', secondary_muscle: '' },
      { name: 'Machine Adductor', category: 'Isolation', primary_muscle: 'Hip Adductors', secondary_muscle: '' },
      { name: 'Glute Kickback Machine', category: 'Isolation', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
      { name: 'Wide Grip Chest Press Machine', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Incline Chest Press Machine', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
      // Equipment-specific exercises
      { name: 'Seated Row Machine', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Bicep Curl (Machine)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'Chin Up (Weighted)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Hip Thrust (Barbell)', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
      { name: 'Iso-Lateral Low Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Iso-Lateral Row (Machine)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Lat Pulldown (Machine)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Leg Horizontal (Machine)', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: 'Hamstrings' },
      { name: 'Pause Squat (Barbell)', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Preacher Curl (Dumbbell)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'Tricep Extension (EZ Bar)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Prone Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
      { name: 'Seated Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
      { name: 'Standing Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
      { name: 'Bench Press (Dumbbell)', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Hack Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
    ];
    
    // Filter out exercises that already exist
    const newExercises = allExercises.filter(exercise => !existingNames.has(exercise.name));
    
    if (newExercises.length === 0) {
      console.log('No new exercises to add');
      return;
    }
    
    console.log(`Adding ${newExercises.length} new exercises...`);
    
    // Begin transaction to add all new exercises
    await database.withTransactionAsync(async () => {
      for (const exercise of newExercises) {
        await database.runAsync(
          `INSERT INTO exercises (name, category, primary_muscle, secondary_muscle, created_at) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            exercise.name,
            exercise.category,
            exercise.primary_muscle,
            exercise.secondary_muscle, 
            Date.now()
          ]
        );
      }
    });
    
    console.log(`${newExercises.length} new exercises added successfully`);
  } catch (error) {
    console.error('Error adding new exercises:', error);
    throw error;
  }
};

// Add a new function to sync exercises with the master list
export const syncExercises = async (): Promise<void> => {
  const database = await getDatabase();
  
  try {
    console.log('Starting exercise synchronization...');
    
    // Get all existing exercises from the database
    const existingExercises = await database.getAllAsync<{ id: number, name: string }>(
      'SELECT id, name FROM exercises'
    );
    
    // Create a Set of existing exercise names for quick lookup
    const existingExerciseNames = new Set(existingExercises.map(e => e.name));
    
    // Create a Map of existing exercise IDs by name for quick lookup
    const existingExerciseIds = new Map(existingExercises.map(e => [e.name, e.id]));
    
    // Define the master list of exercises that should be in the database
    // This is the single source of truth - keep in sync with insertDefaultExercises
    const masterExerciseList = [
      { name: 'Bench Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Deadlift', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Hamstrings,Glutes' },
      { name: 'Pull-up', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Overhead Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Bicep Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'Single Arm Tricep Extension (Dumbbell)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Leg Press', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
      { name: 'Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Romanian Deadlift', category: 'Compound', primary_muscle: 'Hamstrings', secondary_muscle: 'Glutes,Back' },
      { name: 'Barbell Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Dumbbell Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Incline Bench Press', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
      { name: 'Inclined Bench Press (Dumbbell)', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
      { name: 'Decline Bench Press', category: 'Compound', primary_muscle: 'Lower Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Dumbbell Fly', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
      { name: 'Face Pull', category: 'Compound', primary_muscle: 'Upper Back', secondary_muscle: 'Rear Deltoids,Biceps' },
      { name: 'Lat Pulldown (Cable)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Leg Extension', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: '' },
      { name: 'Hip Thrust (Machine)', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
      { name: 'Plank', category: 'Isolation', primary_muscle: 'Core', secondary_muscle: 'Shoulders' },
      { name: 'Russian Twist', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
      // New exercises - traditional gym only
      { name: 'Dumbbell Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Cable Fly', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
      { name: 'Seated Cable Row (Cable)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Hammer Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: 'Forearms' },
      { name: 'Skull Crusher', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Front Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
      { name: 'Reverse Fly', category: 'Isolation', primary_muscle: 'Rear Deltoids', secondary_muscle: 'Upper Back' },
      { name: 'Bulgarian Split Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Step Up', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Hanging Leg Raise', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: 'Hip Flexors' },
      { name: 'Cable Crunch', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: '' },
      { name: 'Side Plank', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
      { name: 'Good Morning', category: 'Compound', primary_muscle: 'Hamstrings', secondary_muscle: 'Glutes,Back' },
      { name: 'Cable Pull-Through', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
      { name: 'Seated Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Standing Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Arnold Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Dumbbell Pullover', category: 'Compound', primary_muscle: 'Lats', secondary_muscle: 'Chest,Triceps' },
      { name: 'Wrist Curl with Dumbbells', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Wrist Curl with Barbell', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Wrist Curl with Cable', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Reverse Wrist Curl with Dumbbells', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Reverse Wrist Curl with Barbell', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Reverse Wrist Curl with Cable', category: 'Isolation', primary_muscle: 'Forearms', secondary_muscle: '' },
      { name: 'Shrug', category: 'Isolation', primary_muscle: 'Traps', secondary_muscle: '' },
      { name: 'Upright Row', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Traps,Biceps' },
      { name: 'Dips', category: 'Compound', primary_muscle: 'Triceps', secondary_muscle: 'Chest,Shoulders' },
      { name: 'Push-up', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Chin-up', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Pistol Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Box Jump', category: 'Plyometric', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Burpee', category: 'Plyometric', primary_muscle: 'Full Body', secondary_muscle: '' },
      { name: 'Mountain Climber', category: 'Cardio', primary_muscle: 'Core', secondary_muscle: 'Shoulders,Hip Flexors' },
      { name: 'Jump Rope', category: 'Cardio', primary_muscle: 'Calves', secondary_muscle: 'Shoulders' },
      { name: 'Battle Ropes', category: 'Cardio', primary_muscle: 'Shoulders', secondary_muscle: 'Core,Arms' },
      { name: 'Kettlebell Swing', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings,Shoulders' },
      { name: 'Turkish Get-up', category: 'Compound', primary_muscle: 'Full Body', secondary_muscle: '' },
      { name: 'Farmer\'s Walk with Dumbbells', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
      { name: 'Farmer\'s Walk with Kettlebells', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
      { name: 'Farmer\'s Walk with Trap Bar', category: 'Compound', primary_muscle: 'Forearms', secondary_muscle: 'Traps,Core' },
      { name: 'Sled Push', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Shoulders' },
      { name: 'Sled Pull', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Legs,Core' },
      { name: 'Medicine Ball Slam', category: 'Plyometric', primary_muscle: 'Core', secondary_muscle: 'Shoulders' },
      { name: 'Wall Ball', category: 'Compound', primary_muscle: 'Legs', secondary_muscle: 'Shoulders,Core' },
      { name: 'Preacher Curl (Barbell)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'Concentration Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'EZ Bar Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: 'Forearms' },
      { name: 'Close-Grip Bench Press', category: 'Compound', primary_muscle: 'Triceps', secondary_muscle: 'Chest,Shoulders' },
      { name: 'Tricep Kickback', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Overhead Tricep Extension (Cable)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Cable Tricep Pushdown', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Pec Deck', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: '' },
      { name: 'Cable Crossover', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
      { name: 'Machine Chest Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Smith Machine Bench Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'T-Bar Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Wide-Grip Pulldown', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
      { name: 'Close-Grip Pulldown', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
      { name: 'Machine Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps' },
      { name: 'Cable Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Machine Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Smith Machine Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
      { name: 'Reverse Pec Deck', category: 'Isolation', primary_muscle: 'Rear Deltoids', secondary_muscle: 'Upper Back' },
      { name: 'Machine Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
      { name: 'Cable Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
      { name: 'Smith Machine Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Hack Squat (Machine)', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'V-Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Goblet Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Sissy Squat', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: '' },
      { name: 'Leg Press Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Smith Machine Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
      { name: 'Ab Crunch Machine', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: '' },
      { name: 'Cable Woodchoppers', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
      { name: 'Decline Sit-up', category: 'Isolation', primary_muscle: 'Abs', secondary_muscle: 'Hip Flexors' },
      { name: 'Machine Back Extension', category: 'Isolation', primary_muscle: 'Lower Back', secondary_muscle: 'Glutes' },
      { name: 'Hyperextension', category: 'Isolation', primary_muscle: 'Lower Back', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Machine Abductor', category: 'Isolation', primary_muscle: 'Hip Abductors', secondary_muscle: '' },
      { name: 'Machine Adductor', category: 'Isolation', primary_muscle: 'Hip Adductors', secondary_muscle: '' },
      { name: 'Glute Kickback Machine', category: 'Isolation', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
      { name: 'Wide Grip Chest Press Machine', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Incline Chest Press Machine', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
      // Equipment-specific exercises
      { name: 'Seated Row Machine', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Bicep Curl (Machine)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'Chin Up (Weighted)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Hip Thrust (Barbell)', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
      { name: 'Iso-Lateral Low Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Iso-Lateral Row (Machine)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Lat Pulldown (Machine)', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
      { name: 'Leg Horizontal (Machine)', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: 'Hamstrings' },
      { name: 'Pause Squat (Barbell)', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
      { name: 'Preacher Curl (Dumbbell)', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscle: '' },
      { name: 'Tricep Extension (EZ Bar)', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
      { name: 'Prone Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
      { name: 'Seated Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
      { name: 'Standing Leg Curl (Machine)', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
      { name: 'Bench Press (Dumbbell)', category: 'Compound', primary_muscle: 'Chest', secondary_muscle: 'Triceps,Shoulders' },
      { name: 'Hack Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
    ];
    
    // Create a set of names from the master list for quick lookups
    const masterExerciseNames = new Set(masterExerciseList.map(e => e.name));
    
    // Find exercises to add (in master list but not in database)
    const exercisesToAdd = masterExerciseList.filter(exercise => !existingExerciseNames.has(exercise.name));
    
    // Find exercises to remove (in database but not in master list)
    const exercisesToRemove = existingExercises.filter(exercise => !masterExerciseNames.has(exercise.name));
    
    // Begin a transaction for all changes
    await database.withTransactionAsync(async () => {
      // First, add new exercises
      if (exercisesToAdd.length > 0) {
        console.log(`Adding ${exercisesToAdd.length} new exercises...`);
        
        for (const exercise of exercisesToAdd) {
          await database.runAsync(
            `INSERT INTO exercises (name, category, primary_muscle, secondary_muscle, created_at) 
             VALUES (?, ?, ?, ?, ?)`,
            [
              exercise.name,
              exercise.category,
              exercise.primary_muscle,
              exercise.secondary_muscle, 
              Date.now()
            ]
          );
        }
        
        console.log(`${exercisesToAdd.length} new exercises added successfully`);
      }
      
      // Then, remove exercises that are no longer in the master list
      if (exercisesToRemove.length > 0) {
        console.log(`Removing ${exercisesToRemove.length} exercises...`);
        
        for (const exercise of exercisesToRemove) {
          // First check if this exercise is used in any routines
          const routineCount = await database.getFirstAsync<{count: number}>(
            'SELECT COUNT(*) as count FROM routine_exercises WHERE exercise_id = ?',
            [exercise.id]
          );
          
          // If the exercise is used in routines, we need to replace it
          if (routineCount && routineCount.count > 0) {
            console.log(`Exercise "${exercise.name}" is used in ${routineCount.count} routines. Removing...`);
            
            // Delete from routine_exercises (cascade should handle the rest)
            await database.runAsync(
              'DELETE FROM routine_exercises WHERE exercise_id = ?',
              [exercise.id]
            );
          }
          
          // Delete the exercise itself
          await database.runAsync(
            'DELETE FROM exercises WHERE id = ?',
            [exercise.id]
          );
        }
        
        console.log(`${exercisesToRemove.length} exercises removed successfully`);
      }
    });
    
    console.log('Exercise synchronization completed successfully');
  } catch (error) {
    console.error('Error syncing exercises:', error);
  }
};