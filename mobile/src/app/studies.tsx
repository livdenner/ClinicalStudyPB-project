import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudiesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Estudos
        </Text>
        <Text style={styles.description}>
          Esta tela é apenas um destino provisório para demonstrar a navegação.
        </Text>
        <Link href="/" asChild>
          <Pressable accessibilityRole="button" style={styles.button}>
            <Text style={styles.buttonText}>Voltar ao início</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    color: '#17324d',
    fontSize: 28,
    fontWeight: '700',
  },
  description: {
    color: '#526274',
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#176b87',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
