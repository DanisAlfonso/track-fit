import * as Notifications from 'expo-notifications';

export interface RestNotificationData extends Record<string, unknown> {
  type: 'rest-complete';
  exerciseName: string;
  setNumber: number;
}

/**
 * Schedule a notification for when rest time is complete
 */
export const scheduleRestCompleteNotification = async (
  restTimeSeconds: number,
  exerciseName: string,
  setNumber: number
): Promise<string> => {
  const notificationId = `rest-timer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest Time Complete! 💪',
        body: `Time for your next set${exerciseName ? ` of ${exerciseName}` : ''}!`,
        data: {
          type: 'rest-complete',
          exerciseName: exerciseName || 'Unknown Exercise',
          setNumber: setNumber
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
    throw error;
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