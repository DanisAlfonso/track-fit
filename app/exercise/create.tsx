import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { getDatabase, createCustomExercise } from '@/utils/database';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';

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
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState('');
  const [secondaryMuscles, setSecondaryMuscles] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);

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

  const pickImage = async () => {
    // Request permissions first
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      showToast('You need to grant permission to access your photos in order to add an image to your exercise.', 'error');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const removeImage = () => {
    showToast(
      'Are you sure you want to remove this image?', 
      'info', 
      undefined,
      {
        label: "Remove",
        onPress: () => {
          setImageUri(null);
          showToast('Image removed', 'success');
        }
      }
    );
  };

  const handleSubmit = async () => {
    if (!name || !category || !primaryMuscle) {
      showToast('Please fill in all required fields (Exercise Name, Category, and Primary Muscle)', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      await createCustomExercise(
        name,
        category,
        primaryMuscle,
        secondaryMuscles,
        description,
        imageUri || undefined
      );

      showToast('Exercise created successfully', 'success');
      router.back();
    } catch (error) {
      console.error('Error creating exercise:', error);
      showToast('Failed to create exercise. Please try again.', 'error');
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
        <StatusBar style={currentTheme === 'dark' ? 'light' : 'dark'} />
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
              <Text style={[styles.label, { color: colors.text }]}>Exercise Image</Text>
              <Text style={[styles.helperText, { color: colors.subtext }]}>
                Add an image or animation for your exercise (optional)
              </Text>
              
              <View style={styles.imageContainer}>
                {imageUri ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image 
                      source={{ uri: imageUri }} 
                      style={styles.imagePreview} 
                      resizeMode="cover"
                    />
                    <TouchableOpacity 
                      style={[styles.removeImageButton, { backgroundColor: colors.error }]}
                      onPress={removeImage}
                    >
                      <FontAwesome name="trash" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={[styles.imageUploadButton, { 
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    }]}
                    onPress={pickImage}
                  >
                    <FontAwesome 
                      name="image" 
                      size={28} 
                      color={colors.primary} 
                      style={styles.uploadIcon} 
                    />
                    <Text style={[styles.uploadText, { color: colors.text }]}>
                      Tap to add image
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={[styles.imageInfoCard, { backgroundColor: colors.background }]}>
                <FontAwesome name="info-circle" size={18} color={colors.primary} style={styles.infoIcon} />
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoTitle, { color: colors.text }]}>Image Tips</Text>
                  <Text style={[styles.infoText, { color: colors.subtext }]}>
                    • Clear, well-lit images work best{'\n'}
                    • Square images are recommended{'\n'}
                    • You can add animations or diagrams{'\n'}
                    • You can add images later from the exercise details
                  </Text>
                </View>
              </View>
            </View>
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
  imageContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  imageUploadButton: {
    width: 160,
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadIcon: {
    marginBottom: 12,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginVertical: 8,
  },
  imagePreview: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  imageInfoCard: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
}); 