import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Switch, Platform, ScrollView, Image, Text, Modal, ActivityIndicator, Linking, Share } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { resetDatabase, getDatabase } from '@/utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { AntDesign } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheet, ActionSheetOption } from '@/components/ActionSheet';
import { ConfirmationModal } from '@/components/ConfirmationModal';

export const WEIGHT_UNIT_STORAGE_KEY = 'weight_unit_preference';
export const LENGTH_UNIT_STORAGE_KEY = 'length_unit_preference';
export type WeightUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';
const USER_NAME_KEY = 'user_name';
const USER_AGE_KEY = 'user_age';
const USER_GENDER_KEY = 'user_gender';
const USER_FITNESS_GOAL_KEY = 'user_fitness_goal';
const USER_ACTIVITY_LEVEL_KEY = 'user_activity_level';
const USER_PROFILE_PICTURE_KEY = 'user_profile_picture';

export const getWeightUnitPreference = async (): Promise<WeightUnit> => {
  try {
    const storedValue = await AsyncStorage.getItem(WEIGHT_UNIT_STORAGE_KEY);
    return storedValue as WeightUnit || 'kg'; // Default to kg if no preference is set
  } catch (error) {
    console.error('Error fetching weight unit preference:', error);
    return 'kg'; // Default to kg on error
  }
};

export const setWeightUnitPreference = async (value: WeightUnit): Promise<void> => {
  try {
    await AsyncStorage.setItem(WEIGHT_UNIT_STORAGE_KEY, value);
  } catch (error) {
    console.error('Error saving weight unit preference:', error);
  }
};

export const getLengthUnitPreference = async (): Promise<LengthUnit> => {
  try {
    const storedValue = await AsyncStorage.getItem(LENGTH_UNIT_STORAGE_KEY);
    return storedValue as LengthUnit || 'cm'; // Default to cm if no preference is set
  } catch (error) {
    console.error('Error fetching length unit preference:', error);
    return 'cm'; // Default to cm on error
  }
};

export const setLengthUnitPreference = async (value: LengthUnit): Promise<void> => {
  try {
    await AsyncStorage.setItem(LENGTH_UNIT_STORAGE_KEY, value);
  } catch (error) {
    console.error('Error saving length unit preference:', error);
  }
};

// Conversion functions
export const kgToLb = (kg: number): number => {
  return kg * 2.20462;
};

export const lbToKg = (lb: number): number => {
  return lb / 2.20462;
};

export const cmToInches = (cm: number): number => {
  return cm / 2.54;
};

