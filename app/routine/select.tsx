import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { LinearGradient } from 'expo-linear-gradient';

type Routine = {
  id: number;
  name: string;
  description: string | null;
  created_at: number;
  exerciseCount: number;
};

export default function SelectRoutineScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRoutines();
  }, []);

  const loadRoutines = async () => {
    try {
      setLoading(true);
      const db = await getDatabase();
      const results = await db.getAllAsync<Routine>(`
        SELECT r.id, r.name, r.description, r.created_at, 
        (SELECT COUNT(*) FROM routine_exercises WHERE routine_id = r.id) as exerciseCount
        FROM routines r
        ORDER BY r.created_at DESC
      `);
      
      // Filter out routines with no exercises
      const validRoutines = results.filter(routine => routine.exerciseCount > 0);
      setRoutines(validRoutines);
    } catch (error) {
      console.error('Error loading routines:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectRoutine = (routineId: number) => {
    router.push({
      pathname: "/workout/start",
      params: { routineId }
    });
  };

  const renderRoutineItem = ({ item }: { item: Routine }) => (
    <TouchableOpacity 
      style={[styles.routineCard, { backgroundColor: colors.card }]}
      onPress={() => selectRoutine(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.routineIconContainer}>
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          style={styles.routineIcon}
        >
          <FontAwesome5 name="dumbbell" size={18} color="white" />
        </LinearGradient>
      </View>
      <View style={styles.routineContent}>
        <Text style={[styles.routineName, { color: colors.text }]}>{item.name}</Text>
        {item.description && (
          <Text style={[styles.routineDescription, { color: colors.subtext }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.routineFooter}>
          <View style={styles.routineMetaItem}>
            <FontAwesome5 name="list" size={12} color={colors.subtext} style={styles.metaIcon} />
            <Text style={[styles.routineMeta, { color: colors.subtext }]}>
              {item.exerciseCount} exercise{item.exerciseCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.chevronContainer}>
        <FontAwesome5 name="chevron-right" size={16} color={colors.subtext} />
      </View>
    </TouchableOpacity>
  );

  const navigateToCreateRoutine = () => {
    router.push('/routine/create');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          title: "Select Routine",
          headerTintColor: colors.text,
          headerStyle: {
            backgroundColor: colors.background,
          },
        }}
      />

      <Text style={[styles.subtitle, { color: colors.subtext }]}>
        Select a routine to start your workout
      </Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.subtext }]}>Loading routines...</Text>
        </View>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRoutineItem}
          contentContainerStyle={styles.routinesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
                <FontAwesome5 name="clipboard-list" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Routines Available</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                You need to create a routine with exercises before starting a workout
              </Text>
              <TouchableOpacity
                style={styles.emptyCreateButton}
                onPress={navigateToCreateRoutine}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={styles.emptyCreateButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.emptyCreateButtonText}>Create Routine</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  routinesList: {
    paddingBottom: 20,
  },
  routineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  routineIconContainer: {
    marginRight: 14,
  },
  routineIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineContent: {
    flex: 1,
  },
  routineName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  routineDescription: {
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  routineFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  routineMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaIcon: {
    marginRight: 4,
  },
  routineMeta: {
    fontSize: 13,
  },
  chevronContainer: {
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  emptyCreateButton: {
    overflow: 'hidden',
    borderRadius: 12,
    width: '70%',
  },
  emptyCreateButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  emptyCreateButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 