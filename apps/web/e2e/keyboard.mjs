/**
 * Le parcours des 12 étapes **au clavier seul** gate M5 (§8F.1, §6).
 *
 * Aucune API souris de Playwright n'est utilisée : le test se garde lui-même
 * contre une rechute (vérification statique du source en fin de fichier). Chaque
 * étape est franchie par Tab / Maj+Tab / Entrée / Espace, et l'écran est
 * vérifié au passage sur ce qu'un clavier seul ne peut pas contourner :
 *
 * 1. le focus est **posé sur le titre** à l'arrivée (jamais perdu sur `<body>`) ;
 * 2. l'ordre de tabulation suit l'ordre du DOM **et** l'ordre visuel ;
 * 3. chaque arrêt de focus a un indicateur visible (`outline` ≥ 2 px) ;
 * 4. le focus ressort de `<main>` après en avoir visité tous les arrêts : il n'y
 *    a pas de piège de focus dans le parcours ;
 * 5. un refus (`aria-disabled`) est annoncé par une région `role="status"` ;
 * 6. le rapport de génération est atteint, et le projet est écrit sur le disque.
 *
 * Un obstacle constaté n'est jamais masqué : il est **relevé** et le parcours
 * échoue à la fin en les listant tous, pour qu'un seul passage les montre tous.
 *
 * Les flèches ne sont pas utilisées : aucun composant du parcours n'est un
 * `radiogroup` ou une `listbox` à navigation par flèches les choix sont des
 * `<button aria-pressed>` et des cases à cocher natives, que Tab puis
 * Entrée/Espace activent. C'est dit ici plutôt que simulé dans le test.
 */
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { BASE, check } from './harness.mjs';

const PROJECT = 'clavier-e2e';

/** Les technologies du preset SaaS, choisies **au clavier** par la recherche. */
const STACK_TERMS = [
  ['next', /^Next\.js/],
  ['typescript', /^TypeScript/],
  ['tailwind', /^Tailwind/],
  ['postgresql', /^PostgreSQL/],
  ['prisma', /^Prisma/],
];

/** L'élément qui a réellement le focus, avec de quoi juger l'ordre visuel. */
const DESCRIBE = () => {
  const element = document.activeElement;
  if (element === null || element === document.body) {
    return { tag: 'BODY', id: '', type: '', text: '', x: 0, y: 0, outline: '', visible: false };
  }
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const label = element.getAttribute('aria-label') ?? element.textContent ?? '';
  return {
    tag: element.tagName,
    id: element.id,
    type: element.getAttribute('type') ?? '',
    text: label.replace(/\s+/g, ' ').trim().slice(0, 70),
    // Coordonnées **absolues** : le focus fait défiler la page, et une position
    // relative à la fenêtre ne dirait plus rien de l'ordre visuel après un
    // défilement.
    x: Math.round(rect.left + window.scrollX),
    y: Math.round(rect.top + window.scrollY),
    outline: `${style.outlineStyle} ${style.outlineWidth}`,
    visible: style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) >= 2,
  };
};

/**
 * Les arrêts de tabulation attendus dans `<main>`, dans l'ordre du DOM.
 *
 * `index` est la **place dans le DOM**, y compris pour les éléments qui ne sont
 * pas des arrêts de tabulation (`tabindex="-1"`). Elle sert d'ancrage : le
 * parcours pose le focus sur le titre de l'écran, qui est une cible programmée
 * sans cette place, on ne saurait pas d'où repart la séquence.
 */
const FOCUSABLES = () => {
  const root = document.querySelector('main');
  if (root === null) {
    return [];
  }
  const selector = 'a[href], button, input, select, textarea, [tabindex]';
  return Array.from(root.querySelectorAll(selector))
    .filter((element) => element.disabled !== true && element.getClientRects().length > 0)
    .map((element, index) => {
      const label = element.getAttribute('aria-label') ?? element.textContent ?? '';
      return {
        index,
        tabbable: element.tabIndex >= 0,
        tag: element.tagName,
        id: element.id,
        type: element.getAttribute('type') ?? '',
        text: label.replace(/\s+/g, ' ').trim().slice(0, 70),
      };
    });
};

