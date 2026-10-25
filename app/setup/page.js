import { redirect } from 'next/navigation';
import SetupChecklist from '@/components/SetupChecklist';
import { getAppUrl, isSendingEnabled } from '@/lib/config';
import { getSetupGroups, isCoreConfigured } from '@/lib/setup';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuration' };
export default function SetupPage() {
  if (isCoreConfigured()) redirect('/settings');
  return <main lang="fr" className="min-h-dvh bg-muted/25 px-4 py-8 md:px-10 md:py-12"><SetupChecklist groups={getSetupGroups()} configured={false} sending={isSendingEnabled()} appUrl={getAppUrl()}/></main>;
}
