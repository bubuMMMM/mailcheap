# Mailcheap — préparation de la mise en service

Audit du 10 octobre 2026. Dépôt de référence : https://github.com/bubuMMMM/mailcheap,
commit `67d13b028a6ecae9ec56d49c4b2db58019217eba` (HEAD vérifié lors de l’audit).

## Résultat

Les fonctionnalités du dépôt original sont conservées. La démo ajoutée précédemment
n’est plus le point d’entrée de production : `/setup` guide la configuration, puis
l’application d’origine s’active automatiquement dès que les quatre paramètres
fondamentaux sont valides et qu’un redéploiement les prend en compte.

- `/setup` : guide avant configuration, aucune saisie ni exposition de secrets.
- `/login` : connexion administrateur du dépôt original.
- `/` : tableau de bord avec données MongoDB réelles.
- `/campaigns`, `/campaigns/[id]` : éditeur riche, HTML/Markdown, autosauvegarde,
  duplication, test, programmation, envoi progressif, pause/reprise, rapports.
- `/contacts` : recherche, statuts, import CSV et gestion de l’engagement.
- `/newsletters`, `/newsletters/new`, `/newsletters/[id]` : newsletters multiples,
  expéditeur, adresse postale, opt-in confirmé, accueil, nettoyage et archives.
- `/domains` : identités SES, DKIM, MAIL FROM et enregistrements DNS.
- `/api-keys` : création et révocation des clés de l’API Mailcheap.
- `/settings` : configuration et diagnostics MongoDB/SES, après authentification.
- `/archive/...`, `/p/...` : archives, articles, auteurs, sitemap et images de partage.
- `/api/v1/...` : inscriptions et brouillons avec authentification par clé API.
- `/api/jobs/...` : tâches QStash avec signature en production.
- `/api/webhooks/ses` : événements SNS signés (livraisons, rebonds, plaintes).
- `/unsubscribe`, `/confirm`, `/keep`, `/o/...`, `/c/...` : désabonnement,
  confirmation, réactivation, ouvertures et clics.
- `/demo` : aperçu fictif séparé, données locales au navigateur, aucun envoi.

## Correctifs appliqués

1. Le mode démo ne bloque plus l’application une fois les paramètres fondamentaux
   complets, même si `DEMO_MODE=true` reste dans une ancienne configuration.
2. Sans ces paramètres, les API et les mutations renvoient 503 ; les pages utiles
   de configuration et de démo restent accessibles. Les actions administratives
   vérifient aussi la configuration et la session côté serveur.
3. Les routes administratives sont dynamiques : aucun accès MongoDB au build.
4. Après une première connexion MongoDB échouée, une requête ultérieure peut
   retenter la connexion (la promesse rejetée n’est plus conservée indéfiniment).
5. Normalisation des variantes `GMT`, `GMT+0` et `GMT-0` vers `UTC`.
6. Écran d’erreur récupérable avec lien vers la configuration.
7. Navigation et connexion principales en français. Les formulaires métier
   originaux sont préservés ; toute l’application n’a pas été retraduite.

## Déjà configuré dans Vercel

Projet `mailcheap`, équipe `bubummmms-projects`.

- `SESSION_SECRET` : secret aléatoire généré et enregistré comme secret, production.
- `APP_URL=https://mailcheap-lyart.vercel.app`.
- `DEMO_MODE=false`.
- `SENDING_ENABLED=false` jusqu’à la mise en service volontaire.
- `SEND_RATE_PER_SECOND=6` (démarrage prudent pour une petite base Atlas).
- Protection Vercel standard : previews et URLs de déploiement protégées, domaine
  de production accessible aux abonnés et callbacks. L’administration est
  protégée par les sessions Mailcheap.

Ne pas modifier `SESSION_SECRET` après le début des envois : il signe également
les liens de désabonnement, qui doivent rester valides.

## À renseigner dans Vercel → Environment Variables → Production

