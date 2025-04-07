import { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { getExerciseInstructions, getExerciseImage } from '@/data/exercises';

// Exercise types match our database schema
type Exercise = {
  id: number;
  name: string;
  category: string;
  description: string | null;
  primary_muscle: string;
  secondary_muscles: string | null;
};

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];
  const { width } = useWindowDimensions();
  
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [activeTab, setActiveTab] = useState('instructions'); // 'instructions' or 'muscles'
  
  // Animation values
  const imageOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(50);
  
  useEffect(() => {
    loadExerciseDetails();
    
    // Start animations when component mounts
    imageOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    contentTranslateY.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [id]);
  
  const loadExerciseDetails = async () => {
    if (!id) return;
    
    try {
      const db = await getDatabase();
      // Convert the id to a number for SQLite
      const exerciseId = parseInt(String(id), 10);
      
      const result = await db.getFirstAsync<Exercise>(
        'SELECT * FROM exercises WHERE id = ?', 
        [exerciseId]
      );
      
      if (result) {
        setExercise(result);
      }
    } catch (error) {
      console.error('Error loading exercise details:', error);
    }
  };
  
  // Animated styles
  const imageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));
  
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: contentTranslateY.value }],
    opacity: 1 - contentTranslateY.value / 50,
  }));

  if (!exercise) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen 
          options={{
            title: "Exercise Details",
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading exercise...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          title: exercise.name,
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerRight: () => (
            <TouchableOpacity 
              style={[styles.headerButton, { backgroundColor: colors.card }]}
              onPress={() => {/* Toggle favorite */}}
            >
              <FontAwesome name="heart-o" size={16} color={colors.text} />
            </TouchableOpacity>
          ),
        }}
      />
      
      <Text style={[styles.exerciseTitle, { color: colors.text }]}>{exercise.name}</Text>
      <Text style={[styles.exerciseCategory, { color: colors.subtext }]}>
        {exercise.category} • {exercise.primary_muscle}
      </Text>
      
      <Animated.View style={[styles.animationContainer, imageAnimatedStyle]}>
        <View style={[styles.animationBox, { backgroundColor: colors.card }]}>
          <Image 
            source={getExerciseImage(exercise.name)}
            style={styles.exerciseAnimation}
            resizeMode="contain"
          />
          <Text style={[styles.animationText, { color: colors.primary }]}>
            Exercise Animation
          </Text>
        </View>
      </Animated.View>
      
      <Animated.View style={[styles.contentContainer, contentAnimatedStyle]}>
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'instructions' && [styles.activeTab, { borderBottomColor: colors.primary }]
            ]}
            onPress={() => setActiveTab('instructions')}
          >
            <Text 
              style={[
                styles.tabText, 
                { color: activeTab === 'instructions' ? colors.primary : colors.subtext }
              ]}
            >
              Instructions
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tab, 
              activeTab === 'muscles' && [styles.activeTab, { borderBottomColor: colors.primary }]
            ]}
            onPress={() => setActiveTab('muscles')}
          >
            <Text 
              style={[
                styles.tabText,
                { color: activeTab === 'muscles' ? colors.primary : colors.subtext }
              ]}
            >
              Muscles
            </Text>
          </TouchableOpacity>
        </View>
        
        {activeTab === 'instructions' && (
          <View style={styles.instructionsContainer}>
            {getExerciseInstructions(exercise.name).map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <View style={[styles.instructionNumber, { backgroundColor: colors.primary }]}>
                  <Text style={styles.instructionNumberText}>{index + 1}</Text>
                </View>
                <Text style={[styles.instructionText, { color: colors.text }]}>
                  {instruction}
                </Text>
              </View>
            ))}
          </View>
        )}
        
        {activeTab === 'muscles' && (
          <View style={styles.musclesContainer}>
            <View style={styles.muscleSection}>
              <Text style={[styles.muscleSectionTitle, { color: colors.primary }]}>Primary Muscle</Text>
              <View style={[styles.muscleItem, { backgroundColor: colors.card }]}>
                <FontAwesome name="bullseye" size={16} color={colors.primary} style={styles.muscleIcon} />
                <Text style={[styles.muscleText, { color: colors.text }]}>{exercise.primary_muscle}</Text>
              </View>
            </View>
            
            {exercise.secondary_muscles && (
              <View style={styles.muscleSection}>
                <Text style={[styles.muscleSectionTitle, { color: colors.primary }]}>Secondary Muscles</Text>
                {exercise.secondary_muscles.split(',').map((muscle, index) => (
                  <View key={index} style={[styles.muscleItem, { backgroundColor: colors.card }]}>
                    <FontAwesome name="dot-circle-o" size={16} color={colors.primary} style={styles.muscleIcon} />
                    <Text style={[styles.muscleText, { color: colors.text }]}>{muscle.trim()}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => {/* Navigate to start workout with this exercise */}}
          >
            <FontAwesome name="play" size={16} color="white" />
            <Text style={styles.actionButtonText}>Start Workout</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.secondary }]}
            onPress={() => {/* Navigate to add to routine */}}
          >
            <FontAwesome name="plus" size={16} color="white" />
            <Text style={styles.actionButtonText}>Add to Routine</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 8,
  },
  exerciseTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  exerciseCategory: {
    fontSize: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  animationContainer: {
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  animationBox: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  exerciseAnimation: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  animationText: {
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 3,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  instructionNumberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  instructionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
  },
  musclesContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  muscleSection: {
    marginBottom: 16,
  },
  muscleSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  muscleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  muscleIcon: {
    marginRight: 12,
  },
  muscleText: {
    fontSize: 16,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.48,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 18,
  },
}); 