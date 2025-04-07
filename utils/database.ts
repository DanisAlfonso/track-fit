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
        category TEXT NOT NULL,
        description TEXT,
        primary_muscle TEXT NOT NULL,
        secondary_muscles TEXT
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
        order_num INTEGER NOT NULL,
        sets INTEGER NOT NULL DEFAULT 3,
        FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workouts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        routine_id INTEGER,
        name TEXT NOT NULL,
        date INTEGER NOT NULL,
        notes TEXT,
        duration INTEGER,
        FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS workout_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        exercise_id INTEGER NOT NULL,
        order_num INTEGER NOT NULL,
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_exercise_id INTEGER NOT NULL,
        reps INTEGER,
        weight REAL,
        completed INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises (id) ON DELETE CASCADE
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
    { name: 'Bench Press', category: 'Compound', primary_muscle: 'Chest', secondary_muscles: 'Triceps,Shoulders' },
    { name: 'Squat', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscles: 'Glutes,Hamstrings' },
    { name: 'Deadlift', category: 'Compound', primary_muscle: 'Back', secondary_muscles: 'Hamstrings,Glutes' },
    { name: 'Pull-up', category: 'Compound', primary_muscle: 'Back', secondary_muscles: 'Biceps,Shoulders' },
    { name: 'Overhead Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscles: 'Triceps' },
    { name: 'Bicep Curl', category: 'Isolation', primary_muscle: 'Biceps', secondary_muscles: '' },
    { name: 'Tricep Extension', category: 'Isolation', primary_muscle: 'Triceps', secondary_muscles: '' },
    { name: 'Leg Press', category: 'Compound', primary_muscle: 'Quadriceps', secondary_muscles: 'Glutes,Hamstrings' },
    { name: 'Lateral Raise', category: 'Isolation', primary_muscle: 'Shoulders', secondary_muscles: '' },
    { name: 'Calf Raise', category: 'Isolation', primary_muscle: 'Calves', secondary_muscles: '' },
    { name: 'Romanian Deadlift', category: 'Compound', primary_muscle: 'Hamstrings', secondary_muscles: 'Glutes,Back' },
    { name: 'Barbell Row', category: 'Compound', primary_muscle: 'Back', secondary_muscles: 'Biceps,Shoulders' },
    { name: 'Dumbbell Shoulder Press', category: 'Compound', primary_muscle: 'Shoulders', secondary_muscles: 'Triceps' },
    { name: 'Incline Bench Press', category: 'Compound', primary_muscle: 'Upper Chest', secondary_muscles: 'Shoulders,Triceps' },
    { name: 'Decline Bench Press', category: 'Compound', primary_muscle: 'Lower Chest', secondary_muscles: 'Triceps,Shoulders' },
    { name: 'Dumbbell Fly', category: 'Isolation', primary_muscle: 'Chest', secondary_muscles: 'Shoulders' },
    { name: 'Face Pull', category: 'Compound', primary_muscle: 'Upper Back', secondary_muscles: 'Rear Deltoids,Biceps' },
    { name: 'Lat Pulldown', category: 'Compound', primary_muscle: 'Back', secondary_muscles: 'Biceps,Shoulders' },
    { name: 'Leg Extension', category: 'Isolation', primary_muscle: 'Quadriceps', secondary_muscles: '' },
    { name: 'Leg Curl', category: 'Isolation', primary_muscle: 'Hamstrings', secondary_muscles: 'Calves' },
    { name: 'Hip Thrust', category: 'Compound', primary_muscle: 'Glutes', secondary_muscles: 'Hamstrings' },
    { name: 'Plank', category: 'Isolation', primary_muscle: 'Core', secondary_muscles: 'Shoulders' },
    { name: 'Russian Twist', category: 'Isolation', primary_muscle: 'Obliques', secondary_muscles: 'Core' },
  ];

  try {
    // Drop and recreate the exercises table
    await database.execAsync(`
      DROP TABLE IF EXISTS exercises;
      CREATE TABLE exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        primary_muscle TEXT NOT NULL,
        secondary_muscles TEXT
      );
    `);

    // Insert exercises one by one
    await database.withTransactionAsync(async () => {
      for (const exercise of exercises) {
        await database.runAsync(
          'INSERT INTO exercises (name, category, primary_muscle, secondary_muscles) VALUES (?, ?, ?, ?)',
          [exercise.name, exercise.category, exercise.primary_muscle, exercise.secondary_muscles]
        );
      }
    });
  } catch (error) {
    console.error('Error inserting default exercises:', error);
    throw error;
  }
}; 