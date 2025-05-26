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
  const isDark = colors.background === Colors.dark.background;

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <View style={[
            styles.overflowMenu, 
            { 
              backgroundColor: colors.card,
              shadowColor: isDark ? '#000' : '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.6 : 0.15,
              shadowRadius: 16,
              elevation: 12,
              borderWidth: isDark ? 1 : 0,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
            }
          ]}> 
            {/* Header */}
            <View style={[styles.menuHeader, { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)' }]}>
              <View style={[styles.headerIconContainer, { backgroundColor: colors.primary + '15' }]}>
                <FontAwesome5 name="cog" size={14} color={colors.primary} />
              </View>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Workout Options</Text>
            </View>
            
            {onAddExercise && (
              <>
                <TouchableOpacity 
                  style={[styles.primaryMenuItem, { backgroundColor: colors.primary + '10' }]} 
                  onPress={() => {
                    onClose();
                    onAddExercise();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.primaryIconContainer, { backgroundColor: colors.primary }]}>
                    <FontAwesome5 name="plus" size={12} color="white" />
                  </View>
                  <View style={styles.primaryTextContainer}>
                    <Text style={[styles.primaryMenuText, { color: colors.primary }]}>Add Exercise</Text>
                    <Text style={[styles.primaryMenuSubtext, { color: colors.primary + 'AA' }]}>Add new exercise to workout</Text>
                  </View>
                  <FontAwesome5 name="chevron-right" size={10} color={colors.primary + '60'} />
                </TouchableOpacity>
                
                <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' }]} />
              </>
            )}
            
            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.menuSubtitle, { color: colors.text }]}>Sort Exercises By</Text>
            </View>
            
            {/* Sort Options */}
            <TouchableOpacity 
              style={[
                styles.menuItem,
                sortOption === 'default' && { backgroundColor: colors.primary + '08' }
              ]} 
              onPress={() => onSelect('default')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                sortOption === 'default' && { backgroundColor: colors.primary },
                sortOption !== 'default' && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)' }
              ]}>
                <FontAwesome5 
                  name="sort-numeric-down" 
                  size={12} 
                  color={sortOption === 'default' ? 'white' : colors.text} 
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.menuItemText, { color: sortOption === 'default' ? colors.primary : colors.text }]}>
                  Default Order
                </Text>
                <Text style={[styles.menuItemSubtext, { color: sortOption === 'default' ? colors.primary + 'CC' : colors.subtext }]}>
                  Original routine order
                </Text>
              </View>
              {sortOption === 'default' && (
                <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]}>
                  <FontAwesome5 name="check" size={8} color="white" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.menuItem,
                sortOption === 'muscle' && { backgroundColor: colors.primary + '08' }
              ]} 
              onPress={() => onSelect('muscle')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                sortOption === 'muscle' && { backgroundColor: colors.primary },
                sortOption !== 'muscle' && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)' }
              ]}>
                <FontAwesome5 
                  name="dumbbell" 
                  size={12} 
                  color={sortOption === 'muscle' ? 'white' : colors.text} 
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.menuItemText, { color: sortOption === 'muscle' ? colors.primary : colors.text }]}>
                  Muscle Group
                </Text>
                <Text style={[styles.menuItemSubtext, { color: sortOption === 'muscle' ? colors.primary + 'CC' : colors.subtext }]}>
                  Group by target muscle
                </Text>
              </View>
              {sortOption === 'muscle' && (
                <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]}>
                  <FontAwesome5 name="check" size={8} color="white" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.menuItem,
                sortOption === 'category' && { backgroundColor: colors.primary + '08' }
              ]} 
              onPress={() => onSelect('category')}
              activeOpacity={0.7}
            >
              <View style={[
                styles.iconContainer,
                sortOption === 'category' && { backgroundColor: colors.primary },
                sortOption !== 'category' && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)' }
              ]}>
                <FontAwesome5 
                  name="tags" 
                  size={12} 
                  color={sortOption === 'category' ? 'white' : colors.text} 
                />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.menuItemText, { color: sortOption === 'category' ? colors.primary : colors.text }]}>
                  Category
                </Text>
                <Text style={[styles.menuItemSubtext, { color: sortOption === 'category' ? colors.primary + 'CC' : colors.subtext }]}>
                  Group by exercise type
                </Text>
              </View>
              {sortOption === 'category' && (
                <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]}>
                  <FontAwesome5 name="check" size={8} color="white" />
                </View>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overflowMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 90 : 70,
    right: 16,
    width: 240,
    borderRadius: 12,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  primaryMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 6,
    marginTop: 6,
    borderRadius: 8,
  },
  primaryIconContainer: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  primaryTextContainer: {
    flex: 1,
  },
  primaryMenuText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  primaryMenuSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  menuSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 6,
    marginVertical: 1,
    borderRadius: 8,
  },
  iconContainer: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  menuItemSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
  selectedIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 