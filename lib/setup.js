import { getConfigProblems } from './config.js';

// Pure configuration checks shared by the startup hook, proxy and authenticated diagnostics.
// Only key names and booleans may be sent to the browser, never environment values.
const has = (env, key) => typeof env[key] === 'string' && env[key].trim().length > 0;
const field = (key, valid, hint) => ({ key, valid, hint });

export function getSetupGroups(env = process.env) {
  const mongo = env.MONGODB_URI || '';
  const email = env.ADMIN_EMAIL || '';
  return [
    { id: 'core', title: 'Accès et base de données', required: true, description: 'Ces quatre paramètres ouvrent l’application complète : connexion, newsletters, contacts et brouillons.', fields: [
      field('MONGODB_URI', /^mongodb(?:\+srv)?:\/\/[^/]+\/[^?\s/]+(?:\?.*)?$/.test(mongo), 'URI MongoDB avec un nom de base, par exemple /mailcheap avant le point d’interrogation.'),
      field('ADMIN_EMAIL', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Votre adresse de connexion et de réception des emails de test.'),
      field('ADMIN_PASSWORD', (env.ADMIN_PASSWORD || '').length >= 12, 'Au moins 12 caractères. À choisir dans Vercel, jamais dans le code.'),
      field('SESSION_SECRET', (env.SESSION_SECRET || '').length >= 32, 'Secret aléatoire de 32 caractères minimum. Ne pas le changer après les premiers envois.'),
    ]},
    { id: 'ses', title: 'Amazon SES et retours de livraison', required: true, description: 'Pour envoyer les emails et traiter les rebonds, plaintes et confirmations de livraison.', fields: [
      field('SES_REGION', has(env, 'SES_REGION'), 'La même région AWS pour SES, le configuration set et SNS.'),
      field('SES_ACCESS_KEY_ID', has(env, 'SES_ACCESS_KEY_ID'), 'Clé d’accès de l’utilisateur IAM autorisé à envoyer et lire les identités SES.'),
      field('SES_SECRET_ACCESS_KEY', has(env, 'SES_SECRET_ACCESS_KEY'), 'Secret associé à la clé IAM, à enregistrer comme secret Vercel.'),
      field('SES_CONFIGURATION_SET', has(env, 'SES_CONFIGURATION_SET'), 'Nom du configuration set SES dont les événements vont vers SNS.'),
      field('SES_SNS_TOPIC_ARN', /^arn:aws(?:-[a-z]+)?:sns:[a-z0-9-]+:\d{12}:[A-Za-z0-9_-]+$/.test(env.SES_SNS_TOPIC_ARN || ''), 'ARN du topic SNS qui publie les événements SES.'),
    ]},
    { id: 'qstash', title: 'Envoi par lots et programmation', required: true, description: 'QStash exécute les campagnes en arrière-plan. Les trois clés sont nécessaires en production.', fields: [
      field('QSTASH_TOKEN', has(env, 'QSTASH_TOKEN'), 'Jeton QStash fourni par Upstash.'),
      field('QSTASH_CURRENT_SIGNING_KEY', has(env, 'QSTASH_CURRENT_SIGNING_KEY'), 'Clé de signature actuelle des tâches.'),
      field('QSTASH_NEXT_SIGNING_KEY', has(env, 'QSTASH_NEXT_SIGNING_KEY'), 'Prochaine clé de signature, pour la rotation.'),
    ]},
    { id: 'blob', title: 'Images dans l’éditeur', required: false, description: 'Optionnel : sans Blob, les images déjà hébergées restent utilisables dans le HTML.', fields: [
      field('BLOB_READ_WRITE_TOKEN', has(env, 'BLOB_READ_WRITE_TOKEN'), 'Connecter un stockage Vercel Blob au projet pour téléverser des images.'),
    ]},
    { id: 'redis', title: 'Limites partagées entre serveurs', required: false, description: 'Optionnel : sans Redis, le limiteur en mémoire du dépôt original reste actif.', fields: [
      field('UPSTASH_REDIS_REST_URL', /^https:\/\//.test(env.UPSTASH_REDIS_REST_URL || ''), 'URL REST de la base Upstash Redis.'),
      field('UPSTASH_REDIS_REST_TOKEN', has(env, 'UPSTASH_REDIS_REST_TOKEN'), 'Jeton REST de cette même base Redis.'),
    ]},
  ];
}

export function isCoreConfigured(env = process.env) {
  return getConfigProblems(env).length === 0 && getSetupGroups(env)[0].fields.every(({ valid }) => valid);
}

export function getRuntimeMode(env = process.env) {
  // Complete credentials always restore the original application, even after an earlier demo deploy.
  if (isCoreConfigured(env)) return 'live';
  return env.DEMO_MODE === 'true' ? 'demo' : 'setup';
}

export function getSetupGate(pathname, method, env = process.env) {
  const mode = getRuntimeMode(env);
  if (mode === 'live') return null;
  if (!['GET', 'HEAD'].includes(method) || pathname.startsWith('/api/')) return { type: 'unavailable' };
  if (['/setup', '/demo', '/favicon.ico'].includes(pathname)) return null;
  return { type: 'redirect', pathname: mode === 'demo' ? '/demo' : '/setup' };
}
