import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';

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

  const handleSubmit = async () => {
    if (!name || !category || !primaryMuscle) {
      Alert.alert('Error', 'Please fill in all required fields');
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Screen 
        options={{
          title: 'Create Exercise',
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />

      <View style={styles.formContainer}>
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Exercise Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter exercise name"
            placeholderTextColor={colors.subtext}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Category *</Text>
          <View style={styles.categoryContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  { backgroundColor: colors.card },
                  category === cat && { backgroundColor: colors.primary }
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[
                  styles.categoryText,
                  { color: colors.text },
                  category === cat && { color: 'white' }
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Primary Muscle *</Text>
          <View style={styles.muscleContainer}>
            {muscleGroups.map((muscle) => (
              <TouchableOpacity
                key={muscle}
                style={[
                  styles.muscleButton,
                  { backgroundColor: colors.card },
                  primaryMuscle === muscle && { backgroundColor: colors.primary }
                ]}
                onPress={() => setPrimaryMuscle(muscle)}
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

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Secondary Muscles</Text>
          <View style={styles.muscleContainer}>
            {muscleGroups.map((muscle) => (
              <TouchableOpacity
                key={muscle}
                style={[
                  styles.muscleButton,
                  { backgroundColor: colors.card },
                  secondaryMuscles.includes(muscle) && { backgroundColor: colors.primary }
                ]}
                onPress={() => {
                  const muscles = secondaryMuscles.split(',').filter(m => m);
                  if (muscles.includes(muscle)) {
                    setSecondaryMuscles(muscles.filter(m => m !== muscle).join(','));
                  } else {
                    setSecondaryMuscles([...muscles, muscle].join(','));
                  }
                }}
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

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder="Enter exercise description"
            placeholderTextColor={colors.subtext}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text style={styles.submitButtonText}>
            {isSubmitting ? 'Creating...' : 'Create Exercise'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  textArea: {
    height: 120,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    fontSize: 16,
    borderWidth: 1,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  muscleContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  muscleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  muscleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 