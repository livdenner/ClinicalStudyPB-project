import { Stack } from 'expo-router';

// Expo Router registra as telas pelo nome do arquivo em src/app/.

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Início' }} />
      <Stack.Screen name="studies" options={{ title: 'Estudos' }} />
    </Stack>
  );
}
