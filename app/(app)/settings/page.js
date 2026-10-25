import SetupChecklist from '@/components/SetupChecklist';
import { requireSession } from '@/lib/auth';
import { getAppUrl, isSendingEnabled } from '@/lib/config';
import { connectDb } from '@/lib/db';
import { getSetupGroups } from '@/lib/setup';
import { getSesAccount, listSesDomains } from '@/lib/ses';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuration' };

export default async function SettingsPage() {
  await requireSession();
  const groups = getSetupGroups();
  const diagnostics = [];
  try {
    const db = await connectDb();
    await db.connection.db.admin().ping();
    diagnostics.push({label:'MongoDB',ok:true,detail:'Connexion et réponse de la base vérifiées.'});
  } catch {
    diagnostics.push({label:'MongoDB',ok:false,detail:'Connexion impossible. Vérifiez l’URI, les droits utilisateur et les accès réseau Atlas.'});
  }
  if (groups.find(g=>g.id==='ses').fields.every(f=>f.valid)) {
    const [account, domains] = await Promise.all([getSesAccount({fresh:true}), listSesDomains({fresh:true})]);
    diagnostics.push({label:'Amazon SES',ok:!account.error,detail:account.error ? 'Lecture du compte impossible : vérifiez les clés IAM, leurs droits et la région.' : account.productionAccess ? 'Compte en production. Lecture des quotas autorisée.' : 'Compte accessible, encore en sandbox : destinataires vérifiés uniquement.'});
    diagnostics.push({label:'Domaine d’envoi',ok:Array.isArray(domains)&&domains.some(d=>d.verified),detail:Array.isArray(domains)&&domains.some(d=>d.verified) ? 'Au moins un domaine est vérifié. Consultez Domaines pour le DKIM et MAIL FROM.' : 'Aucun domaine vérifié accessible dans cette région.'});
  } else diagnostics.push({label:'Amazon SES',ok:false,detail:'Paramètres incomplets : aucun appel au service n’a été effectué.'});
  diagnostics.push({label:'QStash et SNS',ok:false,detail:'Les clés présentes ne prouvent pas la livraison des callbacks. Après configuration, vérifiez la souscription SNS et une campagne programmée de test.'});
  return <div lang="fr"><SetupChecklist groups={groups} configured sending={isSendingEnabled()} appUrl={getAppUrl()} diagnostics={diagnostics}/></div>;
}
