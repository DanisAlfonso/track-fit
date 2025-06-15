import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

/**
 * Define the background notification task
 * This must be defined at module scope and imported early in the app
 */
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  if (error) {
    console.error('Background notification task error:', error);
    return;
  }

  if (data) {
    const notificationData = data as any;
    console.log('Background notification received:', notificationData);
    
    // Handle different types of background notifications
    if (notificationData.notification?.request?.content?.data?.type === 'rest-complete') {
      console.log('Rest timer completed in background for:', notificationData.notification.request.content.data.exerciseName);
      // You can add additional background processing here if needed
    }
  }
});

/**
 * Register the background notification task
 * This should be called early in the app lifecycle
 */
export const registerBackgroundNotificationTask = async (): Promise<boolean> => {
  try {
    // Check if TaskManager is available
    const isAvailable = await TaskManager.isAvailableAsync();
    if (!isAvailable) {
      console.warn('TaskManager is not available on this platform');
      return false;
    }

    // Register the task
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('Background notification task registered successfully');
    return true;
  } catch (error) {
    console.error('Failed to register background notification task:', error);
    return false;
  }
};

/**
 * Unregister the background notification task
 */
export const unregisterBackgroundNotificationTask = async (): Promise<void> => {
  try {
    await Notifications.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('Background notification task unregistered');
  } catch (error) {
    console.error('Failed to unregister background notification task:', error);
  }
};

export { BACKGROUND_NOTIFICATION_TASK };