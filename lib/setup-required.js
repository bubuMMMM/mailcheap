// Custom (bubuMMMM): which settings a fresh deploy still needs before the app can work.
// Kept in its own file so upstream syncs merge cleanly. Only names are returned, never values.
import { isCloud } from "@/lib/config";

const REQUIRED = [
	{ name: "MONGODB_URI", what: "Connexion MongoDB avec un nom de base (ex. Atlas …/mailcheap?…)." },
	{ name: "ADMIN_EMAILS", what: "Adresse(s) qui peuvent se connecter et ouvrir /admin, séparées par des virgules." },
	{ name: "EMAIL_FROM", what: "Expéditeur des codes de connexion et alertes, sur un domaine vérifié (SES, PostShiba ou Resend)." },
];

const OPTIONAL = [
	{ name: "SES_ACCESS_KEY_ID / SES_SECRET_ACCESS_KEY / SES_REGION / SES_AWS_ACCOUNT_ID / SES_SNS_TOPIC_ARN", what: "Envoi via Amazon SES (ou POSTSHIBA_* pour PostShiba)." },
	{ name: "QSTASH_TOKEN / QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY", what: "Envoi en arrière-plan et campagnes programmées." },
	{ name: "BLOB_READ_WRITE_TOKEN", what: "Images et pièces jointes dans les emails (Vercel Blob)." },
	{ name: "SENDING_ENABLED=true", what: "Interrupteur final : rien ne part vers les lecteurs sans lui." },
];

export function getMissingSetup(env = process.env) {
	if (isCloud(env)) return [];
	return REQUIRED.filter(({ name }) => !String(env[name] ?? "").trim());
}

export function getSetupLists(env = process.env) {
	return {
		required: REQUIRED.map((r) => ({ ...r, ok: Boolean(String(env[r.name] ?? "").trim()) })),
		optional: OPTIONAL.map((o) => ({ ...o, ok: o.name.split(" / ").every((n) => Boolean(String(env[n.split("=")[0]] ?? "").trim())) })),
	};
}
