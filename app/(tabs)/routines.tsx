import { useState } from 'react';
import { StyleSheet, FlatList, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';

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
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadRoutines();
    }, [])
  );

  const loadRoutines = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
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
          <View style={styles.routineMetaItem}>
            <FontAwesome5 name="calendar-alt" size={12} color={colors.subtext} style={styles.metaIcon} />
            <Text style={[styles.routineMeta, { color: colors.subtext }]}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.chevronContainer}>
        <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Routines</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={navigateToCreateRoutine}
        >
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.addButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <FontAwesome5 name="plus" size={14} color="white" />
            <Text style={styles.addButtonText}>New Routine</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

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
                <FontAwesome5 name="dumbbell" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Routines Yet</Text>
              <Text style={[styles.emptyText, { color: colors.subtext }]}>
                Create your first workout routine to get started
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  addButton: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
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