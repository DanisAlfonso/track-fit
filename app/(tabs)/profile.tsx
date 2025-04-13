import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, Switch, Platform, ScrollView, Image, Text, Modal } from 'react-native';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { resetDatabase, getDatabase } from '@/utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

export const WEIGHT_UNIT_STORAGE_KEY = 'weight_unit_preference';
export type WeightUnit = 'kg' | 'lb';
const USER_NAME_KEY = 'user_name';

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

// Conversion functions
export const kgToLb = (kg: number): number => {
  return kg * 2.20462;
};

export const lbToKg = (lb: number): number => {
  return lb / 2.20462;
};

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const { theme, setTheme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const [useKilograms, setUseKilograms] = useState(true);
  const [userName, setUserName] = useState('Fitness Enthusiast');
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [workoutStats, setWorkoutStats] = useState({
    totalWorkouts: 0,
    totalExercises: 0,
    daysActive: 0,
    streakDays: 0
  });

  useEffect(() => {
    // Load saved preference and stats
    const loadData = async () => {
      // Load weight unit preference
      const unit = await getWeightUnitPreference();
      setUseKilograms(unit === 'kg');
      
      // Load user name if saved
      try {
        const name = await AsyncStorage.getItem(USER_NAME_KEY);
        if (name) setUserName(name);
      } catch (error) {
        console.error('Error loading user name:', error);
      }
      
      // Load workout stats
      loadWorkoutStats();
    };

    loadData();
  }, []);
  
  const loadWorkoutStats = async () => {
    try {
      const db = await getDatabase();
      
      const workoutsCount = await db.getFirstAsync<{count: number}>(`
        SELECT COUNT(*) as count FROM workouts WHERE completed_at IS NOT NULL
      `);
      
      const exercisesCount = await db.getFirstAsync<{count: number}>(`
        SELECT COUNT(*) as count FROM workout_exercises
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
    Alert.alert(
      'Reset All Data',
      'This will delete all your data and reset the app to its initial state. This action cannot be undone. Are you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              await resetDatabase();
              Alert.alert('Success', 'All data has been reset successfully. Please restart the app.');
            } catch (error) {
              console.error('Error resetting database:', error);
              Alert.alert('Error', 'Failed to reset the data. Please try again.');
            }
          }
        }
      ]
    );
  };

  const toggleWeightUnit = async (value: boolean) => {
    setUseKilograms(value);
    await setWeightUnitPreference(value ? 'kg' : 'lb');
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
      
      {/* Profile Header with Gradient Background */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={styles.headerGradient}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.6)']}
              style={styles.avatarGradient}
            >
              <FontAwesome5 name="user" size={40} color={colors.primary} />
            </LinearGradient>
          </View>
          <Text style={[styles.profileName, {color: 'white'}]}>{userName}</Text>
          
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
              onPress={() => Alert.alert('Coming Soon', 'Progress charts will be available in a future update.')}
            >
              <View style={styles.viewProgressButton}>
                <Text style={[styles.viewProgressText, { color: colors.text }]}>View Progress</Text>
                <FontAwesome5 name="chart-bar" size={14} color={colors.primary} style={styles.viewProgressIcon} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {/* Settings Sections */}
      <View style={styles.settingsSections}>
        {/* Workout Preferences Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <FontAwesome5 name="sliders-h" size={18} color={colors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Workout Preferences</Text>
          </View>
          
          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
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
        </View>

        {/* App Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <FontAwesome5 name="cog" size={18} color={colors.primary} style={styles.sectionIcon} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>App Settings</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming Soon', 'This feature will be available in a future update.')}
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
          
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
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
                    : 'Light'}
              </Text>
              <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} style={{ marginLeft: 8 }} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming Soon', 'Language options will be available in a future update.')}
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
            style={[styles.settingItem, { borderBottomColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Coming Soon', 'This feature will be available in a future update.')}
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
          
          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
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
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  viewProgressText: {
    fontSize: 14,
    marginRight: 6,
    fontWeight: '500',
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
    borderBottomWidth: 1,
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
}); 