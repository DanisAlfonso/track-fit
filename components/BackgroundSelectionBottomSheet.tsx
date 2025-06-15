import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  FlatList,
  useColorScheme
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import Colors from '@/constants/Colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height, width } = Dimensions.get('window');

interface BackgroundOption {
  id: string;
  name: string;
  type: 'solid' | 'gradient';
  colors?: string[];
}

interface BackgroundSelectionBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectBackground: (backgroundId: string) => void;
  backgroundOptions: BackgroundOption[];
  selectedBackgroundId?: string;
}

export const BackgroundSelectionBottomSheet: React.FC<BackgroundSelectionBottomSheetProps> = ({
  visible,
  onClose,
  onSelectBackground,
  backgroundOptions,
  selectedBackgroundId
}) => {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const insets = useSafeAreaInsets();
  
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      // Show animation
      requestAnimationFrame(() => {
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
      });
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

  const handleBackdropPress = () => {
    onClose();
  };

  const handleSelectBackground = (backgroundId: string) => {
    onSelectBackground(backgroundId);
    onClose();
  };

  const renderBackgroundOption = ({ item }: { item: BackgroundOption }) => (
    <TouchableOpacity
      style={[
        styles.backgroundOption,
        {
          borderColor: selectedBackgroundId === item.id ? colors.primary : colors.border,
          borderWidth: selectedBackgroundId === item.id ? 2 : 1,
        }
      ]}
      onPress={() => handleSelectBackground(item.id)}
    >
      {item.type === 'gradient' && item.colors ? (
        <LinearGradient
          colors={item.colors as [string, string, ...string[]]}
          style={styles.backgroundPreview}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      ) : (
        <View style={[styles.backgroundPreview, { backgroundColor: colors.card }]} />
      )}
      <Text style={[styles.backgroundOptionName, { color: colors.text }]}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  paddingBottom: insets.bottom,
                  transform: [{ translateY: sheetTranslateY }],
                },
              ]}
            >
              <BlurView
                intensity={100}
                tint={currentTheme}
                style={StyleSheet.absoluteFillObject}
              />
              
              {/* Handle bar */}
              <View style={styles.handleContainer}>
                <View style={[styles.handle, { backgroundColor: colors.border }]} />
              </View>
              
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.text }]}>Choose Background</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <MaterialIcons name="close" size={24} color={colors.subtext} />
                </TouchableOpacity>
              </View>
              
              {/* Background options grid */}
              <FlatList
                data={backgroundOptions}
                numColumns={2}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.backgroundGrid}
                showsVerticalScrollIndicator={false}
                renderItem={renderBackgroundOption}
              />
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  backgroundGrid: {
    padding: 20,
    paddingBottom: 40,
  },
  backgroundOption: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  backgroundPreview: {
    height: 100,
    width: '100%',
  },
  backgroundOptionName: {
    padding: 12,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
});