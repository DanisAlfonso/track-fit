import { useState, useEffect } from 'react';
import { StyleSheet, FlatList, View, Text, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

type Routine = {
  id: number;
  name: string;
  description: string | null;
  created_at: number;
  exerciseCount?: number;
};

export default function RoutinesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [routines, setRoutines] = useState<Routine[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRoutines();
    }, [])
  );

  const loadRoutines = async () => {
    try {
      const db = await getDatabase();
      const results = await db.getAllAsync<Routine>(`
        SELECT r.id, r.name, r.description, r.created_at, 
        (SELECT COUNT(*) FROM routine_exercises WHERE routine_id = r.id) as exerciseCount
        FROM routines r
        ORDER BY r.created_at DESC
      `);
      
      setRoutines(results);
    } catch (error) {
      console.error('Error loading routines:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const navigateToCreateRoutine = () => {
    router.push('/routine/create');
  };

  const navigateToRoutineDetail = (routineId: number) => {
    router.push(`/routine/${routineId}`);
  };

  const renderRoutineItem = ({ item }: { item: Routine }) => (
    <TouchableOpacity 
      style={[styles.routineCard, { backgroundColor: colors.card }]}
      onPress={() => navigateToRoutineDetail(item.id)}
    >
      <View style={styles.routineContent}>
        <Text style={[styles.routineName, { color: colors.text }]}>{item.name}</Text>
        {item.description && (
          <Text style={[styles.routineDescription, { color: colors.subtext }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.routineFooter}>
          <Text style={[styles.routineMeta, { color: colors.subtext }]}>
            {item.exerciseCount} exercise{item.exerciseCount !== 1 ? 's' : ''}
          </Text>
          <Text style={[styles.routineMeta, { color: colors.subtext }]}>
            Created: {formatDate(item.created_at)}
          </Text>
        </View>
      </View>
      <FontAwesome name="chevron-right" size={16} color={colors.subtext} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Routines</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={navigateToCreateRoutine}
        >
          <FontAwesome name="plus" size={16} color="white" />
          <Text style={styles.addButtonText}>New Routine</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={routines}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRoutineItem}
        contentContainerStyle={styles.routinesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Routines Yet</Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              Create your first workout routine to get started.
            </Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={navigateToCreateRoutine}
            >
              <Text style={styles.createButtonText}>Create a Routine</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  routinesList: {
    paddingBottom: 20,
  },
  routineCard: {
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
  routineContent: {
    flex: 1,
  },
  routineName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  routineDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  routineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  routineMeta: {
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 