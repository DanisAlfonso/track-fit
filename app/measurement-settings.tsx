import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Switch, 
  TextInput,
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { useTheme } from '@/context/ThemeContext';

type MeasurementType = 'weight' | 'height' | 'chest' | 'waist' | 'hips' | 'biceps' | 'thighs' | 'calves' | 'custom';

type MeasurementSetting = {
  key: MeasurementType;
  label: string;
  icon: string;
  unit: string;
  isTracking: boolean;
  customName?: string;
};

export default function MeasurementSettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MeasurementSetting[]>([
    { key: 'weight', label: 'Weight', icon: 'weight', unit: 'kg', isTracking: true },
    { key: 'height', label: 'Height', icon: 'ruler-vertical', unit: 'cm', isTracking: true },
    { key: 'chest', label: 'Chest', icon: 'tshirt', unit: 'cm', isTracking: false },
    { key: 'waist', label: 'Waist', icon: 'ruler', unit: 'cm', isTracking: false },
    { key: 'hips', label: 'Hips', icon: 'ruler', unit: 'cm', isTracking: false },
    { key: 'biceps', label: 'Biceps', icon: 'dumbbell', unit: 'cm', isTracking: false },
    { key: 'thighs', label: 'Thighs', icon: 'running', unit: 'cm', isTracking: false },
    { key: 'calves', label: 'Calves', icon: 'shoe-prints', unit: 'cm', isTracking: false }
  ]);
  const [editingName, setEditingName] = useState<{key: MeasurementType, value: string} | null>(null);
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      
      // Create the measurement_preferences table if it doesn't exist
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS measurement_preferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL UNIQUE,
          is_tracking INTEGER NOT NULL DEFAULT 0,
          custom_name TEXT
        )
      `);
      
      // Load preferences
      const preferences = await db.getAllAsync<{type: MeasurementType, is_tracking: number, custom_name: string | null}>(`
        SELECT type, is_tracking, custom_name FROM measurement_preferences
      `);
      
      if (preferences.length > 0) {
        // Update settings with saved preferences
        const updatedSettings = [...settings];
        preferences.forEach(pref => {
          const index = updatedSettings.findIndex(m => m.key === pref.type);
          if (index > -1) {
            updatedSettings[index].isTracking = pref.is_tracking === 1;
            if (pref.custom_name) {
              updatedSettings[index].customName = pref.custom_name;
            }
          }
        });
        setSettings(updatedSettings);
      } else {
        // Initialize with defaults
        for (const measure of settings) {
          await db.runAsync(`
            INSERT OR IGNORE INTO measurement_preferences (type, is_tracking)
            VALUES (?, ?)
          `, [measure.key, measure.isTracking ? 1 : 0]);
        }
      }
    } catch (error) {
      console.error('Error loading measurement settings:', error);
      Alert.alert('Error', 'Failed to load measurement settings');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleTracking = async (key: MeasurementType) => {
    try {
      setLoading(true);
      const db = await getDatabase();
      
      const settingIndex = settings.findIndex(s => s.key === key);
      if (settingIndex === -1) return;
      
      const newIsTracking = !settings[settingIndex].isTracking;
      
      // Update database
      await db.runAsync(`
        UPDATE measurement_preferences
        SET is_tracking = ?
        WHERE type = ?
      `, [newIsTracking ? 1 : 0, key]);
      
      // Update state
      const updatedSettings = [...settings];
      updatedSettings[settingIndex].isTracking = newIsTracking;
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error updating measurement tracking:', error);
      Alert.alert('Error', 'Failed to update setting');
    } finally {
      setLoading(false);
    }
  };
  
  const saveCustomName = async (key: MeasurementType, name: string) => {
    try {
      setLoading(true);
      const db = await getDatabase();
      
      if (!name.trim()) {
        // If name is empty, revert to default
        await db.runAsync(`
          UPDATE measurement_preferences
          SET custom_name = NULL
          WHERE type = ?
        `, [key]);
        
        const settingIndex = settings.findIndex(s => s.key === key);
        if (settingIndex !== -1) {
          const updatedSettings = [...settings];
          delete updatedSettings[settingIndex].customName;
          setSettings(updatedSettings);
        }
      } else {
        // Save custom name
        await db.runAsync(`
          UPDATE measurement_preferences
          SET custom_name = ?
          WHERE type = ?
        `, [name.trim(), key]);
        
        const settingIndex = settings.findIndex(s => s.key === key);
        if (settingIndex !== -1) {
          const updatedSettings = [...settings];
          updatedSettings[settingIndex].customName = name.trim();
          setSettings(updatedSettings);
        }
      }
      
      setEditingName(null);
    } catch (error) {
      console.error('Error saving custom name:', error);
      Alert.alert('Error', 'Failed to save custom name');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: "Measurement Settings",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.subtext }]}>
              Loading settings...
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.headerText, { color: colors.text }]}>
              Manage Measurements
            </Text>
            <Text style={[styles.subHeaderText, { color: colors.subtext }]}>
              Choose which measurements to track and customize their names
            </Text>
            
            <ScrollView style={styles.settingsList}>
              {settings.map((setting) => (
                <View 
                  key={setting.key}
                  style={[styles.settingItem, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.settingMain}>
                    <View style={styles.settingIcon}>
                      <FontAwesome5 
                        name={setting.icon} 
                        size={20} 
                        color={setting.isTracking ? colors.primary : colors.subtext} 
                      />
                    </View>
                    
                    <View style={styles.settingInfo}>
                      {editingName && editingName.key === setting.key ? (
                        <TextInput
                          style={[
                            styles.nameInput,
                            { 
                              color: colors.text,
                              borderColor: colors.border,
                              backgroundColor: colors.card
                            }
                          ]}
                          value={editingName.value}
                          onChangeText={(text) => setEditingName({ key: setting.key, value: text })}
                          placeholder={setting.label}
                          placeholderTextColor={colors.subtext}
                          autoFocus
                          onBlur={() => saveCustomName(setting.key, editingName.value)}
                          onSubmitEditing={() => saveCustomName(setting.key, editingName.value)}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => setEditingName({ 
                            key: setting.key, 
                            value: setting.customName || setting.label 
                          })}
                        >
                          <View style={styles.nameContainer}>
                            <Text style={[styles.settingName, { color: colors.text }]}>
                              {setting.customName || setting.label}
                            </Text>
                            <FontAwesome5 
                              name="pencil-alt" 
                              size={12} 
                              color={colors.subtext} 
                              style={styles.editIcon}
                            />
                          </View>
                        </TouchableOpacity>
                      )}
                      
                      <Text style={[styles.settingUnit, { color: colors.subtext }]}>
                        Unit: {setting.unit}
                      </Text>
                    </View>
                  </View>
                  
                  <Switch
                    value={setting.isTracking}
                    onValueChange={() => toggleTracking(setting.key)}
                    trackColor={{ 
                      false: colors.border, 
                      true: colors.primary
                    }}
                    thumbColor={colors.card}
                  />
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.infoContainer}>
              <Text style={[styles.infoText, { color: colors.subtext }]}>
                Toggle the switch to track or hide a measurement. Tap on the name to customize it.
              </Text>
            </View>
            
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => router.back()}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 12,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subHeaderText: {
    fontSize: 16,
    marginBottom: 24,
  },
  settingsList: {
    flex: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  editIcon: {
    marginLeft: 8,
  },
  settingUnit: {
    fontSize: 14,
  },
  nameInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  infoContainer: {
    marginVertical: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
  },
  doneButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  }
}); 