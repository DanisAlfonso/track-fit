import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Switch, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { useTheme } from '@/context/ThemeContext';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

type NotificationSetting = {
  key: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  category: 'timer' | 'workout' | 'progress' | 'system';
  children?: NotificationSetting[];
  expanded?: boolean;
};

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const isDark = currentTheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [allNotificationsEnabled, setAllNotificationsEnabled] = useState(true);
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      key: 'timer',
      title: 'Timer Notifications',
      description: 'Notifications related to workout timers',
      icon: 'stopwatch',
      enabled: true,
      category: 'timer',
      expanded: false,
      children: [
        {
          key: 'timer_complete',
          title: 'Timer Completion',
          description: 'Notify when rest timer is complete',
          icon: 'bell',
          enabled: true,
          category: 'timer'
        },
        {
          key: 'timer_vibration',
          title: 'Vibration Feedback',
          description: 'Vibrate during countdown (10s, 5s, etc.)',
          icon: 'vibrate',
          enabled: true,
          category: 'timer'
        }
      ]
    }
  ]);
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  const loadSettings = async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      
      // Create the notification_preferences table if it doesn't exist
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          enabled INTEGER NOT NULL DEFAULT 1,
          category TEXT NOT NULL
        )
      `);
      
      // Load preferences
      const preferences = await db.getAllAsync<{key: string, enabled: number, category: string}>(`
        SELECT key, enabled, category FROM notification_preferences
      `);
      
      // Also check the master switch
      const masterPref = await db.getFirstAsync<{enabled: number}>(`
        SELECT enabled FROM notification_preferences WHERE key = 'all_notifications'
      `);
      
      if (masterPref) {
        setAllNotificationsEnabled(masterPref.enabled === 1);
      }
      
      if (preferences.length > 0) {
        // Deep copy of settings to update
        const updatedSettings = JSON.parse(JSON.stringify(settings));
        
        // Update all parent settings
        preferences.forEach(pref => {
          // Find and update the main setting
          const mainSettingIndex = updatedSettings.findIndex((s: NotificationSetting) => s.key === pref.key);
          if (mainSettingIndex > -1) {
            updatedSettings[mainSettingIndex].enabled = pref.enabled === 1;
          }
          
          // Also check children settings
          updatedSettings.forEach((mainSetting: NotificationSetting, mainIndex: number) => {
            if (mainSetting.children) {
              const childIndex = mainSetting.children.findIndex((c: NotificationSetting) => c.key === pref.key);
              if (childIndex > -1) {
                updatedSettings[mainIndex].children[childIndex].enabled = pref.enabled === 1;
              }
            }
          });
        });
        
        setSettings(updatedSettings);
      } else {
        // Initialize with defaults
        // First insert the master switch
        await db.runAsync(`
          INSERT OR IGNORE INTO notification_preferences (key, enabled, category)
          VALUES (?, ?, ?)
        `, ['all_notifications', allNotificationsEnabled ? 1 : 0, 'system']);
        
        // Then insert all the individual settings
        for (const setting of settings) {
          await db.runAsync(`
            INSERT OR IGNORE INTO notification_preferences (key, enabled, category)
            VALUES (?, ?, ?)
          `, [setting.key, setting.enabled ? 1 : 0, setting.category]);
          
          // Also add child settings
          if (setting.children) {
            for (const child of setting.children) {
              await db.runAsync(`
                INSERT OR IGNORE INTO notification_preferences (key, enabled, category)
                VALUES (?, ?, ?)
              `, [child.key, child.enabled ? 1 : 0, child.category]);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleSetting = async (key: string, newValue: boolean) => {
    try {
      if (key === 'all_notifications') {
        setAllNotificationsEnabled(newValue);
      } else {
        const updatedSettings = JSON.parse(JSON.stringify(settings));
        
        // Update the specific setting
        for (let i = 0; i < updatedSettings.length; i++) {
          if (updatedSettings[i].key === key) {
            updatedSettings[i].enabled = newValue;
            break;
          }
          
          // Check children
          if (updatedSettings[i].children) {
            for (let j = 0; j < updatedSettings[i].children.length; j++) {
              if (updatedSettings[i].children[j].key === key) {
                updatedSettings[i].children[j].enabled = newValue;
                break;
              }
            }
          }
        }
        
        setSettings(updatedSettings);
      }
      
      // Save to database
      const db = await getDatabase();
      await db.runAsync(`
        INSERT OR REPLACE INTO notification_preferences (key, enabled, category)
        VALUES (?, ?, (SELECT category FROM notification_preferences WHERE key = ? LIMIT 1))
      `, [key, newValue ? 1 : 0, key]);
      
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
    } catch (error) {
      console.error('Error updating notification setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };
  
  const toggleExpanded = (key: string) => {
    const updatedSettings = JSON.parse(JSON.stringify(settings));
    
    for (let i = 0; i < updatedSettings.length; i++) {
      if (updatedSettings[i].key === key) {
        updatedSettings[i].expanded = !updatedSettings[i].expanded;
        break;
      }
    }
    
    setSettings(updatedSettings);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const renderSetting = (setting: NotificationSetting, isChild = false, parentSetting?: NotificationSetting) => {
    // For child settings, check if parent category is enabled
    const isParentEnabled = isChild && parentSetting ? parentSetting.enabled : true;
    const isEffectivelyEnabled = setting.enabled && allNotificationsEnabled && isParentEnabled;
    const isInteractive = allNotificationsEnabled && isParentEnabled;
    
    return (
      <View key={setting.key}>
        <TouchableOpacity
          style={[
            styles.settingItem, 
            isChild && styles.childSettingItem,
            { borderBottomColor: colors.border }
          ]}
          activeOpacity={0.7}
          onPress={() => setting.children && !isChild ? toggleExpanded(setting.key) : null}
        >
          <View style={styles.settingMain}>
            <View style={[
              styles.settingIcon, 
              { backgroundColor: isEffectivelyEnabled ? colors.primary + '20' : colors.border + '50' }
            ]}>
              <FontAwesome5 
                name={setting.icon} 
                size={isChild ? 14 : 16} 
                color={isEffectivelyEnabled ? colors.primary : colors.subtext} 
              />
            </View>
            
            <View style={styles.settingInfo}>
              <Text style={[
                styles.settingTitle, 
                { 
                  color: isInteractive ? colors.text : colors.subtext,
                  fontSize: isChild ? 15 : 16
                }
              ]}>
                {setting.title}
              </Text>
              <Text style={[
                styles.settingDescription, 
                { 
                  color: isInteractive ? colors.subtext : colors.subtext + '80',
                  fontSize: isChild ? 13 : 14
                }
              ]}>
                {setting.description}
              </Text>
            </View>
          </View>
          
          <View style={styles.settingActions}>
            {setting.children && !isChild ? (
              <TouchableOpacity 
                onPress={() => toggleExpanded(setting.key)}
                hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
                style={styles.expandButton}
              >
                <FontAwesome5 
                  name={setting.expanded ? "chevron-up" : "chevron-down"} 
                  size={14} 
                  color={colors.subtext}
                />
              </TouchableOpacity>
            ) : null}
            
            <Switch
              value={isEffectivelyEnabled}
              onValueChange={(value) => toggleSetting(setting.key, value)}
              trackColor={{ 
                false: colors.border, 
                true: colors.primary + (Platform.OS === 'ios' ? '' : '90')
              }}
              thumbColor={Platform.OS === 'ios' ? 
                (isEffectivelyEnabled ? 'white' : 'white') : 
                (isEffectivelyEnabled ? colors.primary : colors.card)}
              disabled={!isInteractive && setting.key !== 'all_notifications'}
              style={{ opacity: isInteractive || setting.key === 'all_notifications' ? 1 : 0.6 }}
            />
          </View>
        </TouchableOpacity>
        
        {/* Render children if expanded */}
        {setting.children && setting.expanded ? (
          <View style={[styles.childrenContainer, { backgroundColor: isDark ? colors.card + '80' : colors.background + '80' }]}>
            {setting.children.map(child => renderSetting(child, true, setting))}
          </View>
        ) : null}
      </View>
    );
  };
  
  return (
    <>
      <Stack.Screen 
        options={{
          title: "Notification Settings",
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.subtext }]}>
              Loading settings...
            </Text>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Master toggle card */}
            <View style={[styles.masterCard, { backgroundColor: colors.card }]}>
              <View style={[styles.masterIconContainer, { backgroundColor: allNotificationsEnabled ? colors.primary + '20' : colors.border + '30' }]}>
                <FontAwesome5 
                  name="bell" 
                  size={22} 
                  color={allNotificationsEnabled ? colors.primary : colors.subtext}
                />
              </View>
              
              <View style={styles.masterContent}>
                <Text style={[styles.masterTitle, { color: colors.text }]}>
                  All Notifications
                </Text>
                <Text style={[styles.masterDescription, { color: colors.subtext }]}>
                  {allNotificationsEnabled ? 
                    "Notifications are currently enabled" : 
                    "All notifications are turned off"}
                </Text>
              </View>
              
              <Switch
                value={allNotificationsEnabled}
                onValueChange={(value) => toggleSetting('all_notifications', value)}
                trackColor={{ 
                  false: colors.border, 
                  true: colors.primary + (Platform.OS === 'ios' ? '' : '90')
                }}
                thumbColor={Platform.OS === 'ios' ? 
                  'white' : 
                  (allNotificationsEnabled ? colors.primary : colors.card)}
                style={styles.masterSwitch}
              />
            </View>
            
            {/* Category explanation */}
            <View style={styles.sectionHeaderContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Notification Categories
              </Text>
              <Text style={[styles.sectionDescription, { color: colors.subtext }]}>
                Customize which notifications you'd like to receive
              </Text>
            </View>
            
            {/* Settings list */}
            <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
              {settings.map(setting => renderSetting(setting))}
            </View>
            
            {/* Info text */}
            <View style={[styles.infoContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
              <Text style={[styles.infoText, { color: colors.subtext }]}>
                Disabling all notifications will override individual settings. Some critical system notifications may still be shown.
              </Text>
            </View>
            
            {/* Done button */}
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.primary }]}
              onPress={() => router.back()}
            >
              <Text style={styles.doneButtonText}>Save Settings</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
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
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  masterIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  masterContent: {
    flex: 1,
  },
  masterTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  masterDescription: {
    fontSize: 14,
  },
  masterSwitch: {
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.9 }, { scaleY: 0.9 }] : [],
  },
  sectionHeaderContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 15,
    lineHeight: 20,
  },
  settingsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  childSettingItem: {
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  settingMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 10,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 3,
  },
  settingDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  settingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expandButton: {
    padding: 8,
    marginRight: 6,
  },
  childrenContainer: {
    paddingLeft: 10,
  },
  infoContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  }
});