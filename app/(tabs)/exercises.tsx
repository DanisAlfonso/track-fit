import { useState, useEffect, useMemo } from 'react';
import { StyleSheet, FlatList, View, Text, TextInput, TouchableOpacity, Alert, RefreshControl, Pressable } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase, getFavoritedExercises, resetExercisesTable, toggleFavorite, deleteExercise } from '@/utils/database';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import React from 'react';
import { ActionSheet, ActionSheetOption } from '@/components/ActionSheet';

type Exercise = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  primary_muscle: string;
  secondary_muscles: string | null;
};

// Define a type for FontAwesome icon names to avoid type errors
type FontAwesomeIconName = React.ComponentProps<typeof FontAwesome>['name'];

// List of default exercise names from the master list
const DEFAULT_EXERCISES = [
  'Bench Press', 'Squat', 'Deadlift', 'Pull-up', 'Overhead Press', 'Bicep Curl',
  'Single Arm Tricep Extension (Dumbbell)', 'Leg Press', 'Lateral Raise', 'Calf Raise',
  'Romanian Deadlift', 'Barbell Row', 'Dumbbell Shoulder Press', 'Incline Bench Press',
  'Decline Bench Press', 'Dumbbell Fly', 'Face Pull', 'Lat Pulldown (Cable)',
  'Leg Extension', 'Hip Thrust (Machine)', 'Plank', 'Russian Twist', 'Dumbbell Row',
  'Cable Fly', 'Seated Cable Row (Cable)', 'Hammer Curl', 'Skull Crusher',
  'Front Raise', 'Reverse Fly', 'Bulgarian Split Squat', 'Step Up',
  'Hanging Leg Raise', 'Cable Crunch', 'Side Plank', 'Good Morning',
  'Cable Pull-Through', 'Seated Calf Raise', 'Standing Calf Raise', 'Arnold Press',
  'Dumbbell Pullover', 'Wrist Curl with Dumbbells', 'Wrist Curl with Barbell',
  'Wrist Curl with Cable', 'Reverse Wrist Curl with Dumbbells', 'Reverse Wrist Curl with Barbell',
  'Reverse Wrist Curl with Cable', 'Shrug', 'Upright Row', 'Dips', 'Push-up', 'Chin-up',
  'Pistol Squat', 'Box Jump', 'Burpee', 'Jumping Jack', 'Mountain Climber',
  'Jump Rope', 'Kettlebell Swing', 'Kettlebell Goblet Squat', 'Kettlebell Clean',
  'Kettlebell Snatch', 'Sled Push', 'Sled Pull', 'Medicine Ball Slam', 'Wall Ball',
  'Preacher Curl (Barbell)', 'Concentration Curl', 'EZ Bar Curl', 'Close-Grip Bench Press',
  'Tricep Kickback', 'Overhead Tricep Extension (Cable)', 'Cable Tricep Pushdown',
  'Pec Deck', 'Cable Crossover', 'Machine Chest Press', 'Smith Machine Bench Press',
  'T-Bar Row', 'Wide-Grip Pulldown', 'Close-Grip Pulldown', 'Machine Row', 'Cable Row',
  'Machine Shoulder Press', 'Smith Machine Shoulder Press', 'Reverse Pec Deck',
  'Machine Lateral Raise', 'Cable Lateral Raise', 'Smith Machine Squat',
  'Hack Squat (Machine)', 'V-Squat', 'Goblet Squat', 'Sissy Squat',
  'Leg Press Calf Raise', 'Smith Machine Calf Raise', 'Ab Crunch Machine',
  'Cable Woodchoppers', 'Decline Sit-up', 'Machine Back Extension', 'Hyperextension',
  'Machine Abductor', 'Machine Adductor', 'Glute Kickback Machine',
  'Wide Grip Chest Press Machine', 'Incline Chest Press Machine',
  'Seated Row Machine', 'Bicep Curl (Machine)', 'Chin Up (Weighted)', 'Hip Thrust (Barbell)',
  'Iso-Lateral Low Row', 'Iso-Lateral Row (Machine)', 'Lat Pulldown (Machine)',
  'Leg Horizontal (Machine)', 'Pause Squat (Barbell)', 'Preacher Curl (Dumbbell)',
  'Tricep Extension (EZ Bar)', 'Prone Leg Curl (Machine)', 'Seated Leg Curl (Machine)',
  'Standing Leg Curl (Machine)', 'Bench Press (Dumbbell)', 'Hack Calf Raise'
];

