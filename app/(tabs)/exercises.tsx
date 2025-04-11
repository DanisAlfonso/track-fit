import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, Text, TextInput, TouchableOpacity, Alert, RefreshControl, Pressable } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase, getFavoritedExercises, resetExercisesTable, toggleFavorite } from '@/utils/database';
import { useRouter, Stack } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';

type Exercise = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  primary_muscle: string;
  secondary_muscles: string | null;
};

export default function ExercisesScreen() {
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const router = useRouter();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [favoriteExerciseIds, setFavoriteExerciseIds] = useState<number[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const muscleGroups = [
    'All',
    'Chest',
    'Back',
    'Shoulders',
    'Biceps',
    'Triceps',
    'Quadriceps',
    'Hamstrings',
    'Glutes',
    'Calves',
    'Abs',
  ];

  useFocusEffect(
    useCallback(() => {
      loadExercises();
      loadFavorites();
    }, [])
  );

  useEffect(() => {
    filterExercises();
  }, [searchQuery, selectedFilter, exercises, showFavoritesOnly, favoriteExerciseIds]);

  const loadExercises = async () => {
    try {
      const db = await getDatabase();
      const results = await db.getAllAsync<Exercise>('SELECT * FROM exercises ORDER BY name');
      setExercises(results);
    } catch (error) {
      console.error('Error loading exercises:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const favorites = await getFavoritedExercises();
      setFavoriteExerciseIds(favorites);
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const filterExercises = () => {
    let filtered = [...exercises];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(exercise => 
        exercise.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
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
  };

  const navigateToExerciseDetail = (exerciseId: number) => {
    router.push(`/exercise/${exerciseId}`);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadExercises();
      await loadFavorites();
    } catch (error) {
      console.error("Error refreshing exercises:", error);
      Alert.alert("Error", "Failed to refresh exercises. Please try again.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const getCategoryColor = (category: string): [string, string] => {
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
  };

  const getMuscleGroupIcon = (muscle: string): string => {
    // Default icon
    return 'dot-circle-o';
  };

  const handleToggleFavorite = async (exerciseId: number, event?: any) => {
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
      Alert.alert('Error', 'Failed to update favorite. Please try again.');
    }
  };

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
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
          <TouchableOpacity style={styles.detailsButton} onPress={() => navigateToExerciseDetail(item.id)}>
            <Text style={[styles.detailsButtonText, { color: colors.primary }]}>View Details</Text>
            <FontAwesome name="chevron-right" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMuscleGroupFilter = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        selectedFilter === item || (item === 'All' && !selectedFilter)
          ? { backgroundColor: colors.primary }
          : { backgroundColor: colors.card }
      ]}
      onPress={() => setSelectedFilter(item === 'All' ? null : item)}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterText,
          selectedFilter === item || (item === 'All' && !selectedFilter)
            ? { color: 'white' }
            : { color: colors.text }
        ]}
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          <Pressable onPress={() => setSearchQuery('')}>
            <FontAwesome name="times-circle" size={16} color={colors.subtext} style={styles.clearIcon} />
          </Pressable>
        )}
      </View>

      <View style={styles.filtersSection}>
        <Text style={[styles.filtersTitle, { color: colors.text }]}>Filters</Text>
        <View style={styles.filtersContainer}>
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
              style={styles.filterIcon} 
            />
            <Text
              style={[
                styles.filterText,
                showFavoritesOnly
                  ? { color: 'white' }
                  : { color: colors.text }
              ]}
            >
              Favorites
            </Text>
          </TouchableOpacity>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={muscleGroups}
            keyExtractor={(item) => item}
            renderItem={renderMuscleGroupFilter}
            contentContainerStyle={styles.muscleFiltersContainer}
          />
        </View>
      </View>

      <Text style={[styles.resultsCountText, { color: colors.subtext }]}>
        {filteredExercises.length} {filteredExercises.length === 1 ? 'exercise' : 'exercises'} found
      </Text>

      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id.toString()}
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome name="search" size={50} color={colors.subtext} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No exercises found
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.subtext }]}>
              Try adjusting your filters or pull down to refresh
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/exercise/create')}
        activeOpacity={0.8}
      >
        <FontAwesome name="plus" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  clearIcon: {
    padding: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  filtersSection: {
    marginBottom: 16,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  favoriteFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  muscleFiltersContainer: {
    paddingBottom: 4,
  },
  filterIcon: {
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  resultsCountText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
    marginLeft: 4,
  },
  exercisesList: {
    paddingBottom: 80,
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginTop: 4,
    paddingTop: 12,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
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
}); 