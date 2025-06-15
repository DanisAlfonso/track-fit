import { Tabs } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { FontAwesome } from '@expo/vector-icons';

import Colors from '@/constants/Colors';
import { useTheme } from '@/context/ThemeContext';

/**
 * You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
 */
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={26} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const systemTheme = colorScheme ?? 'light';
  const currentTheme = theme === 'system' ? systemTheme : theme;
  const colors = Colors[currentTheme];
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'transparent',
          paddingBottom: Platform.OS === 'android' ? insets.bottom : 0,
          height: Platform.OS === 'android' ? 50 + insets.bottom : 50,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarBackground: () => (
           <BlurView
             intensity={100}
             tint={currentTheme === 'dark' ? 'dark' : 'light'}
             style={{
               position: 'absolute',
               top: 0,
               left: 0,
               bottom: 0,
               right: 0,
               backgroundColor: currentTheme === 'dark' 
                 ? 'rgba(18, 18, 18, 0.9)' 
                 : 'rgba(248, 248, 248, 0.9)',
             }}
           />
         ),
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color }: { color: string }) => <FontAwesome name="home" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          headerShown: false,
          tabBarIcon: ({ color }: { color: string }) => <FontAwesome name="list" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: 'Routines',
          headerShown: false,
          tabBarIcon: ({ color }: { color: string }) => <FontAwesome name="calendar" size={26} color={color} />,
        }}
      />

    </Tabs>
  );
}
