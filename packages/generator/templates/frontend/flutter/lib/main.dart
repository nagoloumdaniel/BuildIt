import 'package:flutter/material.dart';

void main() {
  runApp(const App());
}

/// Racine de l'application. Remplacez l'écran d'accueil : c'est votre projet.
class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '{{projectName}}',
      theme: ThemeData(colorSchemeSeed: Colors.indigo),
      home: const HomeScreen(),
    );
  }
}

/// Écran d'accueil : un compteur, de quoi vérifier que tout est câblé.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('{{projectName}}')),
      body: Center(child: Text('Appuis : $_count')),
      floatingActionButton: FloatingActionButton(
        onPressed: () => setState(() => _count += 1),
        tooltip: 'Ajouter',
        child: const Icon(Icons.add),
      ),
    );
  }
}
