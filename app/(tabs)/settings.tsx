import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { resetDatabase, getDatabase } from '@/utils/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const WEIGHT_UNIT_STORAGE_KEY = 'weight_unit_preference';
export type WeightUnit = 'kg' | 'lb';

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

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const [useKilograms, setUseKilograms] = useState(true);

  useEffect(() => {
    // Load saved preference
    const loadWeightUnitPreference = async () => {
      const unit = await getWeightUnitPreference();
      setUseKilograms(unit === 'kg');
    };

    loadWeightUnitPreference();
  }, []);

  const handleResetDatabase = () => {
    Alert.alert(
      'Reset Database',
      'This will delete all your data and reset the app to its initial state. This action cannot be undone. Are you sure you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: async () => {
            try {
              await resetDatabase();
              Alert.alert('Success', 'Database has been reset successfully. Please restart the app.');
            } catch (error) {
              console.error('Error resetting database:', error);
              Alert.alert('Error', 'Failed to reset the database. Please try again.');
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          title: "Settings",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Workout Preferences</Text>
        
        <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
          <View style={styles.settingLabelContainer}>
            <FontAwesome5 name="weight" size={18} color={colors.primary} style={styles.settingIcon} />
            <View>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Weight Unit</Text>
              <Text style={[styles.settingDescription, { color: colors.subtext }]}>
                Set your preferred weight unit for workout tracking
              </Text>
            </View>
          </View>
          
          <View style={styles.weightUnitToggle}>
            <Text style={[styles.unitLabel, { color: !useKilograms ? colors.primary : colors.subtext }]}>lb</Text>
            <Switch
              value={useKilograms}
              onValueChange={toggleWeightUnit}
              trackColor={{ false: Platform.OS === 'ios' ? colors.border : colors.border, true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? 'white' : useKilograms ? 'white' : colors.card}
              ios_backgroundColor={colors.border}
              style={styles.switch}
            />
            <Text style={[styles.unitLabel, { color: useKilograms ? colors.primary : colors.subtext }]}>kg</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Database</Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.error }]}
          onPress={handleResetDatabase}
        >
          <Text style={styles.buttonText}>Reset Database</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
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
  },
  unitLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  switch: {
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [],
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 