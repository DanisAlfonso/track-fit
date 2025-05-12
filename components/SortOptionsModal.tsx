import React from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import Colors from '@/constants/Colors';

export type SortOption = 'default' | 'muscle' | 'category';

interface SortOptionsModalProps {
  visible: boolean;
  sortOption: SortOption;
  onSelect: (option: SortOption) => void;
  onClose: () => void;
  onAddExercise?: () => void;
  colors: typeof Colors['light']; // Pass the current theme colors
}

export const SortOptionsModal: React.FC<SortOptionsModalProps> = ({
  visible,
  sortOption,
  onSelect,
  onClose,
  onAddExercise,
  colors,
}) => {
  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[styles.overflowMenu, { backgroundColor: colors.card }]}> 
            <Text style={[styles.menuTitle, { color: colors.text }]}>Workout Options</Text>
            
            {onAddExercise && (
              <>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => {
                    onClose();
                    onAddExercise();
                  }}
                >
                  <FontAwesome5 name="plus-circle" size={16} color={colors.primary} style={styles.menuIcon} />
                  <Text style={[styles.menuItemText, { color: colors.primary }]}>Add Exercise</Text>
                </TouchableOpacity>
                
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              </>
            )}
            
            <Text style={[styles.menuSubtitle, { color: colors.text }]}>Sort Exercises By</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => onSelect('default')}>
              <FontAwesome5 name="sort-numeric-down" size={16} color={sortOption === 'default' ? colors.primary : colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: sortOption === 'default' ? colors.primary : colors.text }]}>Default Order</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => onSelect('muscle')}>
              <FontAwesome5 name="dumbbell" size={16} color={sortOption === 'muscle' ? colors.primary : colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: sortOption === 'muscle' ? colors.primary : colors.text }]}>Muscle Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => onSelect('category')}>
              <FontAwesome5 name="tags" size={16} color={sortOption === 'category' ? colors.primary : colors.text} style={styles.menuIcon} />
              <Text style={[styles.menuItemText, { color: sortOption === 'category' ? colors.primary : colors.text }]}>Category</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overflowMenu: {
    position: 'absolute',
    top: (Platform.OS === 'ios' ? 44 : 0) + 5, // Adjust based on actual header height
    right: 10,
    width: 200,
    borderRadius: 8,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
    opacity: 0.7,
  },
  menuSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 4,
    opacity: 0.7,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuIcon: {
    marginRight: 10,
  },
  menuItemText: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
    marginVertical: 4,
  },
}); 