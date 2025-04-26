import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, TextInput, Platform, KeyboardAvoidingView, ScrollView, ActivityIndicator, Animated, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useColorScheme } from 'react-native';
import Colors from '@/constants/Colors';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheet, ActionSheetOption } from '@/components/ActionSheet';

// Storage keys for user profile data
const USER_NAME_KEY = 'user_name';
const USER_AGE_KEY = 'user_age';
const USER_GENDER_KEY = 'user_gender';
const USER_FITNESS_GOAL_KEY = 'user_fitness_goal';
const USER_ACTIVITY_LEVEL_KEY = 'user_activity_level';
const USER_PROFILE_PICTURE_KEY = 'user_profile_picture';

export default function EditProfileScreen() {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const { showToast } = useToast();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const isDark = currentTheme === 'dark';
  
  const router = useRouter();
  
  // Animation values
  const headerOpacity = new Animated.Value(1);
  const formOpacity = new Animated.Value(1);
  const formTranslateY = new Animated.Value(0);
  
  // State for form inputs
  const [nameInput, setNameInput] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [genderInput, setGenderInput] = useState('');
  const [fitnessGoalInput, setFitnessGoalInput] = useState('');
  const [activityLevelInput, setActivityLevelInput] = useState('');
  const [profilePictureUri, setProfilePictureUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Options for selection
  const genderOptions = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
  const fitnessGoalOptions = ['Weight Loss', 'Muscle Gain', 'Strength', 'Endurance', 'General Fitness'];
  const activityLevelOptions = ['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active', 'Extremely Active'];
  
  // ActionSheet state
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  
  useEffect(() => {
    loadProfileData();
    
    // Simplified animations - only animate if needed
    // Comment out for now to ensure content is visible
    /*
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(formOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(formTranslateY, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();
    */
  }, []);
  
  const loadProfileData = async () => {
    setIsLoading(true);
    try {
      const storedName = await AsyncStorage.getItem(USER_NAME_KEY);
      const storedAge = await AsyncStorage.getItem(USER_AGE_KEY);
      const storedGender = await AsyncStorage.getItem(USER_GENDER_KEY);
      const storedFitnessGoal = await AsyncStorage.getItem(USER_FITNESS_GOAL_KEY);
      const storedActivityLevel = await AsyncStorage.getItem(USER_ACTIVITY_LEVEL_KEY);
      const storedProfilePicture = await AsyncStorage.getItem(USER_PROFILE_PICTURE_KEY);
      
      if (storedName) setNameInput(storedName);
      if (storedAge) setAgeInput(storedAge);
      if (storedGender) setGenderInput(storedGender);
      if (storedFitnessGoal) setFitnessGoalInput(storedFitnessGoal);
      if (storedActivityLevel) setActivityLevelInput(storedActivityLevel);
      if (storedProfilePicture) setProfilePictureUri(storedProfilePicture);
    } catch (error) {
      console.error('Error loading profile data:', error);
      showToast('Failed to load profile data', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await AsyncStorage.setItem(USER_NAME_KEY, nameInput);
      await AsyncStorage.setItem(USER_AGE_KEY, ageInput);
      await AsyncStorage.setItem(USER_GENDER_KEY, genderInput);
      await AsyncStorage.setItem(USER_FITNESS_GOAL_KEY, fitnessGoalInput);
      await AsyncStorage.setItem(USER_ACTIVITY_LEVEL_KEY, activityLevelInput);
      
      // Handle profile picture separately
      if (profilePictureUri) {
        await AsyncStorage.setItem(USER_PROFILE_PICTURE_KEY, profilePictureUri);
      } else {
        // If profilePictureUri is null, remove the entry from AsyncStorage
        await AsyncStorage.removeItem(USER_PROFILE_PICTURE_KEY);
      }
      
      // Navigate back to profile with success message
      router.back();
      
      // Show success toast after navigation
      setTimeout(() => {
        showToast('Profile updated successfully', 'success');
      }, 300);
    } catch (error) {
      console.error('Error saving profile:', error);
      showToast('Failed to save profile data', 'error');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleProfilePictureChange = () => {
    // Show the ActionSheet
    setActionSheetVisible(true);
  };

  // Generate action sheet options based on current state
  const getActionSheetOptions = (): ActionSheetOption[] => {
    const options: ActionSheetOption[] = [
      {
        label: 'Take Photo',
        onPress: takePhoto,
        icon: 'camera'
      },
      {
        label: 'Choose from Library',
        onPress: pickImage,
        icon: 'image'
      }
    ];
    
    // Only add the remove option if there's a profile picture
    if (profilePictureUri) {
      options.push({
        label: 'Remove Photo',
        onPress: removeProfilePicture,
        icon: 'trash-alt',
        destructive: true
      });
    }
    
    return options;
  };

  const takePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (!permissionResult.granted) {
        showToast('You need to grant camera permissions to take a photo', 'error');
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setProfilePictureUri(uri);
        showToast('Photo added successfully', 'success');
        // Note: We're not saving to AsyncStorage here, only updating local state
        // Changes will be saved when the user presses the Save button
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      showToast('Failed to take photo', 'error');
    }
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        showToast('You need to grant gallery permissions to select a photo', 'error');
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled) {
        const uri = result.assets[0].uri;
        setProfilePictureUri(uri);
        showToast('Photo selected successfully', 'success');
        // Note: We're not saving to AsyncStorage here, only updating local state
        // Changes will be saved when the user presses the Save button
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast('Failed to select image', 'error');
    }
  };

  const removeProfilePicture = async () => {
    try {
      setProfilePictureUri(null);
      showToast('Profile picture removed', 'success');
      // Note: We're not removing from AsyncStorage here, only updating local state
      // Changes will be saved when the user presses the Save button
    } catch (error) {
      console.error('Error removing profile picture:', error);
      showToast('Failed to remove profile picture', 'error');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerBackTitle: 'Profile',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityLabel="Go back to profile"
              accessibilityHint="Navigates back to the profile screen"
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={colors.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Profile picture action sheet */}
      <ActionSheet
        visible={actionSheetVisible}
        title="Profile Picture"
        options={getActionSheetOptions()}
        onClose={() => setActionSheetVisible(false)}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with gradient */}
        <LinearGradient
          colors={[colors.primary, colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={handleProfilePictureChange}
              accessibilityLabel="Change profile picture"
              accessibilityHint="Opens options to change or remove your profile picture"
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.6)']}
                style={styles.avatarGradient}
              >
                {profilePictureUri ? (
                  <Image 
                    source={{ uri: profilePictureUri }} 
                    style={styles.profileImage} 
                    resizeMode="cover"
                  />
                ) : (
                  <FontAwesome5 name="user" size={40} color={colors.primary} />
                )}
                
                <View style={styles.cameraIconContainer}>
                  <FontAwesome5 name="camera" size={14} color="white" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Personalize Your Profile</Text>
            <Text style={styles.headerSubtitle}>Let's help personalize your fitness journey</Text>
          </View>
        </LinearGradient>

        {/* Form Container */}
        <View 
          style={[
            styles.formContainer, 
            { 
              backgroundColor: colors.card,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.3 : 0.1,
              shadowRadius: 6,
              elevation: 4,
            }
          ]}
        >
          {/* Basic Information Section */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <FontAwesome5 name="user" size={16} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Basic Information</Text>
            </View>
            
            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Name
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { 
                    color: colors.text, 
                    borderColor: colors.border, 
                    backgroundColor: isDark ? colors.background : '#F5F5F7',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDark ? 0.2 : 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }
                ]}
                placeholder="Enter your name"
                placeholderTextColor={isDark ? '#888888' : '#999999'}
                value={nameInput}
                onChangeText={setNameInput}
                autoCapitalize="words"
                accessibilityLabel="Name input field"
              />
            </View>

            {/* Age Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Age
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { 
                    color: colors.text, 
                    borderColor: colors.border, 
                    backgroundColor: isDark ? colors.background : '#F5F5F7',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDark ? 0.2 : 0.05,
                    shadowRadius: 2,
                    elevation: 2,
                  }
                ]}
                placeholder="Enter your age"
                placeholderTextColor={isDark ? '#888888' : '#999999'}
                value={ageInput}
                onChangeText={setAgeInput}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel="Age input field"
              />
            </View>
          </View>
          
          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Demographics Section */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <FontAwesome5 name="venus-mars" size={16} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Demographics</Text>
            </View>
            
            {/* Gender Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Gender
              </Text>
              <View style={styles.optionsContainer}>
                {genderOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: genderInput === option
                          ? colors.primary
                          : isDark ? colors.background : '#F5F5F7',
                        borderColor: genderInput === option
                          ? colors.primary
                          : colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: genderInput === option ? 0.2 : 0.05,
                        shadowRadius: 2,
                        elevation: genderInput === option ? 3 : 1,
                      }
                    ]}
                    onPress={() => setGenderInput(option)}
                    accessibilityLabel={`Gender option: ${option}`}
                    accessibilityState={{ selected: genderInput === option }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: genderInput === option
                            ? 'white'
                            : colors.text,
                          fontWeight: genderInput === option ? '600' : '400'
                        }
                      ]}
                    >
                      {option}
                    </Text>
                    {genderInput === option && (
                      <FontAwesome5 
                        name="check" 
                        size={12} 
                        color="white" 
                        style={{ marginLeft: 6 }} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          
          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Fitness Profile Section */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <FontAwesome5 name="dumbbell" size={16} color={colors.primary} style={styles.sectionIcon} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Fitness Profile</Text>
            </View>
            
            {/* Fitness Goal Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Fitness Goal
              </Text>
              <View style={styles.optionsContainer}>
                {fitnessGoalOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: fitnessGoalInput === option
                          ? colors.primary
                          : isDark ? colors.background : '#F5F5F7',
                        borderColor: fitnessGoalInput === option
                          ? colors.primary
                          : colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: fitnessGoalInput === option ? 0.2 : 0.05,
                        shadowRadius: 2,
                        elevation: fitnessGoalInput === option ? 3 : 1,
                      }
                    ]}
                    onPress={() => setFitnessGoalInput(option)}
                    accessibilityLabel={`Fitness goal option: ${option}`}
                    accessibilityState={{ selected: fitnessGoalInput === option }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: fitnessGoalInput === option
                            ? 'white'
                            : colors.text,
                          fontWeight: fitnessGoalInput === option ? '600' : '400'
                        }
                      ]}
                    >
                      {option}
                    </Text>
                    {fitnessGoalInput === option && (
                      <FontAwesome5 
                        name="check" 
                        size={12} 
                        color="white" 
                        style={{ marginLeft: 6 }} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Activity Level Selection */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>
                Activity Level
              </Text>
              <View style={styles.optionsContainer}>
                {activityLevelOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionButton,
                      {
                        backgroundColor: activityLevelInput === option
                          ? colors.primary
                          : isDark ? colors.background : '#F5F5F7',
                        borderColor: activityLevelInput === option
                          ? colors.primary
                          : colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: activityLevelInput === option ? 0.2 : 0.05,
                        shadowRadius: 2,
                        elevation: activityLevelInput === option ? 3 : 1,
                      }
                    ]}
                    onPress={() => setActivityLevelInput(option)}
                    accessibilityLabel={`Activity level option: ${option}`}
                    accessibilityState={{ selected: activityLevelInput === option }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: activityLevelInput === option
                            ? 'white'
                            : colors.text,
                          fontWeight: activityLevelInput === option ? '600' : '400'
                        }
                      ]}
                    >
                      {option}
                    </Text>
                    {activityLevelInput === option && (
                      <FontAwesome5 
                        name="check" 
                        size={12} 
                        color="white" 
                        style={{ marginLeft: 6 }} 
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          
          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Save Button */}
          <TouchableOpacity
            style={styles.saveButtonContainer}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityLabel="Save profile"
            accessibilityHint="Saves your profile information"
          >
            <LinearGradient
              colors={[colors.primary, colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.saveButtonGradient,
                {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 3 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 6,
                }
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Save Profile</Text>
                  <FontAwesome5 name="check" size={16} color="white" style={styles.saveIcon} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Help Info */}
          <View style={styles.helpInfoContainer}>
            <FontAwesome5 name="info-circle" size={14} color={colors.subtext} style={styles.helpIcon} />
            <Text style={[styles.helpText, { color: colors.subtext }]}>
              Your information is stored locally on your device and helps personalize your fitness experience.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  backButton: {
    padding: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  headerGradient: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  avatarContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderRadius: 50,
  },
  avatarGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(78, 84, 200, 0.9)',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  formContainer: {
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 30,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  textInput: {
    height: 54,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  optionButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    margin: 6,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 14,
  },
  saveButtonContainer: {
    marginTop: 32,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  saveIcon: {
    marginLeft: 8,
  },
  helpInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 10,
  },
  helpIcon: {
    marginRight: 8,
  },
  helpText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  formSection: {
    marginBottom: 8,
  },
  
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingLeft: 4,
  },
  
  sectionIcon: {
    marginRight: 8,
  },
  
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  
  divider: {
    height: 1,
    width: '100%',
    marginVertical: 20,
    opacity: 0.7,
  },
}); 