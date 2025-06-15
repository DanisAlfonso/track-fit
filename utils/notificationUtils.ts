import * as Notifications from 'expo-notifications';
import { getDatabase } from './database';

export interface RestNotificationData extends Record<string, unknown> {
  type: 'rest-complete';
  exerciseName: string;
  setNumber: number;
}

/**
 * Check if a specific notification type is enabled
 */
export const isNotificationEnabled = async (key: string): Promise<boolean> => {
  try {
    const db = await getDatabase();
    
    // Check if all notifications are enabled first
    const allNotificationsResult = await db.getFirstAsync<{enabled: number}>(
      'SELECT enabled FROM notification_preferences WHERE key = ?',
      ['all_notifications']
    );
    
    if (!allNotificationsResult || allNotificationsResult.enabled === 0) {
      return false;
    }
    
    // Get the category for this notification key
    const categoryResult = await db.getFirstAsync<{category: string}>(
      'SELECT category FROM notification_preferences WHERE key = ?',
      [key]
    );
    
    // Check if the category is enabled (e.g., 'timer' for 'timer_complete')
    if (categoryResult && categoryResult.category !== 'system') {
      const categoryEnabled = await db.getFirstAsync<{enabled: number}>(
        'SELECT enabled FROM notification_preferences WHERE key = ?',
        [categoryResult.category]
      );
      
      if (!categoryEnabled || categoryEnabled.enabled === 0) {
        return false;
      }
    }
    
    // Check the specific notification setting
    const specificResult = await db.getFirstAsync<{enabled: number}>(
      'SELECT enabled FROM notification_preferences WHERE key = ?',
      [key]
    );
    
    return specificResult ? specificResult.enabled === 1 : true; // Default to enabled if not found
  } catch (error) {
    console.error('Failed to check notification preference:', error);
    return true; // Default to enabled on error
  }
};

/**
 * Schedule a notification for when rest time is complete
 */
export const scheduleRestCompleteNotification = async (
  exerciseName: string,
  setNumber: number,
  restTimeSeconds: number
): Promise<string | null> => {
  try {
    // Check if timer notifications are enabled
    const timerEnabled = await isNotificationEnabled('timer_complete');
    if (!timerEnabled) {
      console.log('Timer notifications are disabled, skipping notification');
      return null;
    }
    
    const notificationId = `rest-timer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Schedule the notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest Timer Complete! 💪',
        body: `Time to continue with ${exerciseName} - Set ${setNumber + 1}`,
        data: {
          type: 'rest-complete',
          exerciseName,
          setNumber,
        } as RestNotificationData,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: restTimeSeconds,
      },
      identifier: notificationId,
    });
    
    return notificationId;
  } catch (error) {
    console.error('Failed to schedule rest notification:', error);
    return null;
  }
};

/**
 * Cancel a scheduled notification by ID
 */
export const cancelNotification = async (notificationId: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Failed to cancel notification:', error);
    throw error;
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Failed to cancel all notifications:', error);
    throw error;
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Failed to get scheduled notifications:', error);
    return [];
  }
};

/**
 * Check if notifications are enabled
 */
export const areNotificationsEnabled = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Failed to check notification permissions:', error);
    return false;
  }
};

/**
 * Request notification permissions if not already granted
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    }
    
    return true;
  } catch (error) {
    console.error('Failed to request notification permissions:', error);
    return false;
  }
};