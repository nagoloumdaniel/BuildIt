const PATHS = [
  { href: '/create', label: 'Créer un projet' },
  { href: '/clone', label: 'Cloner un projet' },
  { href: '/open', label: 'Ouvrir un projet local' },
];

export default function Home() {
  return (
    <main>
      <h1>Project Factory</h1>
      <nav aria-label="Menu d'accueil">
        <ul>
          {PATHS.map((path) => (
            <li key={path.href}>
              <a href={path.href}>{path.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