| Objectif | Paramètres restants |
| --- | --- |
| Se connecter et gérer les données | `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12 caractères minimum) |
| Envoyer et traiter les retours | `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `SES_CONFIGURATION_SET`, `SES_SNS_TOPIC_ARN` |
| Traiter les campagnes en arrière-plan | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` |
| Région QStash particulière | `QSTASH_URL` (uniquement si nécessaire) |
| Téléverser des images dans l’éditeur | `BLOB_READ_WRITE_TOKEN` (optionnel, via Vercel Blob) |
| Limites de requêtes partagées | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (optionnels) |
| Recevoir les alertes par email | `ALERT_FROM` (optionnel, expéditeur vérifié SES) |

Après modification des variables, redéployer la **dernière version** du projet
Vercel. Les valeurs ne sont pas lues à chaud par un ancien déploiement.
Aucune migration SQL n’est nécessaire : les modèles Mongoose du dépôt assurent
les collections et index MongoDB. Vérifier que l’utilisateur possède les droits
nécessaires sur la base choisie.

## Étapes externes indispensables, au-delà des clés

1. Créer la base MongoDB, l’utilisateur et l’accès réseau depuis Vercel.
2. Dans la même région AWS, vérifier le domaine SES et publier les DNS DKIM,
   MAIL FROM/SPF et DMARC. Demander l’accès production SES pour sortir du sandbox.
3. Créer le configuration set SES et sa destination d’événements vers SNS.
4. Configurer SNS en signature v2 et créer la souscription HTTPS vers
   `https://mailcheap-lyart.vercel.app/api/webhooks/ses`, sans raw message delivery.
   Attendre le statut Confirmed. Le callback doit être accessible publiquement.
5. Créer sa newsletter dans l’application : nom, expéditeur sur le domaine SES,
   adresse postale et éventuels paramètres d’opt-in/accueil/archives.
6. Passer `SENDING_ENABLED=true`, redéployer, envoyer un test depuis l’éditeur.
7. Vérifier réception, retour de livraison SNS, domaine des liens et désabonnement.
   Tester une programmation QStash avant un envoi à une vraie liste.

## Vérifications effectuées

- Build Next.js réussi sans base ni identifiants de production.
- Vérification ESLint réussie après correction de l’initialisation de la démo.
- 210 tests unitaires existants/étendus réussis, puis un test additionnel de
  reconnexion MongoDB réussi (211 au total).
- Vérifications HTTP de l’installation vide : accueil redirigé vers `/setup`,
  `/setup` et `/demo` répondent 200, API et mutations bloquées par un statut 503.
- 22 vérifications d’intégration avec une base MongoDB locale temporaire :
  connexion via le formulaire serveur réel, cookie de session, création de
  newsletter, rendu des 7 pages administratives, contacts API et déduplication,
  action d’import CSV, brouillon Markdown API, rendu de l’éditeur, sauvegarde,
  refus d’envoi quand désactivé, refus QStash sans signatures configurées,
  désabonnement signé avec vérification MongoDB (GET sans effet), archive publique,
  refus sans clé API et refus après révocation.
- Aucun email envoyé ; aucune donnée de test ajoutée à une base de production.

## Limites de validation

Les accès SES, QStash, SNS, Blob et Redis de production ne sont pas fournis.
Il reste donc à confirmer leur authentification, leurs droits, la réception
réelle des emails et les callbacks après configuration. Une présence de clé
n’est pas une preuve de connectivité. Le diagnostic `/settings` l’indique.

Le navigateur de test n’a pas pu être installé dans cet environnement ; les
contrôles UI ici sont du rendu HTML serveur et du build, pas une validation
visuelle ni une exécution des interactions JavaScript dans un navigateur.

## Source et redéploiements

Le push GitHub a été refusé faute d’identifiants d’écriture. Les modifications
sont commitées dans la copie de travail et déployées à Vercel depuis les sources,
mais ne sont pas encore dans la branche `main` GitHub. Ne pas redéployer l’ancien
commit GitHub : il ne contient pas ces correctifs. Synchroniser cette copie avec
le dépôt avant de reprendre les déploiements automatiques par Git.
