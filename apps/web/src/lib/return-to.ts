/**
 * Le retour interne après une connexion GitHub (§20bis).
 *
 * Le flux de connexion part de plusieurs écrans (la génération en premier,
 * l'écran « Compte GitHub » par défaut) et doit y revenir une fois connecté.
 * L'adresse de retour vient d'un paramètre d'URL, donc du navigateur : elle
 * n'est jamais crue sur parole. Une adresse sûre commence par un seul `/`,
 * ne contient ni backslash, ni caractère de contrôle, ni `//` en tête — ce
 * dernier ouvrirait une redirection vers un domaine tiers.
 */

/** Une adresse de retour interne sûre, ou `undefined` si elle n'en est pas une. */
export function safeReturnTo(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed === '' || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return undefined;
  }
  if (trimmed.includes('\\')) {
    return undefined;
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}
