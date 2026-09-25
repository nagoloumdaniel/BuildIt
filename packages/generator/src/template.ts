import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
  suggest,
} from '@project-factory/validation';

/**
 * Rendu de template — substitution, et rien d'autre.
 *
 * Un moteur de template classique (Handlebars, EJS, Nunjucks) évalue du code
 * contenu dans les données. Comme les templates de Project Factory viendront un
 * jour d'un registry communautaire (§19), cela reviendrait à exécuter du code
 * tiers sur la machine de l'utilisateur au moment où il génère un projet.
 *
 * Ici il n'y a pas de moteur : une passe de remplacement sur une **liste
 * fermée** de variables. Pas de condition, pas de boucle, pas d'évaluation. Le
 * contenu conditionnel se fait par sélection de templates — deux variantes d'un
 * fichier sont deux templates, pas un template avec un `if`.
 *
 * Conséquence directe : tout ce qui n'est pas `{{variable}}` traverse
 * inchangé. Les backticks et les `${...}` d'un fichier TypeScript ne sont pas
 * interdits, ils ne sont simplement **jamais interprétés**.
 */

/** Variables qu'un template peut utiliser. Liste fermée, volontairement courte. */
export const TEMPLATE_VARIABLES = [
  'projectName',
  'packageName',
  'scope',
  'description',
  'year',
  'nodeVersion',
  'packageManager',
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export type TemplateContext = Readonly<Record<TemplateVariable, string>>;

export const TEMPLATE_ISSUE_CODES = [
  'GEN_UNKNOWN_PLACEHOLDER',
  'GEN_UNCLOSED_PLACEHOLDER',
] as const;

export type TemplateIssueCode = (typeof TEMPLATE_ISSUE_CODES)[number];
export type TemplateIssue = Issue<TemplateIssueCode>;

const MESSAGES: Readonly<Record<TemplateIssueCode, string>> = {
  GEN_UNKNOWN_PLACEHOLDER:
    'Le template {origin} utilise la variable « {value} », qui n’existe pas. Variables disponibles : {expected}.',
  GEN_UNCLOSED_PLACEHOLDER:
    'Le template {origin} contient une accolade ouvrante « {{ » jamais refermée.',
};

const messageFor = createMessageFormatter(MESSAGES);

/**
 * Seuls des noms de variables — pas d'expression, pas de chemin pointé.
 *
 * `{{1 + 1}}` et `{{user.name}}` ne correspondent pas et seront donc signalés
 * comme accolade non fermée ou variable inconnue, jamais évalués.
 */
const PLACEHOLDER = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/**
 * Attrape **toute** paire d'accolades, quel que soit son contenu.
 *
 * C'est ce qui permet de distinguer `{{1 + 1}}` — fermé, mais dont le contenu
 * n'est pas un nom de variable — d'un `{{` réellement non refermé. Les
 * confondre produirait un message faux, et un message faux sur une erreur de
 * sécurité est pire que pas de message.
 */
const ANY_PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES);

function isKnown(name: string): name is TemplateVariable {
  // Un `Set` plutôt qu'un accès indexé sur l'objet de contexte : `{{constructor}}`
  // ou `{{__proto__}}` renverraient sinon une valeur héritée du prototype, écrite
  // telle quelle dans le fichier généré.
  return KNOWN.has(name);
}

/**
 * Rend un template.
 *
 * `origin` sert uniquement aux messages : quand un template est fautif, il faut
 * pouvoir dire lequel sans faire chercher.
 */
export function renderTemplate(
  source: string,
  context: TemplateContext,
  origin: string,
): ParseResult<string, TemplateIssueCode> {
  // L'analyse porte sur la **source**, jamais sur le résultat. Une valeur
  // substituée qui contient elle-même `{{quelque chose}}` est une donnée, pas
  // un template : la contrôler reviendrait à refuser des contenus légitimes et,
  // pire, laisserait croire qu'on l'a interprétée.
  const unknown = new Set<string>();
  let hasPlaceholder = false;

  for (const match of source.matchAll(ANY_PLACEHOLDER)) {
    hasPlaceholder = true;
    const content = (match[1] ?? '').trim();
    if (!isKnown(content)) {
      unknown.add(content.length === 0 ? '(vide)' : content);
    }
  }

  const issues: TemplateIssue[] = [];

  for (const name of unknown) {
    const hint = suggest(name, TEMPLATE_VARIABLES);
    issues.push({
      code: 'GEN_UNKNOWN_PLACEHOLDER',
      path: [origin, name],
      message: messageFor('GEN_UNKNOWN_PLACEHOLDER', {
        origin,
        value: name,
        expected: TEMPLATE_VARIABLES.join(', '),
      }),
      ...(hint === undefined ? {} : { hint: `Vouliez-vous dire « ${hint} » ?` }),
    });
  }

  // Il reste un `{{` alors qu'aucune paire n'a été trouvée : celle-là n'est
  // réellement jamais refermée.
  if (!hasPlaceholder && source.includes('{{')) {
    issues.push({
      code: 'GEN_UNCLOSED_PLACEHOLDER',
      path: [origin],
      message: messageFor('GEN_UNCLOSED_PLACEHOLDER', { origin }),
    });
  }

  if (issues.length > 0) {
    return fail(issues);
  }

  // Substitution en une passe, avec la grammaire stricte. `replace` ne
  // re-parcourt pas ce qu'il vient d'insérer.
  return ok(
    source.replace(PLACEHOLDER, (_match, name: string) => context[name as TemplateVariable]),
  );
}
