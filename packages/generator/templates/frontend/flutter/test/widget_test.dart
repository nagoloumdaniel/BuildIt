import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:{{identifier}}/main.dart';

void main() {
  testWidgets('le compteur augmente à chaque appui', (tester) async {
    await tester.pumpWidget(const App());
    expect(find.text('Appuis : 0'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.add));
    await tester.pump();

    expect(find.text('Appuis : 1'), findsOneWidget);
  });
}
