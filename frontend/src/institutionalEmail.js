/** Domínios de e-mail públicos — devem coincidir com backend/app/institutional_email.py */

const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.com.br',
  'hotmail.co.uk',
  'hotmail.fr',
  'outlook.com',
  'outlook.com.br',
  'live.com',
  'live.com.br',
  'msn.com',
  'yahoo.com',
  'yahoo.com.br',
  'yahoo.co.uk',
  'yahoo.fr',
  'ymail.com',
  'rocketmail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'pm.me',
  'tutanota.com',
  'tuta.io',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'aol.com',
  'zoho.com',
  'hey.com',
  'fastmail.com',
  'duck.com',
  'yandex.com',
  'yandex.ru',
  'uol.com.br',
  'bol.com.br',
  'terra.com.br',
  'ig.com.br',
  'r7.com',
  'globo.com',
  'oi.com.br',
]);

export function extractEmailDomain(email) {
  const s = (email || '').trim().toLowerCase();
  const at = s.lastIndexOf('@');
  if (at < 0) return '';
  return s.slice(at + 1);
}

/** true se o domínio for de provedor público/gratuito típico */
export function isPublicEmailDomain(email) {
  const d = extractEmailDomain(email);
  return Boolean(d) && PUBLIC_EMAIL_DOMAINS.has(d);
}

/** Mensagem alinhada ao backend (INSTITUTIONAL_EMAIL_HELP_PT) */
export const INSTITUTIONAL_EMAIL_ERROR_PT =
  'Professores devem usar e-mail institucional da universidade (ex.: @universidade.edu.br, @usp.br). ' +
  'E-mails públicos (Gmail, Hotmail, Outlook, UOL etc.) não são aceitos.';

export const REGISTER_PROFESSOR_ONLY_HINT_PT =
  'Cadastro exclusivo para professores. É obrigatório usar e-mail institucional da universidade.';
