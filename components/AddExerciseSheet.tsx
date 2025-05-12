import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput, 
  ActivityIndicator, 
  Dimensions,
  Animated,
  Modal,
  TouchableWithoutFeedback,
  ScrollView
} from 'react-native';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { useTheme } from '@/context/ThemeContext';

type Exercise = {
  id: number;
  name: string;
  category: string;
  primary_muscle: string;
};

interface AddExerciseSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectExercise: (exerciseId: number, name: string, primaryMuscle: string, category: string) => void;
  colors: typeof Colors[keyof typeof Colors];
}

export const AddExerciseSheet: React.FC<AddExerciseSheetProps> = ({
  visible,
  onClose,
  onSelectExercise,
  colors
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const { theme } = useTheme();
  const colorScheme = theme === 'system' ? 'light' : theme;
  
  const slideAnimation = React.useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    if (visible) {
      loadExercises();
      Animated.spring(slideAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 12
      }).start();
    } else {
      Animated.timing(slideAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      }).start();
    }
  }, [visible]);

  const loadExercises = async () => {
    try {
      setIsLoading(true);
      const db = await getDatabase();
      
      // Get all exercises
      const results = await db.getAllAsync<Exercise>(`
        SELECT id, name, category, primary_muscle
        FROM exercises
        ORDER BY name
      `);
      
      // Get unique list of muscle groups for filters
      const allMuscles = results.map(ex => ex.primary_muscle);
      const uniqueMuscles = [...new Set(allMuscles)].sort();
      
      setExercises(results);
      setFilteredExercises(results);
      setMuscleGroups(uniqueMuscles);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...exercises];
    
    // Apply search query filter
    if (searchQuery) {
      filtered = filtered.filter(ex => 
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.primary_muscle.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply muscle group filter
    if (selectedFilter) {
      filtered = filtered.filter(ex => ex.primary_muscle === selectedFilter);
    }
    
    setFilteredExercises(filtered);
  }, [exercises, searchQuery, selectedFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters, searchQuery, selectedFilter]);

  const selectExercise = (exercise: Exercise) => {
    onSelectExercise(exercise.id, exercise.name, exercise.primary_muscle, exercise.category);
    onClose();
  };

  const getCategoryColor = (category: string): [string, string] => {
    const categoryColors: Record<string, [string, string]> = {
      'Barbell': ['#4A90E2', '#2E67B2'],
      'Dumbbell': ['#D25F9C', '#A12C6B'],
      'Machine': ['#50C356', '#2E9C30'],
      'Cable': ['#F5B041', '#D68910'],
      'Bodyweight': ['#9B59B6', '#7D3C98'],
      'Kettlebell': ['#E74C3C', '#B83227'],
      'Other': ['#95A5A6', '#7F8C8D'],
    };
    
    return categoryColors[category] || categoryColors['Other'];
  };

  const renderSearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
      <FontAwesome name="search" size={16} color={colors.subtext} style={styles.searchIcon} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder="Search exercises..."
        placeholderTextColor={colors.subtext}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity 
          style={styles.clearButton}
          onPress={() => setSearchQuery('')}
        >
          <FontAwesome name="times-circle" size={16} color={colors.subtext} />
        </TouchableOpacity>
      )}
    </View>
  );
  
  const renderMuscleFilters = () => (
    <View style={styles.filtersContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersScrollContent}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            !selectedFilter && styles.activeFilterChip,
            !selectedFilter && { backgroundColor: colors.primary + '20' }
          ]}
          onPress={() => setSelectedFilter(null)}
        >
          <Text style={[
            styles.filterChipText,
            !selectedFilter && { color: colors.primary }
          ]}>
            All
          </Text>
        </TouchableOpacity>
        
        {muscleGroups.map(muscle => (
          <TouchableOpacity
            key={muscle}
            style={[
              styles.filterChip,
              selectedFilter === muscle && styles.activeFilterChip,
              selectedFilter === muscle && { backgroundColor: colors.primary + '20' }
            ]}
            onPress={() => setSelectedFilter(muscle === selectedFilter ? null : muscle)}
          >
            <Text style={[
              styles.filterChipText,
              selectedFilter === muscle && { color: colors.primary }
            ]}>
              {muscle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={[styles.exerciseItem, { backgroundColor: colors.card }]}
      onPress={() => selectExercise(item)}
      activeOpacity={0.7}
    >
      <View style={styles.exerciseContent}>
        <View style={styles.exerciseHeader}>
          <LinearGradient
            colors={getCategoryColor(item.category)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.categoryBadge}
          >
            <Text style={styles.categoryText}>{item.category}</Text>
          </LinearGradient>
          
          <View style={styles.muscleContainer}>
            <Text style={[styles.muscleName, { color: colors.subtext }]}>
              {item.primary_muscle}
            </Text>
          </View>
        </View>
        
        <Text style={[styles.exerciseName, { color: colors.text }]}>
          {item.name}
        </Text>
        
        <View style={styles.addButtonContainer}>
          <Text style={[styles.addText, { color: colors.primary }]}>Add to workout</Text>
          <FontAwesome5 name="plus-circle" size={14} color={colors.primary} style={styles.addIcon} />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <FontAwesome5 name="search" size={40} color={colors.subtext} style={styles.emptyIcon} />
      <Text style={[styles.emptyText, { color: colors.subtext }]}>
        {searchQuery 
          ? `No exercises found matching "${searchQuery}"`
          : 'No exercises available'
        }
      </Text>
      {searchQuery && (
        <TouchableOpacity
          style={[styles.clearSearchButton, { borderColor: colors.primary }]}
          onPress={() => setSearchQuery('')}
        >
          <Text style={[styles.clearSearchText, { color: colors.primary }]}>
            Clear search
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const { height } = Dimensions.get('window');
  const translateY = slideAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0]
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <BlurView intensity={10} style={StyleSheet.absoluteFill} tint={colorScheme === 'dark' ? 'dark' : 'light'} />
          
          <TouchableWithoutFeedback>
            <Animated.View 
              style={[
                styles.sheetContainer, 
                { 
                  backgroundColor: colors.background,
                  transform: [{ translateY }] 
                }
              ]}
            >
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHandle} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  Add Exercise to Workout
                </Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <FontAwesome name="times" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              {renderSearchBar()}
              
              {renderMuscleFilters()}
              
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.text }]}>
                    Loading exercises...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredExercises}
                  renderItem={renderExerciseItem}
                  keyExtractor={item => item.id.toString()}
                  contentContainerStyle={styles.exercisesList}
                  showsVerticalScrollIndicator={false}
                  numColumns={2}
                  columnWrapperStyle={styles.exercisesRow}
                  ListEmptyComponent={renderEmptyList}
                />
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const itemWidth = (width - 48) / 2;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#DDDDDD',
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 10,
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
  },
  filtersContainer: {
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  filtersScrollContent: {
    paddingHorizontal: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(200, 200, 200, 0.15)',
  },
  activeFilterChip: {
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  exercisesList: {
    padding: 12,
    paddingBottom: 40, // Extra padding at bottom for better scrolling
  },
  exercisesRow: {
    justifyContent: 'space-between',
  },
  exerciseItem: {
    width: itemWidth,
    borderRadius: 16,
    marginBottom: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  muscleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  muscleName: {
    fontSize: 12,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  addButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 'auto',
  },
  addText: {
    fontSize: 13,
    fontWeight: '500',
    marginRight: 6,
  },
  addIcon: {
    marginTop: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  clearSearchButton: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  clearSearchText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 