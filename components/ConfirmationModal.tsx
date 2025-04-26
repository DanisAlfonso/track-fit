import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import Colors from '@/constants/Colors';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import { useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';

const { height } = Dimensions.get('window');

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'destructive' | 'primary';
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmStyle = 'destructive',
  icon,
  onConfirm,
  onCancel
}) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const isDark = currentTheme === 'dark';
  
  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.9)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(modalScale, {
          toValue: 0.9,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Don't render if not visible
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        {/* Backdrop with blur */}
        <Animated.View 
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <BlurView 
            intensity={isDark ? 30 : 25}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        
        {/* Modal content with animation */}
        <Animated.View 
          style={[
            styles.contentWrapper,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }]
            }
          ]}
        >
          <View style={[styles.container, { 
            backgroundColor: isDark 
              ? 'rgba(30, 30, 35, 0.92)' 
              : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            borderWidth: 0.5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.35 : 0.15,
            shadowRadius: 12,
            elevation: 10,
          }]}>
            {icon && (
              <View style={[styles.iconContainer, { 
                backgroundColor: confirmStyle === 'destructive' 
                  ? `${colors.error}25` 
                  : `${colors.primary}25`,
                borderColor: confirmStyle === 'destructive'
                  ? `${colors.error}50`
                  : `${colors.primary}50`,
                borderWidth: 1,
              }]}>
                <FontAwesome5 
                  name={icon} 
                  size={26} 
                  color={confirmStyle === 'destructive' ? colors.error : colors.primary} 
                />
              </View>
            )}
            
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.subtext }]}>{message}</Text>
            
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.cancelButton, 
                  { 
                    backgroundColor: 'transparent'
                  }
                ]}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={[styles.buttonText, { color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(60, 60, 67, 0.6)' }]}>{cancelText}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.button, 
                  { 
                    backgroundColor: confirmStyle === 'destructive' ? colors.error : colors.primary,
                    shadowColor: confirmStyle === 'destructive' ? colors.error : colors.primary,
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 6,
                  }
                ]}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  contentWrapper: {
    width: '90%',
    maxWidth: 400,
    padding: 20,
  },
  container: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    overflow: 'hidden',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  message: {
    fontSize: 16,
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    height: 54,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      }
    }),
  },
  cancelButton: {
    shadowColor: 'transparent',
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
}); 