export const inchesToCm = (inches: number): number => {
  return inches * 2.54;
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const { theme, setTheme } = useTheme();
  const { showToast } = useToast();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const [useKilograms, setUseKilograms] = useState(true);
  const [useCentimeters, setUseCentimeters] = useState(true);
  const [userName, setUserName] = useState('Fitness Enthusiast');
  const [userAge, setUserAge] = useState('');
  const [userGender, setUserGender] = useState('');
  const [userFitnessGoal, setUserFitnessGoal] = useState('');
  const [userActivityLevel, setUserActivityLevel] = useState('');
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [workoutStats, setWorkoutStats] = useState({
    totalWorkouts: 0,
    totalExercises: 0,
    daysActive: 0,
    streakDays: 0
  });
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [lengthUnit, setLengthUnit] = useState('cm');

  // ActionSheet state
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [resetConfirmationVisible, setResetConfirmationVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);
  
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );
  
  const loadData = async () => {
    // Load weight unit preference
    const weightUnit = await getWeightUnitPreference();
    setUseKilograms(weightUnit === 'kg');
    
    // Load length unit preference
    const lengthUnit = await getLengthUnitPreference();
    setUseCentimeters(lengthUnit === 'cm');
    
    // Load user profile data
    try {
      const name = await AsyncStorage.getItem(USER_NAME_KEY);
      if (name) setUserName(name);
      
      const age = await AsyncStorage.getItem(USER_AGE_KEY);
      if (age) setUserAge(age);
      
      const gender = await AsyncStorage.getItem(USER_GENDER_KEY);
      if (gender) setUserGender(gender);
      
      const fitnessGoal = await AsyncStorage.getItem(USER_FITNESS_GOAL_KEY);
      if (fitnessGoal) setUserFitnessGoal(fitnessGoal);
      
      const activityLevel = await AsyncStorage.getItem(USER_ACTIVITY_LEVEL_KEY);
      if (activityLevel) setUserActivityLevel(activityLevel);
      
      const profilePicture = await AsyncStorage.getItem(USER_PROFILE_PICTURE_KEY);
      setProfilePictureUri(profilePicture);
    } catch (error) {
      console.error('Error loading user profile data:', error);
    }
    
    // Load workout stats
    loadWorkoutStats();
  };

  const loadWorkoutStats = async () => {
    try {
      const db = await getDatabase();
      
      // Count only completed workouts that exist in the database
      const workoutsCount = await db.getFirstAsync<{count: number}>(`
        SELECT COUNT(*) as count 
        FROM workouts 
        WHERE completed_at IS NOT NULL
      `);
      
      // Count only workout exercises that are linked to existing workouts
      const exercisesCount = await db.getFirstAsync<{count: number}>(`
        SELECT COUNT(*) as count 
        FROM workout_exercises we
        WHERE EXISTS (SELECT 1 FROM workouts w WHERE w.id = we.workout_id)
      `);
      
      const uniqueDaysQuery = await db.getFirstAsync<{count: number}>(`
        SELECT COUNT(DISTINCT date(completed_at)) as count 
        FROM workouts 
        WHERE completed_at IS NOT NULL
      `);

      // Calculate streak (mocked for now)
      const streakDays = Math.min(workoutsCount?.count || 0, 14);
      
      setWorkoutStats({
        totalWorkouts: workoutsCount?.count || 0,
        totalExercises: exercisesCount?.count || 0,
        daysActive: uniqueDaysQuery?.count || 0,
        streakDays: streakDays
      });
    } catch (error) {
      console.error('Error loading workout stats:', error);
    }
  };

  const handleResetDatabase = () => {
    setResetConfirmationVisible(true);
  };

  const confirmReset = async () => {
    try {
      await resetDatabase();
      setResetConfirmationVisible(false);
      showToast('All data has been reset successfully. Please restart the app.', 'success');
    } catch (error) {
      console.error('Error resetting database:', error);
      showToast('Failed to reset the data. Please try again.', 'error');
    }
  };

  const toggleWeightUnit = async (value: boolean) => {
    setUseKilograms(value);
    await setWeightUnitPreference(value ? 'kg' : 'lb');
  };

  const toggleLengthUnit = async (value: boolean) => {
    setUseCentimeters(value);
    await setLengthUnitPreference(value ? 'cm' : 'in');
  };

  // Generate streak indicator dots
  const renderStreakDots = () => {
    return Array.from({ length: 7 }).map((_, index) => (
      <View 
        key={index} 
        style={[
          styles.streakDot, 
          { 
            backgroundColor: index < workoutStats.streakDays % 7 
              ? colors.primary 
              : theme === 'dark' ? '#333' : '#e0e0e0' 
          }
        ]} 
      />
    ));
  };

  // Theme selector modal
  const ThemeSelectionModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={themeModalVisible}
      onRequestClose={() => setThemeModalVisible(false)}
    >
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Theme</Text>
          
          <TouchableOpacity
            style={[
              styles.themeOption,
              { borderBottomColor: colors.border, borderBottomWidth: 1 }
            ]}
            onPress={() => {
              setTheme('light');
              setThemeModalVisible(false);
            }}
          >
            <View style={styles.themeOptionLabel}>
              <FontAwesome5 name="sun" size={20} color={colors.primary} style={styles.themeIcon} />
              <Text style={[styles.themeText, { color: colors.text }]}>Light</Text>
            </View>
            {theme === 'light' && (
              <FontAwesome5 name="check" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.themeOption,
              { borderBottomColor: colors.border, borderBottomWidth: 1 }
            ]}
            onPress={() => {
              setTheme('dark');
              setThemeModalVisible(false);
            }}
          >
            <View style={styles.themeOptionLabel}>
              <FontAwesome5 name="moon" size={20} color={colors.primary} style={styles.themeIcon} />
              <Text style={[styles.themeText, { color: colors.text }]}>Dark</Text>
            </View>
            {theme === 'dark' && (
              <FontAwesome5 name="check" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.themeOption}
            onPress={() => {
              setTheme('system');
              setThemeModalVisible(false);
            }}
          >
            <View style={styles.themeOptionLabel}>
              <FontAwesome5 name="mobile-alt" size={20} color={colors.primary} style={styles.themeIcon} />
              <Text style={[styles.themeText, { color: colors.text }]}>Use System Settings</Text>
            </View>
            {theme === 'system' && (
              <FontAwesome5 name="check" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.primary }]}
            onPress={() => setThemeModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const handleImportRoutine = async () => {
    try {
      // Open document picker to select a JSON file
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });
      
      if (result.canceled) {
        return;
      }
      
      // Read the selected file
      const fileUri = result.assets[0].uri;
      const fileContents = await FileSystem.readAsStringAsync(fileUri);
      
      // Parse the JSON data
      const routineData = JSON.parse(fileContents);
      
      // Validate the imported data has the expected format
      if (!routineData.name || !Array.isArray(routineData.exercises)) {
        showToast('The selected file is not a valid routine file.', 'error');
        return;
      }
      
      // Open the database
      const db = await getDatabase();
      let newRoutineId: number = 0;
      
      try {
        // Insert the routine
        const routineResult = await db.runAsync(
          'INSERT INTO routines (name, description, created_at) VALUES (?, ?, ?)',
          [routineData.name, routineData.description || null, Date.now()]
        );
        
        newRoutineId = routineResult.lastInsertRowId;
        
        // Get exercise IDs by name and insert routine exercises
        for (let i = 0; i < routineData.exercises.length; i++) {
          const exercise = routineData.exercises[i];
          
          // Find the exercise in the database by name
          const exerciseResult = await db.getFirstAsync<{ id: number }>(
            'SELECT id FROM exercises WHERE name = ?',
            [exercise.name]
          );
          
          // If exercise exists, add it to the routine
          if (exerciseResult) {
            const exerciseId = exerciseResult.id;
            
            await db.runAsync(
              'INSERT INTO routine_exercises (routine_id, exercise_id, order_num, sets) VALUES (?, ?, ?, ?)',
              [newRoutineId, exerciseId, i, exercise.sets || 3]
            );
          }
        }
        
        Alert.alert(
          'Import Successful', 
          `Routine "${routineData.name}" has been imported with ${routineData.exercises.length} exercises.`,
          [
            { 
              text: 'View Routine', 
              onPress: () => router.push(`/routine/${newRoutineId}`) 
            },
            { text: 'OK' }
          ]
        );
      } catch (error) {
        // If there's an error in the import process, clean up any partial data
        if (newRoutineId > 0) {
          await db.runAsync('DELETE FROM routines WHERE id = ?', [newRoutineId]);
        }
        throw error;
      }
    } catch (error) {
      console.error('Error importing routine:', error);
      showToast('An error occurred while importing the routine.', 'error');
    }
  };

  const handleImportData = async () => {
    try {
      // Warn the user about the implications of importing data
      Alert.alert(
        'Import Data',
        'Importing data will replace your current data. This cannot be undone. Are you sure you want to proceed?',
        [
          { 
            text: 'Cancel', 
            style: 'cancel' 
          },
          {
            text: 'Continue',
            style: 'destructive',
            onPress: async () => {
              try {
                // Open document picker to select a JSON file
                const result = await DocumentPicker.getDocumentAsync({
                  type: 'application/json',
                  copyToCacheDirectory: true
                });
                
                if (result.canceled) {
                  return;
                }
                
                // Read the selected file
                const fileUri = result.assets[0].uri;
                const fileContents = await FileSystem.readAsStringAsync(fileUri);
                
                // Parse the JSON data
                const importData = JSON.parse(fileContents);
                
                // Validate the import data structure
                if (!importData.data || !importData.exportDate) {
                  showToast('The selected file is not a valid TrackFit export file.', 'error');
                  return;
                }
                
                // Show progress indicator
                Alert.alert(
                  'Importing Data',
                  'Please wait while we import your data. This may take a few moments...',
                  [{ text: 'OK' }]
                );
                
                const db = await getDatabase();
                
                // Begin transaction to ensure data integrity
                await db.execAsync('BEGIN TRANSACTION');
                
                try {
                  // Clear existing data
                  await db.execAsync(`
                    DELETE FROM weekly_schedule;
                    DELETE FROM favorites;
                    DELETE FROM sets;
                    DELETE FROM workout_exercises;
                    DELETE FROM workouts;
                    DELETE FROM routine_exercises;
                    DELETE FROM routines;
                    -- Keep exercises table intact to preserve system defaults
                  `);
                  
                  // Optional: Clear measurements tables if they exist
                  try {
                    await db.execAsync(`
                      DELETE FROM measurements;
                      DELETE FROM measurement_preferences;
                    `);
                  } catch (error) {
                    console.log('Measurements tables might not exist, skipping cleanup...');
                  }
                  
                  // Import routines
                  if (importData.data.routines && importData.data.routines.length > 0) {
                    for (const routine of importData.data.routines) {
                      // Insert the routine
                      const routineResult = await db.runAsync(
                        'INSERT INTO routines (id, name, description, created_at) VALUES (?, ?, ?, ?)',
                        [routine.id, routine.name, routine.description, routine.created_at]
                      );
                      
                      // Insert routine exercises if they exist
                      if (routine.exercises && routine.exercises.length > 0) {
                        for (const exercise of routine.exercises) {
                          // Find the exercise in the database by name to get its ID
                          const exerciseResult = await db.getFirstAsync<{ id: number }>(
                            'SELECT id FROM exercises WHERE name = ?',
                            [exercise.exercise_name]
                          );
                          
                          if (exerciseResult) {
                            await db.runAsync(
                              'INSERT INTO routine_exercises (id, routine_id, exercise_id, sets, order_num) VALUES (?, ?, ?, ?, ?)',
                              [exercise.id, routine.id, exerciseResult.id, exercise.sets, exercise.order_num]
                            );
                          }
                        }
                      }
                    }
                  }
                  
                  // Import workouts
                  if (importData.data.workouts && importData.data.workouts.length > 0) {
                    for (const workout of importData.data.workouts) {
                      // Insert the workout
                      await db.runAsync(
                        'INSERT INTO workouts (id, routine_id, name, date, completed_at, duration, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [workout.id, workout.routine_id, workout.name, workout.date, workout.completed_at, workout.duration, workout.notes]
                      );
                      
                      // Insert workout exercises if they exist
                      if (workout.exercises && workout.exercises.length > 0) {
                        for (const exercise of workout.exercises) {
                          // Find the exercise in the database by name
                          const exerciseResult = await db.getFirstAsync<{ id: number }>(
                            'SELECT id FROM exercises WHERE name = ?',
                            [exercise.exercise_name]
                          );
                          
                          if (exerciseResult) {
                            // Insert the workout exercise
                            await db.runAsync(
                              'INSERT INTO workout_exercises (id, workout_id, exercise_id, sets_completed, notes) VALUES (?, ?, ?, ?, ?)',
                              [exercise.id, workout.id, exerciseResult.id, exercise.sets_completed, exercise.notes]
                            );
                            
                            // Insert sets if they exist
                            if (exercise.sets && exercise.sets.length > 0) {
                              for (const set of exercise.sets) {
                                await db.runAsync(
                                  'INSERT INTO sets (id, workout_exercise_id, set_number, reps, weight, rest_time, completed, training_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                  [set.id, exercise.id, set.set_number, set.reps, set.weight, set.rest_time, set.completed, set.training_type, set.notes]
                                );
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                  
                  // Import weekly schedule
                  if (importData.data.weeklySchedule && importData.data.weeklySchedule.length > 0) {
                    for (const scheduleItem of importData.data.weeklySchedule) {
                      await db.runAsync(
                        'INSERT INTO weekly_schedule (id, day_of_week, routine_id, created_at) VALUES (?, ?, ?, ?)',
                        [scheduleItem.id, scheduleItem.day_of_week, scheduleItem.routine_id, scheduleItem.created_at]
                      );
                    }
                  }
                  
                  // Import favorites
                  if (importData.data.favorites && importData.data.favorites.length > 0) {
                    for (const favorite of importData.data.favorites) {
                      // Find the exercise by name
                      const exerciseResult = await db.getFirstAsync<{ id: number }>(
                        'SELECT id FROM exercises WHERE name = ?',
                        [favorite.exercise_name]
                      );
                      
                      if (exerciseResult) {
                        await db.runAsync(
                          'INSERT INTO favorites (id, exercise_id, created_at) VALUES (?, ?, ?)',
                          [favorite.id, exerciseResult.id, favorite.created_at]
                        );
                      }
                    }
                  }
                  
                  // Import measurements if they exist in the export
                  if (importData.data.measurements && importData.data.measurements.length > 0) {
                    try {
                      // Ensure the measurements table exists
                      await db.execAsync(`
                        CREATE TABLE IF NOT EXISTS measurements (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          type TEXT NOT NULL,
                          value REAL NOT NULL,
                          date INTEGER NOT NULL,
                          unit TEXT,
                          custom_name TEXT
                        )
                      `);
                      
                      for (const measurement of importData.data.measurements) {
                        await db.runAsync(
                          'INSERT INTO measurements (id, type, value, date, unit, custom_name) VALUES (?, ?, ?, ?, ?, ?)',
                          [measurement.id, measurement.type, measurement.value, measurement.date, measurement.unit, measurement.custom_name]
                        );
                      }
                    } catch (error) {
                      console.error('Error restoring measurements:', error);
                    }
                  }
                  
                  // Import measurement preferences if they exist
                  if (importData.data.measurementPreferences && importData.data.measurementPreferences.length > 0) {
                    try {
                      // Ensure the measurement_preferences table exists
                      await db.execAsync(`
                        CREATE TABLE IF NOT EXISTS measurement_preferences (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          type TEXT NOT NULL UNIQUE,
                          is_tracking INTEGER NOT NULL DEFAULT 0,
                          custom_name TEXT
                        )
                      `);
                      
                      for (const pref of importData.data.measurementPreferences) {
                        await db.runAsync(
                          'INSERT INTO measurement_preferences (id, type, is_tracking, custom_name) VALUES (?, ?, ?, ?)',
                          [pref.id, pref.type, pref.is_tracking, pref.custom_name]
                        );
                      }
                    } catch (error) {
                      console.error('Error restoring measurement preferences:', error);
                    }
                  }
                  
                  // Commit transaction if everything went well
                  await db.execAsync('COMMIT');
                  
                  // Show success message
                  Alert.alert(
                    'Import Complete',
                    'Your data has been successfully restored. The app will now refresh to apply the changes.',
                    [
                      { 
                        text: 'OK', 
                        onPress: () => {
                          // Refresh app data
                          loadData();
                        }
                      }
                    ]
                  );
                } catch (error) {
                  // Rollback transaction on error
                  await db.execAsync('ROLLBACK');
                  throw error;
                }
              } catch (error) {
                console.error('Error importing data:', error);
                showToast('An error occurred while importing your data. Please try again.', 'error');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error in handleImportData:', error);
      showToast('An error occurred while preparing to import data.', 'error');
    }
  };

  const handleExportData = async () => {
    try {
      // Show loading indicator
      Alert.alert(
        'Exporting Data',
        'Please wait while we prepare your data for export...',
        [{ text: 'OK' }]
      );
      
      const db = await getDatabase();
      const exportData: any = {
        exportDate: new Date().toISOString(),
        appVersion: '1.0.0',
        data: {}
      };
      
      // Define types for our DB entities
      type DbRoutine = {
        id: number;
        name: string;
        description: string | null;
        created_at: number;
      };
      
      type DbRoutineExercise = {
        id: number;
        routine_id: number;
        exercise_id: number;
        sets: number;
        order_num: number;
        exercise_name: string;
        primary_muscle: string;
        category: string;
      };
      
      type DbWorkout = {
        id: number;
        routine_id: number;
        name: string;
        date: number;
        completed_at: number | null;
        duration: number | null;
        notes: string | null;
        routine_name: string;
      };
      
      type DbWorkoutExercise = {
        id: number;
        workout_id: number;
        exercise_id: number;
        sets_completed: number;
        notes: string | null;
        exercise_name: string;
        primary_muscle: string;
        category: string;
      };
      
      type DbSet = {
        id: number;
        workout_exercise_id: number;
        set_number: number;
        reps: number | null;
        weight: number | null;
        rest_time: number | null;
        completed: number;
        training_type: string | null;
        notes: string | null;
      };
      
      // Export routines with their exercises
      const routines = await db.getAllAsync<DbRoutine>(`
        SELECT * FROM routines
      `);
      
      // Process routines and include their exercises
      exportData.data.routines = await Promise.all(routines.map(async (routine) => {
        const routineExercises = await db.getAllAsync<DbRoutineExercise>(`
          SELECT re.*, e.name as exercise_name, e.primary_muscle, e.category 
          FROM routine_exercises re
          JOIN exercises e ON re.exercise_id = e.id
          WHERE re.routine_id = ?
          ORDER BY re.order_num
        `, [routine.id]);
        
        return {
          ...routine,
          exercises: routineExercises
        };
      }));
      
      // Export workouts with their exercises and sets
      const workouts = await db.getAllAsync<DbWorkout>(`
        SELECT w.*, r.name as routine_name
        FROM workouts w
        LEFT JOIN routines r ON w.routine_id = r.id
      `);
      
      // Process workouts and include their exercises and sets
      exportData.data.workouts = await Promise.all(workouts.map(async (workout) => {
        const workoutExercises = await db.getAllAsync<DbWorkoutExercise>(`
          SELECT we.*, e.name as exercise_name, e.primary_muscle, e.category
          FROM workout_exercises we
          JOIN exercises e ON we.exercise_id = e.id
          WHERE we.workout_id = ?
        `, [workout.id]);
        
        // Get sets for each workout exercise
        const processedExercises = await Promise.all(workoutExercises.map(async (exercise) => {
          const sets = await db.getAllAsync<DbSet>(`
            SELECT * FROM sets
            WHERE workout_exercise_id = ?
            ORDER BY set_number
          `, [exercise.id]);
          
          return {
            ...exercise,
            sets
          };
        }));
        
        return {
          ...workout,
          exercises: processedExercises
        };
      }));
      
      // Export exercises
      exportData.data.exercises = await db.getAllAsync(`
        SELECT * FROM exercises
      `);
      
      // Export measurements
      try {
        // Check if the measurements table exists
        const measurementsExist = await db.getFirstAsync(`
          SELECT name FROM sqlite_master WHERE type='table' AND name='measurements'
        `);
        
        if (measurementsExist) {
          exportData.data.measurements = await db.getAllAsync(`
            SELECT * FROM measurements
          `);
          
          exportData.data.measurementPreferences = await db.getAllAsync(`
            SELECT * FROM measurement_preferences
          `);
        }
      } catch (error) {
        console.log('Measurements table not found, skipping...');
      }
      
      // Export weekly schedule
      exportData.data.weeklySchedule = await db.getAllAsync(`
        SELECT ws.*, r.name as routine_name
        FROM weekly_schedule ws
        JOIN routines r ON ws.routine_id = r.id
      `);
      
      // Export favorites
      exportData.data.favorites = await db.getAllAsync(`
        SELECT f.*, e.name as exercise_name
        FROM favorites f
        JOIN exercises e ON f.exercise_id = e.id
      `);
      
      // Convert the data to JSON
      const jsonData = JSON.stringify(exportData, null, 2);
      
      // Generate a filename with the current date
      const date = new Date();
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const fileName = `trackfit_export_${dateStr}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Write the data to a file
      await FileSystem.writeAsStringAsync(fileUri, jsonData);
      
      // Check if sharing is available
      const isSharingAvailable = await Sharing.isAvailableAsync();
      
      if (isSharingAvailable) {
        // Show success message and share options
        Alert.alert(
          'Export Complete',
          'Your data has been exported successfully. Would you like to share the file?',
          [
            { 
              text: 'Share', 
              onPress: async () => {
                // Share the file
                await Sharing.shareAsync(fileUri, {
                  mimeType: 'application/json',
                  dialogTitle: 'Share TrackFit Data',
                  UTI: 'public.json' // for iOS
                });
              }
            },
            { text: 'Close' }
          ]
        );
      } else {
        showToast('Your data has been exported successfully to the app documents directory.', 'success');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      showToast('An error occurred while exporting your data. Please try again later.', 'error');
    }
  };

  const handleProfilePictureChange = () => {
    // Show the ActionSheet
    setActionSheetVisible(true);
  };

  // Generate action sheet options based on current state
  const getActionSheetOptions = (): ActionSheetOption[] => {
    const options: ActionSheetOption[] = [
      {
        label: 'Take Photo',
        onPress: takePhoto,
        icon: 'camera'
      },
      {
        label: 'Choose from Library',
        onPress: pickImage,
        icon: 'image'
      }
    ];
    
    // Only add the remove option if there's a profile picture
    if (profilePictureUri) {
      options.push({
        label: 'Remove Photo',
        onPress: removeProfilePicture,
        icon: 'trash-alt',
        destructive: true
      });
    }
    
    return options;
  };

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        showToast('You need to grant camera permissions to take a photo', 'error');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        const uri = result.assets[0].uri;
        // Update both local state and AsyncStorage immediately
        setProfilePictureUri(uri);
        await AsyncStorage.setItem(USER_PROFILE_PICTURE_KEY, uri);
        showToast('Photo added successfully', 'success');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showToast('Failed to take photo', 'error');
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        showToast('You need to grant gallery permissions to select a photo', 'error');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        const uri = result.assets[0].uri;
        // Update both local state and AsyncStorage immediately
        setProfilePictureUri(uri);
        await AsyncStorage.setItem(USER_PROFILE_PICTURE_KEY, uri);
        showToast('Photo selected successfully', 'success');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to select image', 'error');
    }
  };

  const removeProfilePicture = async () => {
    try {
      // Update both local state and AsyncStorage immediately
      setProfilePictureUri(null);
      await AsyncStorage.removeItem(USER_PROFILE_PICTURE_KEY);
      showToast('Profile picture removed', 'success');
    } catch (error) {
      console.error('Error removing profile picture:', error);
      showToast('Failed to remove profile picture', 'error');
    }
  };

  // Create a divider component
  const Divider = () => (
    <View style={[styles.divider, { backgroundColor: colors.border }]} />
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          title: "Profile",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      
      {ThemeSelectionModal()}
      
      {/* Profile picture action sheet */}
      <ActionSheet
        visible={actionSheetVisible}
        title="Profile Picture"
        options={getActionSheetOptions()}
        onClose={() => setActionSheetVisible(false)}
      />
      
      {/* Reset Database Confirmation Modal */}
      <ConfirmationModal
        visible={resetConfirmationVisible}
        title="Reset All Data"
        message="This will delete all your data and reset the app to its initial state. This action cannot be undone. Are you sure you want to continue?"
        confirmText="Reset"
        cancelText="Cancel"
        confirmStyle="destructive"
        icon="trash-alt"
        onConfirm={confirmReset}
        onCancel={() => setResetConfirmationVisible(false)}
      />
      
      {/* Profile Header with Gradient Background */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.headerGradient}
      >
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.editProfileButton}
            onPress={() => router.push('/profile/edit')}
            accessibilityLabel="Edit profile"
            accessibilityHint="Navigate to the edit profile screen"
          >
            <FontAwesome5 name="edit" size={16} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handleProfilePictureChange}
            accessibilityLabel="Change profile picture"
            accessibilityHint="Opens options to change or remove your profile picture"
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.6)']}
              style={styles.avatarGradient}
            >
              {profilePictureUri ? (
                <Image 
                  source={{ uri: profilePictureUri }} 
                  style={styles.profileImage} 
                  resizeMode="cover"
                />
              ) : (
              <FontAwesome5 name="user" size={40} color={colors.primary} />
              )}
              
              <View style={styles.cameraIconContainer}>
                <FontAwesome5 name="camera" size={14} color="white" />
          </View>
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={[styles.profileName, {color: 'white'}]}>{userName}</Text>
          
          {/* Replace horizontal pills with vertical icon layout */}
          {(userAge || userGender || userFitnessGoal || userActivityLevel) && (
            <View style={styles.profileInfoVertical}>
              {userAge && (
                <View style={styles.infoItem}>
                  <FontAwesome5 name="calendar-alt" size={14} color="white" style={styles.infoIcon} />
                  <Text style={styles.infoText}>{userAge} years</Text>
                </View>
              )}
              {userGender && (
                <View style={styles.infoItem}>
                  <FontAwesome5 name={userGender === 'Male' ? 'mars' : userGender === 'Female' ? 'venus' : 'genderless'} size={14} color="white" style={styles.infoIcon} />
                  <Text style={styles.infoText}>{userGender}</Text>
                </View>
              )}
              {userFitnessGoal && (
                <View style={styles.infoItem}>
                  <FontAwesome5 name="bullseye" size={14} color="white" style={styles.infoIcon} />
                  <Text style={styles.infoText}>{userFitnessGoal}</Text>
                </View>
              )}
              {userActivityLevel && (
                <View style={styles.infoItem}>
                  <FontAwesome5 name="running" size={14} color="white" style={styles.infoIcon} />
                  <Text style={styles.infoText}>{userActivityLevel}</Text>
                </View>
              )}
            </View>
          )}
          
          {/* Streak indicator */}
          <View style={styles.streakContainer}>
            <View style={styles.streakDots}>
              {renderStreakDots()}
            </View>
            <Text style={[styles.streakText, {color: 'white'}]}>{workoutStats.streakDays} day streak</Text>
          </View>
        </View>
      </LinearGradient>
      
      {/* Stats Cards */}
      <View style={styles.statsCardsContainer}>
        <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{workoutStats.totalWorkouts}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Workouts</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{workoutStats.totalExercises}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Exercises</Text>
            </View>
          </View>
          <View style={[styles.statDividerHorizontal, { backgroundColor: colors.border }]} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{workoutStats.daysActive}</Text>
              <Text style={[styles.statLabel, { color: colors.subtext }]}>Days Active</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity 
              style={styles.statItem}
              onPress={() => router.push('/progress')}
            >
              <LinearGradient
                colors={[colors.primary, colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.viewProgressButton}
              >
                <Text style={styles.viewProgressText}>View Progress</Text>
                <FontAwesome5 name="trophy" size={14} color="white" style={styles.viewProgressIcon} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Settings Sections */}
      <View style={styles.settingsSections}>
        {/* Personal Information Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <FontAwesome5 name="user" size={18} color={colors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
          </View>
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => router.push('/profile/edit')}
          >
            <View style={styles.settingLabelContainer}>
              <View style={[styles.iconBadge, { backgroundColor: colors.primaryLight || 'rgba(78, 84, 200, 0.1)' }]}>
                <FontAwesome5 name="user-edit" size={16} color={colors.primary} style={styles.settingIcon} />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Edit Profile</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Update your personal information and fitness goals
                </Text>
              </View>
            </View>
            <View style={[styles.arrowContainer, { backgroundColor: `${colors.border}30` }]}>
              <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
            </View>
          </TouchableOpacity>
          
          <Divider />
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => router.push('/measurements')}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="ruler" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Body Measurements</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Track weight, height, and body measurements
                </Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Unit Preferences Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <FontAwesome5 name="ruler-combined" size={18} color={colors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Unit Preferences</Text>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="weight" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Weight Unit</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Set your preferred weight unit for tracking
                </Text>
              </View>
            </View>
            
            <View style={styles.weightUnitToggle}>
              <Text
                style={[styles.unitLabel, { color: !useKilograms ? colors.primary : colors.subtext }]}
              >
                lb
              </Text>
              <Switch
                value={useKilograms}
                onValueChange={toggleWeightUnit}
                trackColor={{ false: Platform.OS === 'ios' ? colors.border : colors.border, true: colors.primary }}
                thumbColor={Platform.OS === 'ios' ? 'white' : useKilograms ? 'white' : colors.card}
                ios_backgroundColor={colors.border}
                style={styles.switch}
              />
              <Text
                style={[styles.unitLabel, { color: useKilograms ? colors.primary : colors.subtext }]}
              >
                kg
              </Text>
            </View>
          </View>
          
          <Divider />
          
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="ruler" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Length Unit</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Set your preferred unit for body measurements
                </Text>
              </View>
            </View>
            
            <View style={styles.weightUnitToggle}>
              <Text
                style={[styles.unitLabel, { color: !useCentimeters ? colors.primary : colors.subtext }]}
              >
                in
              </Text>
              <Switch
                value={useCentimeters}
                onValueChange={toggleLengthUnit}
                trackColor={{ false: Platform.OS === 'ios' ? colors.border : colors.border, true: colors.primary }}
                thumbColor={Platform.OS === 'ios' ? 'white' : useCentimeters ? 'white' : colors.card}
                ios_backgroundColor={colors.border}
                style={styles.switch}
              />
              <Text
                style={[styles.unitLabel, { color: useCentimeters ? colors.primary : colors.subtext }]}
              >
                cm
              </Text>
            </View>
          </View>
        </View>

        {/* App Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <FontAwesome5 name="cog" size={18} color={colors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>App Settings</Text>
          </View>
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => router.push('/notification-settings')}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="bell" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Notifications</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Manage workout reminders and notifications
                </Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
          </TouchableOpacity>
          
          <Divider />
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => setThemeModalVisible(true)}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="palette" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Appearance</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Customize app theme and appearance
                </Text>
              </View>
            </View>
            <View style={styles.themeSelector}>
              <Text style={[styles.themeValue, { color: colors.text }]}>
                {theme === 'system' 
                  ? 'System'
                  : theme === 'dark'
                    ? 'Dark'
                    : 'Light'
                }
              </Text>
              <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
            </View>
          </TouchableOpacity>
          
          <Divider />
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => showToast('Language options will be available in a future update.', 'info')}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="language" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Language</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Change app language
                </Text>
              </View>
            </View>
            <View style={styles.comingSoonContainer}>
              <Text style={[styles.comingSoonLabel, { color: colors.accent }]}>Coming Soon</Text>
              <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Data Management Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <FontAwesome5 name="database" size={18} color={colors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>
          </View>
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={handleImportRoutine}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="file-import" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Import Routine</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Import a routine shared by others
                </Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
          </TouchableOpacity>
          
          <Divider />
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={handleImportData}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="database" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Import Data</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Restore data from a previous export
                </Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
          </TouchableOpacity>
          
          <Divider />
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={handleExportData}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="file-export" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Export Data</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Export your workout data to a file
                </Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
          </TouchableOpacity>
          
          <Divider />
          
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={handleResetDatabase}
          >
            <FontAwesome5 name="trash-alt" size={18} color={colors.error} style={styles.dangerIcon} />
            <Text style={[styles.dangerButtonText, { color: colors.error }]}>Reset All Data</Text>
          </TouchableOpacity>
        </View>
        
        {/* About Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <FontAwesome5 name="info-circle" size={18} color={colors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="code" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Version</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  TrackFit v1.0.0
                </Text>
              </View>
            </View>
          </View>
          
          <Divider />
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('mailto:danisalfonso.dev@gmail.com')}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="envelope" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Contact Support</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  danisalfonso.dev@gmail.com
                </Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
          </TouchableOpacity>
          
          <Divider />
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.danisalfonso.trackfit')}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="star" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Rate the App</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Like TrackFit? Leave a review
                </Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
          </TouchableOpacity>
          
          <Divider />
          
          <TouchableOpacity
            style={styles.settingItem}
            activeOpacity={0.7}
            onPress={() => {
              const message = "Check out TrackFit, a great workout tracker app I've been using: https://play.google.com/store/apps/details?id=com.danisalfonso.trackfit";
              Share.share({
                message,
                title: "Share TrackFit"
              });
            }}
          >
            <View style={styles.settingLabelContainer}>
              <FontAwesome5 name="share-alt" size={18} color={colors.primary} style={styles.settingIcon} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Share with Friends</Text>
                <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                  Spread the word about TrackFit
                </Text>
              </View>
            </View>
            <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerGradient: {
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderRadius: 50,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 26,
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  streakContainer: {
    alignItems: 'center',
  },
  streakDots: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsCardsContainer: {
    paddingHorizontal: 16,
    marginTop: -30,
    marginBottom: 16,
  },
  statsCard: {
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
    padding: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 10,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  statDividerHorizontal: {
    height: 1,
    width: '90%',
    alignSelf: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 14,
  },
  viewProgressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  viewProgressText: {
    fontSize: 14,
    marginRight: 8,
    fontWeight: '600',
    color: 'white',
  },
  viewProgressIcon: {
    marginLeft: 2,
  },
  settingsSections: {
    paddingHorizontal: 16,
    paddingBottom: 50,
  },
  sectionCard: {
    borderRadius: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingVertical: 18,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.7,
  },
  settingIcon: {
    marginRight: 12,
    width: 25,
    alignItems: 'center',
    textAlign: 'center',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  weightUnitToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    minWidth: 90,
    justifyContent: 'flex-end',
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 4,
  },
  switch: {
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.75 }, { scaleY: 0.75 }] : [],
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginVertical: 10,
  },
  dangerIcon: {
    marginRight: 10,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  comingSoonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  themeOptionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeIcon: {
    marginRight: 16,
    width: 24,
    textAlign: 'center',
  },
  themeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  themeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  editProfileButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 8,
    borderRadius: 20,
  },
  profileInfoVertical: {
    alignItems: 'flex-start',
    marginTop: 15,
    marginBottom: 20,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 250,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    width: '100%',
  },
  infoIcon: {
    marginRight: 10,
    width: 20,
    textAlign: 'center',
  },
  infoText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  arrowContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(78, 84, 200, 0.9)',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
}); 