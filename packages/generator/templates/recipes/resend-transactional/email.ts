import { Resend } from 'resend';

/**
 * Emails transactionnels de {{projectName}} : confirmation, réinitialisation…
 *
 * La clé d'API vient de l'environnement (voir .env.example), jamais du code.
 */
function resendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    throw new Error('RESEND_API_KEY est vide : renseignez-la dans .env.');
  }
  return new Resend(apiKey);
}

/** Envoie un email et renvoie son identifiant ; lève avec la raison de Resend s'il refuse. */
export async function sendEmail(message: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<string> {
  const { data, error } = await resendClient().emails.send(message);
  if (error !== null) {
    throw new Error(`Resend a refusé l’envoi : ${error.message}`);
  }
  return data.id;
}
