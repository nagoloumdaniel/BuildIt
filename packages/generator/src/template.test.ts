import { describe, expect, it } from 'vitest';
import { renderTemplate, TEMPLATE_VARIABLES, type TemplateContext } from './template.js';

const CONTEXT: TemplateContext = {
  projectName: 'quai3',
  packageName: '@acme/quai3',
  scope: '@acme',
  description: 'Une application',
  year: '2026',
  nodeVersion: '>=20.11.0',
  packageManager: 'pnpm@11.13.1',
};

function render(source: string): string {
  const result = renderTemplate(source, CONTEXT, 'test');
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(' | '));
  }
  return result.value;
}

function codesOf(source: string): string[] {
  const result = renderTemplate(source, CONTEXT, 'test');
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('substitution', () => {
  it.each(TEMPLATE_VARIABLES)('remplace {{%s}}', (variable) => {
    expect(render(`valeur: {{${variable}}}`)).toBe(`valeur: ${CONTEXT[variable]}`);
  });

  it('remplace plusieurs occurrences', () => {
    expect(render('{{projectName}}/{{projectName}}')).toBe('quai3/quai3');
  });

  it('tolère les espaces dans les accolades', () => {
    expect(render('{{ projectName }}')).toBe('quai3');
  });

  it('laisse intact un template sans variable', () => {
    expect(render('rien à substituer')).toBe('rien à substituer');
  });

  it('gère un template vide', () => {
    expect(render('')).toBe('');
  });

  it('préserve les sauts de ligne et l’indentation', () => {
    expect(render('{\n  "name": "{{packageName}}"\n}\n')).toBe('{\n  "name": "@acme/quai3"\n}\n');
  });
});

/**
 * La propriété de sécurité du §24 : le moteur ne connaît **que** la
 * substitution. Tout le reste traverse sans être interprété.
 *
 * Ces tests ne prouvent pas que les syntaxes étrangères sont interdites — elles
 * ne le sont pas, un template Next.js contient légitimement des backticks — mais
 * qu'elles ne sont **pas exécutées**.
 */
describe('aucune exécution de code', () => {
  it('laisse passer une interpolation JavaScript sans l’évaluer', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: le `${…}` littéral est l'objet du test — il ne doit jamais être évalué.
    const source = 'const x = `bonjour ${process.env.SECRET}`;';
    expect(render(source)).toBe(source);
  });

  it('laisse passer un appel de fonction sans l’exécuter', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: le `${…}` littéral est l'objet du test — il ne doit jamais être évalué.
    const source = 'const x = `${process.exit(1)}`;';
    expect(render(source)).toBe(source);
  });

  it('laisse passer une syntaxe EJS sans l’interpréter', () => {
    const source = '<%= 1 + 1 %>';
    expect(render(source)).toBe(source);
  });

  it('laisse passer une syntaxe Ruby sans l’interpréter', () => {
    const source = '#{1 + 1}';
    expect(render(source)).toBe(source);
  });

  it('laisse passer des backticks', () => {
    const source = 'const sql = `SELECT * FROM "users"`;';
    expect(render(source)).toBe(source);
  });

  it('n’évalue pas une expression placée dans des accolades', () => {
    expect(codesOf('{{1 + 1}}')).toContain('GEN_UNKNOWN_PLACEHOLDER');
  });

  it('refuse {{eval}}', () => {
    expect(codesOf('{{eval}}')).toContain('GEN_UNKNOWN_PLACEHOLDER');
  });
});

/**
 * Le remplacement se fait par liste blanche explicite, jamais par accès
 * dynamique à un objet. Sans cette précaution, `{{constructor}}` renverrait le
 * constructeur d'Object, écrit tel quel dans le fichier généré.
 */
describe('pas d’accès au prototype', () => {
  it.each(['constructor', 'toString', 'valueOf', 'hasOwnProperty'])('refuse {{%s}}', (name) => {
    expect(codesOf(`{{${name}}}`)).toContain('GEN_UNKNOWN_PLACEHOLDER');
  });

  it('refuse __proto__', () => {
    expect(codesOf('{{__proto__}}')).toContain('GEN_UNKNOWN_PLACEHOLDER');
  });
});

describe('placeholders invalides', () => {
  it('refuse une variable inconnue', () => {
    expect(codesOf('{{inconnue}}')).toContain('GEN_UNKNOWN_PLACEHOLDER');
  });

  it('propose une correction sur une faute de frappe', () => {
    const result = renderTemplate('{{projetName}}', CONTEXT, 'test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.hint).toContain('projectName');
    }
  });

  it('nomme le template fautif — on doit savoir lequel corriger', () => {
    const result = renderTemplate('{{inconnue}}', CONTEXT, 'frontend/next/page.tsx');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('frontend/next/page.tsx');
    }
  });

  it('refuse une accolade non fermée', () => {
    expect(codesOf('{{projectName')).toContain('GEN_UNCLOSED_PLACEHOLDER');
  });

  it('rapporte toutes les variables inconnues d’un coup', () => {
    const result = renderTemplate('{{a}} {{b}} {{c}}', CONTEXT, 'test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(3);
    }
  });

  it('ne signale qu’une fois une variable inconnue répétée', () => {
    const result = renderTemplate('{{a}} {{a}}', CONTEXT, 'test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
    }
  });
});

/**
 * Une valeur substituée qui contiendrait elle-même un placeholder ne doit pas
 * être re-parcourue : ce serait une porte d'entrée par les données.
 */
describe('substitution non récursive', () => {
  it('ne re-substitue pas le contenu d’une valeur', () => {
    const piege: TemplateContext = { ...CONTEXT, description: '{{projectName}}' };
    const result = renderTemplate('{{description}}', piege, 'test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('{{projectName}}');
    }
  });
});

describe('renderTemplate ne lève jamais', () => {
  it.each(['', '{{', '}}', '{{}}', '{{{{}}}}', '{'.repeat(1000)])('sur %s', (source) => {
    expect(() => renderTemplate(source, CONTEXT, 'test')).not.toThrow();
  });
});