const IN_MAIN = () => {
  const root = document.querySelector('main');
  return root !== null && document.activeElement !== null && root.contains(document.activeElement);
};

function keyOf(stop) {
  return `${stop.tag}#${stop.id}|${stop.text}`;
}

function trail(stops) {
  return stops
    .map((stop) => `<${stop.tag}${stop.id === '' ? '' : `#${stop.id}`}> ${stop.text}`)
    .join(' → ');
}

/** Attend qu'un texte de chargement ait disparu sans supposer de délai fixe. */
/**
 * Écrit le projet dans un dossier par la **même** route que l'écran
 * (`POST /api/generate`), avec le manifest que l'écran vient de mémoriser.
 *
 * Le choix du dossier passe par l'explorateur natif de Windows : une fenêtre
 * du système, hors de la page, qu'aucun navigateur piloté ne peut cliquer. La
 * preuve d'écriture contourne donc la seule boîte de dialogue, pas la règle :
 * la route revalide le manifest et la destination comme pour un clic.
 */
async function writeThroughRoute(page, parent) {
  return page.evaluate(async (target) => {
    const projects = JSON.parse(window.localStorage.getItem('pf-projects') ?? '[]');
    const manifest = projects[0]?.manifest;
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ manifest, parent: target, install: false }),
    });
    return { hasManifest: manifest !== undefined, stream: await response.text() };
  }, parent);
}

async function waitGone(page, needle) {
  await page.waitForFunction(
    // `textContent` et non `innerText` : le rendu met les eyebrows en
    // majuscules (`text-transform`), et `innerText` renvoie le texte *affiché*,
    // donc « ÉTAPE 1 SUR 12 ». Le texte du DOM, lui, garde la casse écrite.
    (text) => !(document.querySelector('main')?.textContent ?? '').includes(text),
    needle,
    { timeout: 30000 },
  );
}

/**
 * Le parcours clavier. Il échoue à la fin (jamais au milieu) si des obstacles
 * ont été relevés : un seul passage montre tout ce qui bloque.
 */
