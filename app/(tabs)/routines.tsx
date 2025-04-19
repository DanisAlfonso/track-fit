import { useState } from 'react';
import { StyleSheet, FlatList, View, Text, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
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
      <View style={styles.headerContainer}>
        <Text style={[styles.title, { color: colors.text }]}>My Routines</Text>
        
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.scheduleButton, { backgroundColor: colors.card }]}
            onPress={() => router.push('/weekly-schedule')}
          >
            <FontAwesome5 name="calendar-alt" size={16} color={colors.primary} />
            <Text style={[styles.scheduleButtonText, { color: colors.primary }]} numberOfLines={1}>Schedule</Text>
          </TouchableOpacity>
          
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
              <Text style={styles.addButtonText} numberOfLines={1}>New Routine</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
                Click the "New Routine" button to create your first workout routine
              </Text>
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
  headerContainer: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    flex: 1,
    maxWidth: '48%',
  },
  scheduleButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
    flexShrink: 1,
  },
  addButton: {
    overflow: 'hidden',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    flex: 1,
    maxWidth: '48%',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 14,
    flexShrink: 1,
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
}); 