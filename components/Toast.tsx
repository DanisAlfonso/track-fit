import React, { useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Animated, 
  Dimensions, 
  TouchableOpacity,
  Platform,
  useColorScheme
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  duration?: number;
  type?: ToastType;
  onHide?: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const getIconName = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return 'check-circle';
    case 'error':
      return 'exclamation-circle';
    case 'info':
    default:
      return 'info-circle';
  }
};

export const Toast: React.FC<ToastProps> = ({ 
  visible, 
  message, 
  duration = 3000, 
  type = 'success',
  onHide,
  action
}) => {
  const { currentTheme } = useTheme();
  const colorScheme = useColorScheme();
  const systemTheme = colorScheme ?? 'light';
  const effectiveTheme = currentTheme || systemTheme;
  const colors = Colors[effectiveTheme];
  
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const timeout = useRef<NodeJS.Timeout | null>(null);

  const getToastColor = () => {
    switch (type) {
      case 'success':
        return colors.primary;
      case 'error':
        return colors.error;
      case 'info':
      default:
        return colors.secondary;
    }
  };

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeout.current) {
        clearTimeout(timeout.current);
      }

      // Show toast animation
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after duration (if not an error)
      if (type !== 'error' && !action) {
        timeout.current = setTimeout(() => {
          hideToast();
        }, duration);
      }
    } else {
      hideToast();
    }

    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    };
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onHide) {
        onHide();
      }
    });
  };

  // Check if animation value is at 0 and not visible
  let opacityValue = 0;
  opacity.addListener(({ value }) => {
    opacityValue = value;
  });
  
  if (!visible && opacityValue === 0) return null;

  const toastColor = getToastColor();
  const iconName = getIconName(type);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.toastWrapper}>
        {/* Solid background with proper corners */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: effectiveTheme === 'dark' 
                ? 'rgba(30,30,35,0.87)' 
                : 'rgba(245,245,250,0.87)',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: effectiveTheme === 'dark'
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(0,0,0,0.05)',
            },
          ]}
        />

        {/* BlurView for additional effect */}
        <BlurView
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
          intensity={effectiveTheme === 'dark' ? 40 : 50}
          tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
        />

        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: toastColor }]}>
            <FontAwesome5 name={iconName} size={14} color="white" />
          </View>
          
          <View style={styles.messageContainer}>
            <Text style={[styles.message, { color: colors.text }]}>
              {message}
            </Text>
          </View>

          {action && (
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => {
                hideToast();
                action.onPress();
              }}
            >
              <Text style={[styles.actionText, { color: toastColor }]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={hideToast}>
            <FontAwesome5 name="times" size={12} color={colors.subtext} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 35,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: 16,
  },
  toastWrapper: {
    width: '100%',
    maxWidth: 500,
    minHeight: 60,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  messageContainer: {
    flex: 1,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
}); 