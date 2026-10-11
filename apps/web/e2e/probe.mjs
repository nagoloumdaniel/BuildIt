// Sonde de DOM : liste les elements interactifs reellement servis par l'app.
// Sert a ecrire le test E2E sur le vrai rendu, pas sur une supposition.
const routes = process.argv.slice(2);
const base = process.env['PF_PROBE_BASE'] ?? 'http://127.0.0.1:4180';

for (const route of routes) {
  const html = await (await fetch(base + route)).text();
  const text = (chunk) =>
    chunk
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 70);
  const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) => text(m[1]));
  const links = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    (m) => `${m[1]} => ${text(m[2])}`,
  );
  const inputs = [...html.matchAll(/<(input|textarea|select)[^>]*?(?:id|name)="([^"]*)"/g)].map(
    (m) => `${m[1]}#${m[2]}`,
  );
  const pressed = (html.match(/aria-pressed="true"/g) ?? []).length;
  console.log(`\n=== ${route} ===`);
  console.log('inputs :', inputs.join(' | '));
  console.log('liens  :', links.slice(0, 8).join(' | '));
  console.log('boutons:', buttons.slice(0, 10).join(' | '));
  console.log('aria-pressed=true :', pressed);
}
