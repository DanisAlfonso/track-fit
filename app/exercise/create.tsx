import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const muscleGroups = [
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
  'Obliques',
  'Core',
  'Forearms',
  'Traps',
  'Lats',
  'Rear Deltoids',
  'Upper Back',
  'Lower Back',
  'Hip Flexors',
  'Hip Abductors',
  'Hip Adductors',
  'Full Body'
];

const categories = [
  'Compound',
  'Isolation',
  'Plyometric',
  'Cardio'
];

export default function CreateExerciseScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = colorScheme ?? 'light';
  const colors = Colors[theme];

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState('');
  const [secondaryMuscles, setSecondaryMuscles] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getCategoryColor = (cat: string): [string, string] => {
    switch(cat) {
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

  const handleSubmit = async () => {
    if (!name || !category || !primaryMuscle) {
      Alert.alert('Missing Information', 'Please fill in all required fields (Exercise Name, Category, and Primary Muscle)');
      return;
    }

    setIsSubmitting(true);

    try {
      const db = await getDatabase();
      await db.runAsync(
        'INSERT INTO exercises (name, category, primary_muscle, secondary_muscle, description, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [name, category, primaryMuscle, secondaryMuscles, description, Date.now()]
      );

      Alert.alert('Success', 'Exercise created successfully', [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ]);
    } catch (error) {
      console.error('Error creating exercise:', error);
      Alert.alert('Error', 'Failed to create exercise. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Stack.Screen 
          options={{
            title: 'Create Custom Exercise',
            headerShown: true,
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />

        <View style={styles.formContainer}>
          <View style={styles.headerContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Add Your Own Exercise
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.subtext }]}>
              Create a custom exercise to add to your workouts
            </Text>
          </View>

          <View style={[styles.formSection, { backgroundColor: colors.card }]}>
            <View style={styles.formGroup}>
              <View style={styles.labelContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Exercise Name</Text>
                <Text style={[styles.required, { color: colors.primary }]}>*</Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: name ? colors.primary : colors.border }]}
                placeholder="E.g., Barbell Curl, Mountain Climber"
                placeholderTextColor={colors.subtext}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.labelContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Category</Text>
                <Text style={[styles.required, { color: colors.primary }]}>*</Text>
              </View>
              
              <View style={styles.categoryContainer}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      { borderColor: colors.border },
                      category === cat && styles.selectedCategory
                    ]}
                    onPress={() => setCategory(cat)}
                    activeOpacity={0.7}
                  >
                    {category === cat && (
                      <LinearGradient
                        colors={getCategoryColor(cat)}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.categoryGradient}
                      />
                    )}
                    <View style={styles.categoryContent}>
                      <Text style={[
                        styles.categoryText,
                        { color: category === cat ? 'white' : colors.text }
                      ]}>
                        {cat}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.formSection, { backgroundColor: colors.card }]}>
            <View style={styles.formGroup}>
              <View style={styles.labelContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Primary Muscle</Text>
                <Text style={[styles.required, { color: colors.primary }]}>*</Text>
              </View>
              <Text style={[styles.helperText, { color: colors.subtext }]}>
                Select the main muscle group this exercise targets
              </Text>
              
              <View style={styles.muscleContainer}>
                {muscleGroups.map((muscle) => (
                  <TouchableOpacity
                    key={muscle}
                    style={[
                      styles.muscleButton,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      primaryMuscle === muscle && { 
                        backgroundColor: colors.primary, 
                        borderColor: colors.primary 
                      }
                    ]}
                    onPress={() => setPrimaryMuscle(muscle)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.muscleText,
                      { color: colors.text },
                      primaryMuscle === muscle && { color: 'white' }
                    ]}>
                      {muscle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.formSection, { backgroundColor: colors.card }]}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Secondary Muscles</Text>
              <Text style={[styles.helperText, { color: colors.subtext }]}>
                Select any additional muscles this exercise works (optional)
              </Text>
              
              <View style={styles.muscleContainer}>
                {muscleGroups.map((muscle) => (
                  <TouchableOpacity
                    key={muscle}
                    style={[
                      styles.muscleButton,
                      { backgroundColor: colors.background, borderColor: colors.border },
                      secondaryMuscles.includes(muscle) && { 
                        backgroundColor: colors.primary,
                        borderColor: colors.primary
                      }
                    ]}
                    onPress={() => {
                      const muscles = secondaryMuscles.split(',').filter(m => m);
                      if (muscles.includes(muscle)) {
                        setSecondaryMuscles(muscles.filter(m => m !== muscle).join(','));
                      } else {
                        setSecondaryMuscles([...muscles, muscle].join(','));
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.muscleText,
                      { color: colors.text },
                      secondaryMuscles.includes(muscle) && { color: 'white' }
                    ]}>
                      {muscle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.formSection, { backgroundColor: colors.card }]}>
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <Text style={[styles.helperText, { color: colors.subtext }]}>
                Add instructions or notes about this exercise (optional)
              </Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Describe how to perform this exercise..."
                placeholderTextColor={colors.subtext}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <FontAwesome name="plus-circle" size={16} color="white" style={styles.submitIcon} />
                <Text style={styles.submitButtonText}>
                  Create Exercise
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
    gap: 20,
  },
  headerContainer: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '400',
  },
  formSection: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 20,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  required: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  helperText: {
    fontSize: 14,
    marginBottom: 12,
    opacity: 0.8,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    height: 120,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  categoryButton: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    width: '47%',
    height: 50,
  },
  categoryGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  categoryContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCategory: {
    borderWidth: 0,
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  muscleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  muscleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 30,
    marginBottom: 4,
    borderWidth: 1,
  },
  muscleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  submitIcon: {
    marginRight: 8,
  },
}); 