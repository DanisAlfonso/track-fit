import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { useColorScheme } from 'react-native';

interface MuscleGroupPopupProps {
  visible: boolean;
  muscleGroups: Record<string, any[]>;
  onSelect: (muscle: string) => void;
  onClose: () => void;
  getMuscleColor: (muscle: string) => string;
}

export const MuscleGroupPopup: React.FC<MuscleGroupPopupProps> = ({
  visible,
  muscleGroups,
  onSelect,
  onClose,
  getMuscleColor,
}) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.musclePopup, { backgroundColor: colors.card }]}> 
            <Text style={[styles.popupTitle, { color: colors.text }]}>Select Muscle Group</Text>
            <ScrollView>
              {Object.keys(muscleGroups).map((muscle) => (
                <TouchableOpacity
                  key={`popup-${muscle}`}
                  style={styles.musclePopupItem}
                  onPress={() => onSelect(muscle)}
                >
                  <View style={[styles.muscleNavDot, { backgroundColor: getMuscleColor(muscle) }]} />
                  <Text style={[styles.musclePopupItemText, { color: colors.text }]}>{muscle}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.popupCloseButton}
              onPress={onClose}
            >
              <Text style={[styles.popupCloseButtonText, { color: colors.primary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  musclePopup: {
    width: '85%',
    maxHeight: '70%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  musclePopupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee', // Will be overridden by parent if needed
  },
  muscleNavDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  musclePopupItemText: {
    fontSize: 16,
    marginLeft: 10,
  },
  popupCloseButton: {
    marginTop: 15,
    paddingVertical: 10,
    alignItems: 'center',
  },
  popupCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 