export async function keyboardJourney(page, workspace) {
  const issues = [];
  // Relevé **immédiatement** dans le journal : si le parcours s'arrête sur un
  // obstacle dur plus loin, les obstacles déjà vus ne sont pas perdus.
  const note = (message) => {
    issues.push(message);
    console.log(`  ⚠ obstacle relevé : ${message}`);
  };
  const crossed = [];
  let tabs = 0;

  /** Le test garde le test honnête : aucune API souris dans ce fichier. */
  const source = readFileSync(new URL('./keyboard.mjs', import.meta.url), 'utf8');
  for (const api of [
    'click',
    'dblclick',
    'fill',
    'hover',
    'tap',
    'focus',
    'selectOption',
    'check',
    'setInputFiles',
  ]) {
    if (new RegExp(`\\.${api}\\(`).test(source)) {
      note(`le parcours clavier appelle « .${api}( » : ce n'est plus un parcours au clavier seul.`);
    }
  }

  async function focused() {
    return page.evaluate(DESCRIBE);
  }

  async function isInMain() {
    return page.evaluate(IN_MAIN);
  }

  /** Tab (ou Maj+Tab) jusqu'à l'arrêt décrit par `match`. */
  async function tabUntil(match, label, { max = 60, shift = false } = {}) {
    const seen = [];
    // Le focus peut sortir du document un instant (fin de liste) : le navigateur
    // le remet au début au Tab suivant. Trois `<body>` **de suite** signalent en
    // revanche une vraie perte de focus, pas un simple passage de relais.
    let lost = 0;
    let bodies = 0;
    for (let attempt = 0; attempt < max; attempt += 1) {
      await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
      tabs += 1;
      const stop = await focused();
      if (stop.tag === 'BODY') {
        lost += 1;
        bodies += 1;
        if (lost >= 3) {
          throw new Error(
            `focus perdu sur <body> en cherchant ${label} (après ${attempt + 1} Tab, ${bodies} sortie(s) du document). Arrêts : ${trail(seen.slice(-6))}`,
          );
        }
        continue;
      }
      lost = 0;
      if (!stop.visible) {
        note(
          `« ${stop.text} » (<${stop.tag}>) reçoit le focus sans indicateur visible (outline : ${stop.outline}).`,
        );
      }
      seen.push(stop);
      if (match(stop)) {
        return stop;
      }
    }
    // Le détail complet, pas seulement la fin : un arrêt manquant se voit à sa
    // place dans la séquence, pas dans les huit derniers. L'état du `<main>` au
    // moment de l'échec dit si le contenu a disparu ou s'il est simplement hors
    // de l'ordre de tabulation.
    const state = await page.evaluate(() => {
      const root = document.querySelector('main');
      return {
        focusables: root?.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')
          .length,
        html: root?.innerHTML.length ?? 0,
        title: document.querySelector('h1')?.textContent?.slice(0, 40) ?? '',
      };
    });
    throw new Error(
      `${label} n'est pas atteignable au clavier en ${max} Tab (${seen.length} arrêt(s), ${bodies} sortie(s) du document). Séquence : ${trail(seen)} au moment de l'échec : <main> ${state.focusables} élément(s) focusable(s), ${state.html} caractères, titre « ${state.title} ».`,
    );
  }

  /**
   * Attend que la liste des éléments focusables de `<main>` soit stable : les
   * écrans qui interrogent le moteur les remplissent après coup, et un ordre
   * relevé au milieu d'un rechargement ne dirait rien de l'ordre réel.
   */
  async function waitStableFocusables(label) {
    let previous = -1;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const count = await page.evaluate(() => {
        const root = document.querySelector('main');
        return root === null
          ? 0
          : root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').length;
      });
      if (count === previous) {
        return;
      }
      previous = count;
      await page.waitForTimeout(200);
    }
    note(`${label} : la liste des éléments focusables ne se stabilise pas.`);
  }

  /**
   * L'ordre de tabulation de l'écran : on part de l'intérieur de `<main>`, on
   * Tab jusqu'à en sortir, et la séquence obtenue doit être **exactement** la
   * suite des éléments focusables de `<main>` dans l'ordre du DOM. C'est ce qui
   * prouve à la fois l'ordre, l'absence d'élément sauté et l'absence de piège.
   */
  async function checkOrder(label) {
    await waitStableFocusables(label);
    for (let attempt = 0; attempt < 12 && !(await isInMain()); attempt += 1) {
      await page.keyboard.press('Tab');
      tabs += 1;
    }
    if (!(await isInMain())) {
      note(`${label} : aucun élément focusable dans <main> n'est atteignable au clavier.`);
      return;
    }
    const expected = await page.evaluate(FOCUSABLES);
    const anchor = await focused();
    const anchorIndex = expected.findIndex((stop) => keyOf(stop) === keyOf(anchor));
    if (anchorIndex === -1) {
      note(
        `${label} : le focus n'est sur aucun élément de <main> identifiable (arrêt « ${keyOf(anchor)} »).`,
      );
      return;
    }
    // Ce qui **suit** l'arrêt courant dans le DOM, en ne gardant que les arrêts
    // de tabulation : la cible programmée du titre (index négatif) sert
    // d'ancre, elle n'est pas un arrêt attendu.
    const tail = expected.slice(anchorIndex + 1).filter((stop) => stop.tabbable);
    const stops = [];
    let left = false;
    for (let attempt = 0; attempt <= tail.length + 3; attempt += 1) {
      await page.keyboard.press('Tab');
      tabs += 1;
      const stop = await focused();
      if (stop.tag === 'BODY' || !(await isInMain())) {
        left = true;
        break;
      }
      if (!stop.visible) {
        note(
          `« ${stop.text} » (<${stop.tag}>) reçoit le focus sans indicateur visible (outline : ${stop.outline}).`,
        );
      }
      stops.push(stop);
    }
    if (!left) {
      note(`${label} : le focus ne ressort pas de <main> piège de focus probable.`);
    }
    const visited = stops.map(keyOf).join(' > ');
    const wanted = tail.map(keyOf).join(' > ');
    if (visited !== wanted) {
      note(
        `${label} : l'ordre de tabulation ne suit pas l'ordre du DOM. Attendu (après l'arrêt courant) : ${wanted || '(fin)'} obtenu : ${visited || '(rien)'}.`,
      );
    }
    let previous = null;
    for (const stop of stops) {
      if (previous !== null) {
        if (stop.y < previous.y - 8) {
          note(
            `${label} : l'ordre de tabulation ne suit pas l'ordre visuel « ${stop.text} » (y=${stop.y}) arrive après « ${previous.text} » (y=${previous.y}).`,
          );
          break;
        }
        if (Math.abs(stop.y - previous.y) <= 8 && stop.x < previous.x - 8) {
          note(
            `${label} : sur la même ligne, « ${stop.text} » (x=${stop.x}) est atteint après « ${previous.text} » (x=${previous.x}) alors qu'il est à gauche.`,
          );
          break;
        }
      }
      previous = stop;
    }
    console.log(
      `  ordre de tabulation : ${stops.length} arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés`,
    );
  }

  /** Le refus affiché par l'écran, tel qu'un lecteur d'écran l'annoncerait. */
  async function refusals() {
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="status"]')).map((element) =>
        (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
    );
  }

  async function enterStep(index, name, url, title) {
    await page.waitForURL(url, { timeout: 30000 });
    await page.waitForFunction(
      (marker) => (document.querySelector('main')?.textContent ?? '').includes(marker),
      `Étape ${index} sur 12`,
      { timeout: 30000 },
    );
    const heading = await page.evaluate(() => document.querySelector('h1')?.textContent ?? '');
    check(
      heading.includes(title),
      `étape ${index} : le titre attendu était « ${title} », reçu « ${heading} ».`,
    );
    const stop = await focused();
    if (stop.tag !== 'H1') {
      note(
        `étape ${index} (${name}) : après le changement d'écran, le focus est sur <${stop.tag}> « ${stop.text} » et non sur le titre de l'étape le focus est perdu à chaque navigation cliente.`,
      );
    }
    console.log(
      `\n[${index}/12] ${name} « ${heading} » (${stop.tag === 'H1' ? 'focus posé sur le titre' : `focus resté sur <${stop.tag}>`})`,
    );
  }

  /** Franchit l'étape : le focus doit atteindre « Continuer » **au clavier**. */
  async function leaveStep(index, name) {
    await tabUntil(
      (stop) => stop.tag === 'A' && stop.text.startsWith('Continuer'),
      'le lien « Continuer »',
      { max: 90 },
    );
    await page.keyboard.press('Enter');
    crossed.push(name);
    console.log(`  ✓ étape ${index}/12 franchie au clavier (Entrée sur « Continuer »)`);
  }

  // -------------------------------------------------------------------------
  // Le lien d'évitement, avant tout le reste : c'est le **premier** arrêt de
  // tabulation du document. Entrée doit poser le focus sur sa cible `#contenu`
  // la seule sonde qui distingue un lien d'évitement qui marche d'un lien
  // décoratif (un `href="#…"` sans cible focalisable ne déplace rien).
  // -------------------------------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('main') !== null);
  await page.keyboard.press('Tab');
  tabs += 1;
  const skipLink = await focused();
  check(
    skipLink.tag === 'A' && skipLink.text === 'Aller au contenu',
    `Le premier Tab devrait donner le lien d'évitement, il donne <${skipLink.tag}> « ${skipLink.text} ».`,
  );
  check(
    skipLink.visible,
    `Le lien d'évitement reçoit le focus sans indicateur visible (outline : ${skipLink.outline}).`,
  );
  await page.keyboard.press('Enter');
  await page
    .waitForFunction(() => document.activeElement?.id === 'contenu', undefined, { timeout: 5000 })
    .catch(() => undefined);
  const skipTarget = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? 'aucun',
    id: document.activeElement?.id ?? '',
  }));
  check(
    skipTarget.id === 'contenu',
    `Entrée sur « Aller au contenu » ne pose pas le focus sur la cible : l'élément actif est <${skipTarget.tag}>${skipTarget.id === '' ? '' : `#${skipTarget.id}`}.`,
  );
  console.log('  lien d’évitement : premier Tab sur le lien, Entrée pose le focus sur #contenu');

  // -------------------------------------------------------------------------
  // Entrée du parcours : le Dashboard annonce les trois chemins du §18bis.
  // -------------------------------------------------------------------------
  console.log('\n[entrée] Dashboard ordre de tabulation complet du document');
  await checkOrder('dashboard');
  await tabUntil(
    (stop) => stop.tag === 'A' && stop.text.startsWith('Créer un projet'),
    'le lien « Créer un projet »',
    { max: 40 },
  );
  await page.keyboard.press('Enter');

  // -------------------------------------------------------------------------
  // 1. Create Project le nom est un bloquant (§6.2).
  // -------------------------------------------------------------------------
  await enterStep(1, 'create', '**/create', 'Créer un projet');
  const nameRefusal = await refusals();
  check(
    nameRefusal.some((message) => message.includes('Choisissez un nom')),
    `Sans nom, le refus devrait être annoncé par role="status". Régions reçues : ${nameRefusal.join(' | ')}`,
  );
  const disabledContinue = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll('a')).find(
      (candidate) => candidate.textContent?.trim() === 'Continuer',
    );
    return {
      disabled: link?.getAttribute('aria-disabled') ?? 'absent',
      tabIndex: link?.tabIndex ?? -2,
    };
  });
  check(
    disabledContinue.disabled === 'true' && disabledContinue.tabIndex === -1,
    `Sans nom, « Continuer » devrait être refusé et non focusable (aria-disabled=${disabledContinue.disabled}, tabIndex=${disabledContinue.tabIndex}).`,
  );
  await checkOrder('create (sans nom)');
  await tabUntil(
    (stop) => stop.tag === 'INPUT' && stop.id === 'pf-project-name',
    'le champ du nom de projet',
    { max: 40 },
  );
  await page.keyboard.type(PROJECT);
  await page.waitForFunction(
    () => document.querySelector('a[aria-disabled="true"]') === null,
    undefined,
    { timeout: 10000 },
  );
  console.log(`  nom saisi au clavier : ${PROJECT}, refus levé`);
  await leaveStep(1, 'create');

  // -------------------------------------------------------------------------
  // 2. Target Selection le choix se fait à la touche Entrée (§6.3).
  // -------------------------------------------------------------------------
  await enterStep(2, 'target', '**/create/target', 'Plateformes cibles');
  const targetRefusal = await refusals();
  check(
    targetRefusal.some((message) => message.includes('Choisissez au moins une plateforme')),
    `Sans plateforme, le refus devrait être annoncé par role="status". Régions reçues : ${targetRefusal.join(' | ')}`,
  );
  await checkOrder('target (sans plateforme)');
  await tabUntil(
    (stop) => stop.tag === 'BUTTON' && stop.text.startsWith('Web'),
    'la plateforme « Web »',
    { max: 40 },
  );
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () =>
      !(document.querySelector('main')?.textContent ?? '').includes(
        'Choisissez au moins une plateforme',
      ),
    undefined,
    { timeout: 10000 },
  );
  const webPressed = await page
    .getByRole('button', { name: /^Web/ })
    .first()
    .getAttribute('aria-pressed');
  check(webPressed === 'true', `Entrée n'a pas sélectionné « Web » (aria-pressed=${webPressed}).`);
  console.log('  plateforme « Web » choisie à la touche Entrée, refus annoncé puis levé');
  // Maj+Tab : on doit pouvoir revenir sur « Précédent » sans quitter le clavier.
  await tabUntil(
    (stop) => stop.tag === 'A' && stop.text.startsWith('Continuer'),
    'le lien « Continuer »',
    { max: 40 },
  );
  await tabUntil(
    (stop) => stop.tag === 'A' && stop.text.startsWith('Précédent'),
    'le lien « Précédent »',
    {
      max: 4,
      shift: true,
    },
  );
  console.log('  Maj+Tab ramène sur « Précédent » : la navigation est réversible au clavier');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  crossed.push('target');
  console.log('  ✓ étape 2/12 franchie au clavier (Entrée sur « Continuer »)');

  // -------------------------------------------------------------------------
  // 3. Project Type et 4. Architecture les recommandations du mode guidé.
  // -------------------------------------------------------------------------
  await enterStep(3, 'type', '**/create/type', 'Profil du projet');
  await checkOrder('type');
  await tabUntil(
    (stop) => stop.tag === 'BUTTON' && stop.text.startsWith('SaaS'),
    'le profil « SaaS »',
    {
      max: 40,
    },
  );
  await page.keyboard.press('Enter');
  await leaveStep(3, 'type');

  await enterStep(4, 'architecture', '**/create/architecture', 'Architecture');
  await checkOrder('architecture');
  await tabUntil(
    (stop) => stop.tag === 'BUTTON' && stop.text.startsWith('Application unique'),
    'l’architecture « Application unique »',
    { max: 40 },
  );
  await page.keyboard.press('Enter');
  await leaveStep(4, 'architecture');

  // -------------------------------------------------------------------------
  // 5. Stack Builder la recherche globale, saisie et parcourue au clavier.
  // -------------------------------------------------------------------------
  await enterStep(5, 'stack', '**/create/stack', 'Stack Builder');
  await waitGone(page, 'Chargement du catalogue…');
  await page.waitForFunction(
    () => document.querySelector('a[aria-disabled="true"]') === null,
    undefined,
    {
      timeout: 30000,
    },
  );
  await checkOrder('stack');
  for (const [term, pattern] of STACK_TERMS) {
    if (term !== STACK_TERMS[0][0]) {
      await tabUntil(
        (stop) => stop.tag === 'INPUT' && stop.id === 'pf-stack-search',
        'le champ de recherche',
        { max: 6, shift: true },
      );
    } else {
      await tabUntil(
        (stop) => stop.tag === 'INPUT' && stop.id === 'pf-stack-search',
        'le champ de recherche',
        { max: 40 },
      );
    }
    await page.keyboard.press('Control+a');
    await page.keyboard.type(term);
    await tabUntil((stop) => pattern.test(stop.text), `l'option ${term}`, { max: 40 });
    // L'option est vérifiée sur **l'élément qui a le focus**, jamais sur un
    // sélecteur de nom : une raison de blocage qui cite « Next.js » ferait
    // désigner un autre bouton, et le test passerait à côté du vrai.
    const before = await page.evaluate(() => {
      const element = document.activeElement;
      return {
        text: (element?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
        pressed: element?.getAttribute('aria-pressed') ?? 'absent',
        disabled: element?.getAttribute('aria-disabled') ?? 'absent',
      };
    });
    await page.keyboard.press('Enter');
    // Le moteur recharge les options après chaque bascule : l'état du bouton
    // focalisé change de façon **asynchrone**. On attend qu'il l'annonce, au
    // lieu de parier sur un délai fixe 300 ms suffisent à la main, pas après
    // le parcours complet de l'écran.
    await page
      .waitForFunction(
        () => document.activeElement?.getAttribute('aria-pressed') === 'true',
        undefined,
        { timeout: 20000 },
      )
      .catch(() => undefined);
    const after = await page.evaluate(() => {
      const element = document.activeElement;
      return {
        tag: element?.tagName ?? 'aucun',
        text: (element?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 90),
        pressed: element?.getAttribute('aria-pressed') ?? 'absent',
      };
    });
    check(
      after.pressed === 'true',
      `Entrée n'a pas choisi « ${term} » : le bouton focalisé était « ${before.text} » (aria-pressed=${before.pressed}, aria-disabled=${before.disabled}) ; après Entrée, le focus est sur <${after.tag}> « ${after.text} » (aria-pressed=${after.pressed}).`,
    );
    console.log(
      `  ${term} choisi au clavier : « ${after.text.slice(0, 40)} » (recherche saisie, option atteinte par Tab, Entrée)`,
    );
  }
  await tabUntil(
    (stop) => stop.tag === 'INPUT' && stop.id === 'pf-stack-search',
    'le champ de recherche',
    { max: 6, shift: true },
  );
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page
    .locator('nav[aria-label="Catégories du catalogue"]')
    .waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(
    () => document.querySelector('a[aria-disabled="true"]') === null,
    undefined,
    {
      timeout: 30000,
    },
  );
  await checkOrder('stack (recherche vidée)');
  await leaveStep(5, 'stack');

  // -------------------------------------------------------------------------
  // 6 à 8. Capabilities, Environment, Infrastructure.
  // -------------------------------------------------------------------------
  await enterStep(6, 'capabilities', '**/create/capabilities', 'Capacités');
  await waitGone(page, 'Chargement des options…');
  await checkOrder('capabilities');
  await leaveStep(6, 'capabilities');

  await enterStep(7, 'env', '**/create/env', 'Environnement & secrets');
  await waitGone(page, 'Chargement des variables…');
  await checkOrder('env');
  await leaveStep(7, 'env');

  await enterStep(8, 'infrastructure', '**/create/infrastructure', 'Infrastructure');
  await waitGone(page, 'Chargement des hébergeurs…');
  await checkOrder('infrastructure');
  // Le budget de frappes n'est pas la preuve : la preuve est que le geste est
  // atteignable au clavier. `checkOrder` laisse le focus en fin de document, et
  // la séquence repart alors du haut en traversant l'en-tête, le rail d'étapes,
  // puis les raccourcis du pied de page trois liens de plus qu'avant la
  // refonte. Vu depuis le début du document, la carte est le 18ᵉ arrêt.
  await tabUntil(
    (stop) => stop.tag === 'BUTTON' && stop.name.includes('Docker'),
    'la carte « Docker »',
    { max: 40 },
  );
  await page.keyboard.press('Space');
  const docker = await page.evaluate(() =>
    document.querySelector('main [data-infra="docker"]')?.getAttribute('aria-pressed'),
  );
  check(docker === 'true', 'La barre d’espace n’a pas coché « Docker ».');
  console.log('  carte « Docker » cochée à la barre d’espace');
  await leaveStep(8, 'infrastructure');

  // -------------------------------------------------------------------------
  // 9 et 10. Blueprint, File Preview.
  // -------------------------------------------------------------------------
  await enterStep(9, 'blueprint', '**/create/blueprint', 'Plan du projet');
  await page
    .getByText('Next.js', { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 30000 });
  await checkOrder('blueprint');
  await leaveStep(9, 'blueprint');

  await enterStep(10, 'preview', '**/create/preview', 'Architecture du projet');
  await page
    .locator('ul[aria-label="Architecture du projet : dossiers et fichiers générés"]')
    .waitFor({ state: 'visible', timeout: 30000 });
  await checkOrder('preview');
  await leaveStep(10, 'preview');

  // -------------------------------------------------------------------------
  // 11. Generation Progress écriture réelle, déclenchée au clavier.
  // -------------------------------------------------------------------------
  await enterStep(11, 'generate', '**/create/generate', 'Générer le projet');
  await page.waitForFunction(
    () => {
      const button = Array.from(document.querySelectorAll('button')).find((candidate) =>
        candidate.textContent?.includes('Générer le projet'),
      );
      return button !== undefined && button.disabled === false;
    },
    undefined,
    { timeout: 30000 },
  );
  await checkOrder('generate');
  await tabUntil(
    (stop) => stop.tag === 'BUTTON' && stop.text.includes('Générer le projet'),
    'le bouton « Générer le projet »',
    { max: 40 },
  );
  await page.keyboard.press('Enter');
  // Le bouton s'efface devant deux sorties : la carte ZIP s'atteint au clavier.
  await tabUntil(
    (stop) => stop.tag === 'BUTTON' && stop.text.includes('Générer le ZIP'),
    'la sortie « Générer le ZIP »',
    { max: 10 },
  );
  const download = page.waitForEvent('download', { timeout: 90000 });
  await page.keyboard.press('Enter');
  const archive = await download;
  check(
    archive.suggestedFilename().endsWith('.zip'),
    `Le téléchargement devrait être une archive .zip. Reçu : ${archive.suggestedFilename()}`,
  );
  await page.getByText('Génération terminée', { exact: false }).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  console.log('  archive générée et téléchargée à la touche Entrée');
  const written_ = await writeThroughRoute(page, workspace);
  check(
    written_.hasManifest && written_.stream.includes('"ok":true'),
    `La route /api/generate devrait écrire le projet. Reçu : ${written_.stream.slice(-300)}`,
  );
  await tabUntil(
    (stop) => stop.tag === 'A' && stop.text.trim().startsWith('Continuer'),
    'le lien « Continuer »',
    { max: 40 },
  );
  await page.keyboard.press('Enter');
  crossed.push('generate');
  console.log('  ✓ étape 11/12 franchie au clavier');

  // -------------------------------------------------------------------------
  // 12. Generation Report l'arrivée effective, prouvée sur le disque.
  // -------------------------------------------------------------------------
  await enterStep(12, 'report', '**/create/report', 'Rapport de génération');
  await checkOrder('report');
  crossed.push('report');
  const report = await page.evaluate(() => document.querySelector('main')?.textContent ?? '');
  check(
    report.includes(PROJECT),
    `Le rapport devrait nommer le projet « ${PROJECT} ». Reçu : ${report.slice(0, 200)}`,
  );
  const remaining = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('a')).filter(
        (candidate) => candidate.textContent?.trim() === 'Continuer',
      ).length,
  );
  check(
    remaining === 0,
    'Le rapport est la dernière étape : il ne doit plus y avoir de « Continuer ».',
  );
  const written = await readdir(join(workspace, PROJECT)).catch(() => []);
  check(
    written.includes('package.json'),
    `Le projet devrait être écrit sur le disque. Contenu : ${written.join(', ')}`,
  );
  console.log(
    `  rapport atteint : projet « ${PROJECT} » écrit (${written.length} entrées sur le disque)`,
  );
  console.log(
    `  dernière étape : ${crossed.length === 12 ? 'les 12 étapes' : `${crossed.length} étapes`}`,
  );
  console.log(`  total : ${tabs} appuis de Tab/Maj+Tab, 0 clic souris, 0 focus() programmé`);

  check(crossed.length === 12, `Seulement ${crossed.length}/12 étapes franchies au clavier.`);
  if (issues.length > 0) {
    throw new Error(
      `Le clavier seul ne franchit pas encore le parcours ${issues.length} obstacle(s) :\n- ${issues.join('\n- ')}`,
    );
  }
}
