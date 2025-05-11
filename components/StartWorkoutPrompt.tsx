import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';
import { useColorScheme } from 'react-native';

interface StartWorkoutPromptProps {
  routineName: string;
  exerciseCount: number;
  setCount: number;
  isSaving: boolean;
  onStart: () => void;
}

export const StartWorkoutPrompt: React.FC<StartWorkoutPromptProps> = ({
  routineName,
  exerciseCount,
  setCount,
  isSaving,
  onStart,
}) => {
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];

  return (
    <View style={styles.startWorkoutContainer}>
      <View style={styles.startWorkoutContent}>
        <FontAwesome name="trophy" size={48} color={colors.primary} style={styles.startWorkoutIcon} />
        <Text style={[styles.startWorkoutTitle, { color: colors.text }]}>Ready to Begin?</Text>
        <Text style={[styles.startWorkoutDescription, { color: colors.subtext }]}> 
          You're about to start "{routineName}" with {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} and {setCount} total set{setCount !== 1 ? 's' : ''}.
        </Text>
        <TouchableOpacity 
          style={[styles.startButton, { backgroundColor: colors.primary }]}
          onPress={onStart}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <FontAwesome name="play-circle" size={20} color="white" style={styles.startButtonIcon} />
              <Text style={styles.startButtonText}>Start Workout</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  startWorkoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  startWorkoutContent: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  startWorkoutIcon: {
    marginBottom: 24,
  },
  startWorkoutTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  startWorkoutDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  startButtonIcon: {
    marginRight: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
}); 