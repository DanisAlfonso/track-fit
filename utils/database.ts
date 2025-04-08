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
    { name: 'Tricep Extension', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscle: '' },
    { name: 'Leg Press', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscle: 'Glutes,Hamstrings' },
    { name: 'Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscle: '' },
    { name: 'Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscle: '' },
    { name: 'Romanian Deadlift', category: 'Compound', primary_muscle: 'Hamstrings', secondary_muscle: 'Glutes,Back' },
    { name: 'Barbell Row', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Dumbbell Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscle: 'Triceps' },
    { name: 'Incline Bench Press', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscle: 'Shoulders,Triceps' },
    { name: 'Decline Bench Press', category: 'Compound', primary_muscle: 'Lower Chest', secondary_muscle: 'Triceps,Shoulders' },
    { name: 'Dumbbell Fly', category: 'Isolation', primary_muscle: 'Chest', secondary_muscle: 'Shoulders' },
    { name: 'Face Pull', category: 'Compound', primary_muscle: 'Upper Back', secondary_muscle: 'Rear Deltoids,Biceps' },
    { name: 'Lat Pulldown', category: 'Compound', primary_muscle: 'Back', secondary_muscle: 'Biceps,Shoulders' },
    { name: 'Leg Extension', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscle: '' },
    { name: 'Leg Curl', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscle: 'Calves' },
    { name: 'Hip Thrust', category: 'Compound', primary_muscle: 'Glutes', secondary_muscle: 'Hamstrings' },
    { name: 'Plank', category: 'Isolation', primary_muscle: 'Core', secondary_muscle: 'Shoulders' },
    { name: 'Russian Twist', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscle: 'Core' },
  ];

  try {
    // Check if exercises table is empty
    const countResult = await database.getFirstAsync<{count: number}>(
      'SELECT COUNT(*) as count FROM exercises'
    );
    
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
    } else {
      console.log('Exercises table already contains data, skipping default exercises');
    }
  } catch (error) {
    console.error('Error inserting default exercises:', error);
    throw error;
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
    `);
    
    console.log('Database reset: All tables dropped');
    
    // Reinitialize the database
    await initDatabase();
    console.log('Database reset: Tables recreated');
    
    // Insert default exercises
    await insertDefaultExercises();
    console.log('Database reset: Default exercises inserted');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  }
}; 