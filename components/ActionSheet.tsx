import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
  useColorScheme
} from 'react-native';
import { BlurView } from 'expo-blur';
import { FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';

const { height } = Dimensions.get('window');

export type ActionSheetOption = {
  label: string;
  onPress: () => void;
  icon?: string;
  destructive?: boolean;
};

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
  cancelLabel?: string;
}

export const ActionSheet: React.FC<ActionSheetProps> = ({
  visible,
  title,
  options,
  onClose,
  cancelLabel = 'Cancel'
}) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const isDark = currentTheme === 'dark';
  
  // Animation values
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(height)).current;
  
  useEffect(() => {
    if (visible) {
      // Show animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide animation
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: height,
          duration: 300,
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
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: backdropOpacity, backgroundColor: 'rgba(0, 0, 0, 0.5)' }
            ]}
          />
        </TouchableWithoutFeedback>
        
        {/* Bottom sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: sheetTranslateY }] }
          ]}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: isDark ? 'rgba(30,30,35,0.98)' : 'rgba(255,255,255,0.98)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
              }
            ]}
          >
            {/* Title */}
            {title && (
              <View style={styles.titleContainer}>
                <Text
                  style={[styles.title, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              </View>
            )}
            
            {/* Options */}
            <View style={styles.optionsContainer}>
              {options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.option,
                    index < options.length - 1 && styles.optionBorder,
                    index < options.length - 1 && {
                      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    },
                  ]}
                  onPress={() => {
                    onClose();
                    setTimeout(() => option.onPress(), 300);
                  }}
                  activeOpacity={0.7}
                >
                  {option.icon && (
                    <FontAwesome5
                      name={option.icon}
                      size={20}
                      color={option.destructive ? colors.error : colors.primary}
                      style={styles.optionIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: option.destructive ? colors.error : colors.text
                      }
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Cancel button */}
            <TouchableOpacity
              style={[styles.cancelButton, { marginTop: 10 }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.cancelText,
                  { color: colors.primary }
                ]}
              >
                {cancelLabel}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Bottom safe area padding */}
          <View style={{ height: Platform.OS === 'ios' ? 20 : 10 }} />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetContainer: {
    paddingHorizontal: 10,
  },
  sheet: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  titleContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionsContainer: {
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  optionBorder: {
    borderBottomWidth: 0.5,
  },
  optionIcon: {
    marginRight: 10,
  },
  optionText: {
    fontSize: 17,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 