// Create memoized exercise item component to prevent unnecessary re-renders
const ExerciseItem = React.memo(({ 
  item, 
  navigateToExerciseDetail, 
  favoriteExerciseIds, 
  confirmDelete, 
  handleToggleFavorite,
  colors,
  router,
  getCategoryColor,
  getMuscleGroupIcon
}: { 
  item: Exercise, 
  navigateToExerciseDetail: (id: number) => void,
  favoriteExerciseIds: number[],
  confirmDelete: (id: number, name: string, event: any) => void,
  handleToggleFavorite: (id: number, event: any) => void,
  colors: any,
  router: any,
  getCategoryColor: (category: string) => [string, string],
  getMuscleGroupIcon: (muscle: string) => FontAwesomeIconName
}) => (
  <TouchableOpacity 
    style={[styles.exerciseCard, { backgroundColor: colors.card }]}
    onPress={() => navigateToExerciseDetail(item.id)}
    activeOpacity={0.7}
  >
    <View style={styles.exerciseCardInner}>
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseCategoryContainer}>
          <LinearGradient
            colors={getCategoryColor(item.category)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.categoryBadge}
          >
            <Text style={styles.categoryText}>{item.category}</Text>
          </LinearGradient>
        </View>
        <View style={styles.headerActions}>
          {/* Only show delete button for custom exercises */}
          {!DEFAULT_EXERCISES.includes(item.name) && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={(e) => confirmDelete(item.id, item.name, e)}
              activeOpacity={0.6}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <FontAwesome 
                name="trash-o" 
                size={20} 
                color={colors.subtext}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={(e) => handleToggleFavorite(item.id, e)}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome 
              name={favoriteExerciseIds.includes(item.id) ? "heart" : "heart-o"} 
              size={22} 
              color={favoriteExerciseIds.includes(item.id) ? colors.primary : colors.subtext} 
            />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.exerciseContent}>
        <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
        
        <View style={styles.muscleGroupsContainer}>
          <View style={styles.primaryMuscleContainer}>
            <FontAwesome 
              name={getMuscleGroupIcon(item.primary_muscle)} 
              size={14} 
              color={colors.primary} 
              style={styles.muscleIcon} 
            />
            <Text style={[styles.primaryMuscle, { color: colors.text }]}>
              {item.primary_muscle}
            </Text>
          </View>
          
          {item.secondary_muscles && (
            <View style={styles.secondaryMusclesContainer}>
              <Text style={[styles.secondaryMusclesLabel, { color: colors.subtext }]}>
                Also works:
              </Text>
              <Text style={[styles.secondaryMuscles, { color: colors.subtext }]}>
                {item.secondary_muscles}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.exerciseFooter}>
        <TouchableOpacity 
          style={styles.footerButton} 
          onPress={() => navigateToExerciseDetail(item.id)}
        >
          <Text style={[styles.footerButtonText, { color: colors.primary }]}>Details</Text>
          <FontAwesome name="info-circle" size={14} color={colors.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.footerButton} 
          onPress={() => router.push(`/exercise/history/${item.id}`)}
        >
          <Text style={[styles.footerButtonText, { color: colors.primary }]}>History</Text>
          <FontAwesome name="history" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  </TouchableOpacity>
), (prevProps, nextProps) => {
  // Custom comparison function to determine if re-render is needed
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.name === nextProps.item.name &&
    prevProps.item.category === nextProps.item.category &&
    prevProps.item.primary_muscle === nextProps.item.primary_muscle &&
    prevProps.item.secondary_muscles === nextProps.item.secondary_muscles &&
    prevProps.favoriteExerciseIds.includes(prevProps.item.id) === 
    nextProps.favoriteExerciseIds.includes(nextProps.item.id) &&
    prevProps.colors.card === nextProps.colors.card &&
    prevProps.colors.text === nextProps.colors.text &&
    prevProps.colors.subtext === nextProps.colors.subtext &&
    prevProps.colors.primary === nextProps.colors.primary
  );
});

