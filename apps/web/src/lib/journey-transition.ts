/**
 * Le sens du glissement entre deux étapes du parcours.
 *
 * Avancer fait entrer l'écran par la droite, reculer par la gauche : le
 * mouvement redit ce que le stepper montre déjà, il n'invente rien. Encore
 * faut-il savoir d'où l'on vient. Next remonte la page à chaque étape, donc le
 * composant ne peut pas se souvenir de l'étape précédente : c'est ce module
 * qui s'en souvient, dans une variable de module. Elle survit à la navigation
 * côté client (le module n'est évalué qu'une fois) et repart de zéro au
 * rechargement : un accès direct ou un F5 n'a pas de « précédent », donc pas
 * de glissement.
 *
 * La décision est pure (`slideDirection`) ; la mémoire est une petite fabrique
 * (`createStepMemory`) pour que les tests en aient chacun une neuve.
 */

export type SlideDirection = 'forward' | 'backward' | 'none';

/** La dernière étape montrée, et quand on l'a quittée. */
export interface StepTrace {
  readonly index: number;
  /**
   * `null` tant que l'écran est monté. Pendant une navigation, la nouvelle
   * page se rend **avant** que l'ancienne soit démontée : la trace lue au
   * rendu est donc celle d'un écran encore à l'écran, et elle vaut.
   */
  readonly leftAt: number | null;
}

/**
 * Au-delà, la trace est périmée : l'utilisateur est passé par l'accueil ou un
 * autre écran, et revenir au parcours n'est pas « l'étape d'après ». Glisser
 * depuis une étape quittée il y a une minute raconterait un trajet qui n'a
 * pas eu lieu.
 */
export const TRACE_TTL_MS = 2000;

export function slideDirection(
  trace: StepTrace | null,
  index: number,
  now: number,
): SlideDirection {
  if (trace === null || index < 0) {
    return 'none';
  }
  if (trace.leftAt !== null && now - trace.leftAt > TRACE_TTL_MS) {
    return 'none';
  }
  if (index > trace.index) {
    return 'forward';
  }
  // Même rang : un remontage sans changement d'étape ne bouge pas.
  return index < trace.index ? 'backward' : 'none';
}

export interface StepMemory {
  read(): StepTrace | null;
  /** L'écran de ce rang vient de s'afficher. */
  enter(index: number): void;
  /** L'écran de ce rang se démonte ; ignoré si un autre a déjà pris la place. */
  leave(index: number, now: number): void;
  /** Oublie tout : après une annulation, le prochain parcours part de rien. */
  clear(): void;
}

export function createStepMemory(): StepMemory {
  let trace: StepTrace | null = null;
  return {
    read: () => trace,
    enter(index) {
      trace = { index, leftAt: null };
    },
    leave(index, now) {
      if (trace !== null && trace.index === index && trace.leftAt === null) {
        trace = { index, leftAt: now };
      }
    },
    clear() {
      trace = null;
    },
  };
}

/** La mémoire du navigateur. Côté serveur, elle n'est jamais lue. */
export const stepMemory: StepMemory = createStepMemory();
