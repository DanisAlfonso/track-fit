import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, Text, TextInput, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase, getFavoritedExercises } from '@/utils/database';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

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

  const renderExerciseItem = ({ item }: { item: Exercise }) => (
    <TouchableOpacity 
      style={[styles.exerciseCard, { backgroundColor: colors.card }]}
      onPress={() => navigateToExerciseDetail(item.id)}
    >
      <View style={styles.exerciseContent}>
        <Text style={[styles.exerciseName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.exerciseDetails, { color: colors.subtext }]}>
          {item.category} • {item.primary_muscle}
        </Text>
        {item.secondary_muscles && (
          <Text style={[styles.secondaryMuscles, { color: colors.subtext }]}>
            Also works: {item.secondary_muscles}
          </Text>
        )}
      </View>
      <View style={styles.exerciseActions}>
        {favoriteExerciseIds.includes(item.id) && (
          <FontAwesome name="heart" size={16} color={colors.primary} style={styles.favoriteIcon} />
        )}
        <FontAwesome name="chevron-right" size={16} color={colors.subtext} />
      </View>
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
      </View>

      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            showFavoritesOnly
              ? { backgroundColor: colors.primary }
              : { backgroundColor: colors.card }
          ]}
          onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === item || (item === 'All' && !selectedFilter)
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.card }
              ]}
              onPress={() => setSelectedFilter(item === 'All' ? null : item)}
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
          )}
        />
      </View>

      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExerciseItem}
        contentContainerStyle={styles.exercisesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              No exercises found. Try adjusting your filters.
            </Text>
          </View>
        }
      />
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
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filtersContainer: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginRight: 8,
  },
  filterIcon: {
    marginRight: 4,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  exercisesList: {
    paddingBottom: 20,
  },
  exerciseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  exerciseDetails: {
    fontSize: 14,
  },
  secondaryMuscles: {
    fontSize: 12,
    marginTop: 4,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteIcon: {
    marginRight: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
}); 