export default function ExercisesScreen() {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const router = useRouter();
  const { showToast } = useToast();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [exerciseToDelete, setExerciseToDelete] = useState<{id: number, name: string} | null>(null);

  const muscleGroups = useMemo(() => [
    'All',
    'Chest',
    'Back',
    'Shoulders',
    'Biceps',
    'Triceps',
    'Forearms',
    'Quadriceps',
    'Hamstrings',
    'Glutes',
    'Calves',
    'Abs',
  ], []);

  // Create options for the filter action sheet
  const filterOptions = useMemo(() => {
    return muscleGroups.map(group => ({
      label: group,
      onPress: () => setSelectedFilter(group === 'All' ? null : group),
      icon: selectedFilter === group || (group === 'All' && !selectedFilter) ? 'check' : undefined,
    } as ActionSheetOption));
  }, [muscleGroups, selectedFilter]);

  useFocusEffect(
    useCallback(() => {
      loadExercises();
      loadFavorites();
    }, [])
  );

  useEffect(() => {
    filterExercises();
  }, [searchQuery, selectedFilter, exercises, showFavoritesOnly, favoriteExerciseIds]);

  const loadExercises = useCallback(async () => {
    try {
      const db = await getDatabase();
      const results = await db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY name');
      setExercises(results);
    } catch (error) {
      console.error('Error loading exercises:', error);
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const favorites = await getFavoritedExercises();
      setFavoriteExerciseIds(favorites);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  }, []);

  const filterExercises = useCallback(() => {
    let filtered = [...exercises];

    // Apply search filter
    if (searchQuery) {
      const trimmedQuery = searchQuery.trim().toLowerCase();
      if (trimmedQuery) {
        filtered = filtered.filter(exercise => 
          exercise.name.toLowerCase().includes(trimmedQuery) ||
          exercise.primary_muscle.toLowerCase().includes(trimmedQuery)
        );
      }
    }

    // Apply muscle group filter
    if (selectedFilter && selectedFilter !== 'All') {
      filtered = filtered.filter(exercise => 
        exercise.primary_muscle === selectedFilter || 
        (exercise.secondary_muscles && exercise.secondary_muscles.includes(selectedFilter))
      );
    }

    // Apply favorites filter
    if (showFavoritesOnly) {
      filtered = filtered.filter(exercise => 
        favoriteExerciseIds.includes(exercise.id)
      );
    }

    setFilteredExercises(filtered);
  }, [exercises, searchQuery, selectedFilter, showFavoritesOnly, favoriteExerciseIds]);

  const navigateToExerciseDetail = useCallback((exerciseId: number) => {
    router.push(`/exercise/${exerciseId}`);
  }, [router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadExercises();
      await loadFavorites();
    } catch (error) {
      console.error("Error refreshing exercises:", error);
      showToast("Failed to refresh exercises. Please try again.", "error");
    } finally {
      setRefreshing(false);
    }
  }, [loadExercises, loadFavorites]);

  const getCategoryColor = useCallback((category: string): [string, string] => {
    switch(category) {
      case 'Compound':
        return ['#4E54C8', '#8F94FB']; // Purple gradient
      case 'Isolation':
        return ['#11998e', '#38ef7d']; // Green gradient
      case 'Plyometric':
        return ['#F2994A', '#F2C94C']; // Orange gradient
      case 'Cardio':
        return ['#FF416C', '#FF4B2B']; // Red gradient
      default:
        return [colors.primary, colors.primary]; // Default
    }
  }, [colors.primary]);

  const getMuscleGroupIcon = useCallback((muscle: string): FontAwesomeIconName => {
    // Default icon
    return 'dot-circle-o';
  }, []);

  const handleToggleFavorite = useCallback(async (exerciseId: number, event?: any) => {
    event?.stopPropagation?.();
    
    try {
      const isFavorited = await toggleFavorite(exerciseId);
      
      setFavoriteExerciseIds(prev => {
        if (isFavorited) {
          return [...prev, exerciseId];
        } else {
          return prev.filter(id => id !== exerciseId);
        }
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      showToast('Failed to update favorite. Please try again.', 'error');
    }
  }, []);

  const confirmDelete = useCallback((exerciseId: number, exerciseName: string, event?: any) => {
    event?.stopPropagation?.();
    
    // Check if this is a default exercise
    if (DEFAULT_EXERCISES.includes(exerciseName)) {
      showToast(
        "Default exercises cannot be deleted",
        "error"
      );
      return;
    }
    
    // Show the delete confirmation ActionSheet instead of Toast
    setExerciseToDelete({ id: exerciseId, name: exerciseName });
    setShowDeleteModal(true);
  }, []);

  const handleDeleteExercise = useCallback(async () => {
    if (!exerciseToDelete) return;
    
    try {
      await deleteExercise(exerciseToDelete.id);
      // Refresh exercises list
      await loadExercises();
      showToast("Exercise deleted successfully", "success");
    } catch (error) {
      console.error('Error deleting exercise:', error);
      showToast("Failed to delete exercise. Please try again.", "error");
    } finally {
      setExerciseToDelete(null);
    }
  }, [exerciseToDelete, loadExercises, showToast]);

  const deleteOptions = useMemo(() => {
    return [
      {
        label: 'Delete',
        onPress: handleDeleteExercise,
        destructive: true,
        icon: 'trash'
      }
    ] as ActionSheetOption[];
  }, [handleDeleteExercise]);

  const renderExerciseItem = useCallback(({ item }: { item: Exercise }) => (
    <ExerciseItem
      item={item}
      navigateToExerciseDetail={navigateToExerciseDetail}
      favoriteExerciseIds={favoriteExerciseIds}
      confirmDelete={confirmDelete}
      handleToggleFavorite={handleToggleFavorite}
      colors={colors}
      router={router}
      getCategoryColor={getCategoryColor}
      getMuscleGroupIcon={getMuscleGroupIcon}
    />
  ), [
    navigateToExerciseDetail, 
    favoriteExerciseIds, 
    confirmDelete, 
    handleToggleFavorite, 
    colors,
    router,
    getCategoryColor,
    getMuscleGroupIcon
  ]);

  // Optimize empty list component with memo
  const EmptyListComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <FontAwesome name="search" size={50} color={colors.subtext} style={styles.emptyIcon} />
      <Text style={[styles.emptyText, { color: colors.subtext }]}>
        No exercises found
      </Text>
      <Text style={[styles.emptySubtext, { color: colors.subtext }]}>
        Try adjusting your filters or pull down to refresh
      </Text>
    </View>
  ), [colors.subtext]);

  // Memoize key extractor functions
  const keyExtractor = useCallback((item: Exercise) => item.id.toString(), []);

  // Create a header component for the FlatList
  const ListHeaderComponent = useMemo(() => (
    <>
      <View style={styles.headerContainer}>
        <View style={styles.searchFilterRow}>
          <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
            <FontAwesome name="search" size={15} color={colors.subtext} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search exercises..."
              placeholderTextColor={colors.subtext}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <FontAwesome name="times-circle" size={15} color={colors.subtext} style={styles.clearIcon} />
              </Pressable>
            )}
          </View>
          
          <TouchableOpacity
            style={[
              styles.favoriteFilterButton,
              showFavoritesOnly
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.card }
            ]}
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            activeOpacity={0.7}
          >
            <FontAwesome 
              name="heart" 
              size={14} 
              color={showFavoritesOnly ? 'white' : colors.primary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.muscleFilterButton,
              { backgroundColor: colors.card }
            ]}
            onPress={() => setShowFilterModal(true)}
            activeOpacity={0.7}
          >
            <FontAwesome 
              name="filter" 
              size={14} 
              color={colors.primary} 
              style={styles.filterIcon} 
            />
            <Text
              style={[
                styles.filterText,
                { color: colors.text }
              ]}
            >
              {selectedFilter || 'All'}
            </Text>
            <FontAwesome 
              name="chevron-down" 
              size={12} 
              color={colors.subtext} 
              style={styles.filterChevron} 
            />
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.resultsCountText, { color: colors.subtext }]}>
          {filteredExercises.length} {filteredExercises.length === 1 ? 'exercise' : 'exercises'} found
        </Text>
      </View>
    </>
  ), [
    colors,
    searchQuery,
    setSearchQuery,
    showFavoritesOnly,
    setShowFavoritesOnly,
    selectedFilter,
    setShowFilterModal,
    filteredExercises.length
  ]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={filteredExercises}
        keyExtractor={keyExtractor}
        renderItem={renderExerciseItem}
        contentContainerStyle={styles.exercisesList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={EmptyListComponent}
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => (
          {length: 208, offset: 208 * index + (filteredExercises.length > 0 ? 150 : 0), index}
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/exercise/create')}
        activeOpacity={0.8}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>

      {/* Muscle group filter action sheet */}
      <ActionSheet
        visible={showFilterModal}
        title="Filter by Muscle Group"
        options={filterOptions}
        onClose={() => setShowFilterModal(false)}
        cancelLabel="Cancel"
      />

      {/* Delete confirmation action sheet */}
      <ActionSheet
        visible={showDeleteModal}
        title={`Delete "${exerciseToDelete?.name}"? This action cannot be undone.`}
        options={deleteOptions}
        onClose={() => setShowDeleteModal(false)}
        cancelLabel="Cancel"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flex: 1,
  },
  searchIcon: {
    marginRight: 6,
  },
  clearIcon: {
    padding: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  favoriteFilterButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  muscleFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  filterIcon: {
    marginRight: 4,
  },
  filterChevron: {
    marginLeft: 4,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resultsCountText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 4,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  exercisesList: {
    padding: 16,
    paddingTop: 0,
  },
  exerciseCard: {
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  exerciseCardInner: {
    padding: 16,
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseCategoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  exerciseContent: {
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  muscleGroupsContainer: {
    marginTop: 4,
  },
  primaryMuscleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  muscleIcon: {
    marginRight: 6,
  },
  primaryMuscle: {
    fontSize: 15,
    fontWeight: '500',
  },
  secondaryMusclesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  secondaryMusclesLabel: {
    fontSize: 13,
    marginRight: 4,
  },
  secondaryMuscles: {
    fontSize: 13,
    fontWeight: '500',
  },
  exerciseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteIcon: {
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.6,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  favoriteButton: {
    padding: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteButton: {
    padding: 5,
  },
}); 