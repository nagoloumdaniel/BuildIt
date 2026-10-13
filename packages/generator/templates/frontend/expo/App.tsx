import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Écran d'accueil. Il existe pour que `pnpm dev` montre quelque chose au
 * premier lancement. Remplacez-le : c'est votre application.
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{{projectName}}</Text>
      <Text>Modifiez App.tsx pour commencer.</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
  },
  title: { fontSize: 24, fontWeight: '600' },
});
