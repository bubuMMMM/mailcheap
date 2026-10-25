'use client';
import Link from 'next/link';
export default function AppError({ reset }) {
  return <section lang="fr" className="mx-auto my-12 max-w-xl rounded-2xl border bg-card p-8"><h1 className="text-xl font-semibold">Un service n’a pas répondu.</h1><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Vérifiez les connexions et les paramètres de votre installation. Vos données ne sont pas remplacées par des données de démonstration.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">Réessayer</button><Link className="rounded-lg border px-4 py-2 text-sm" href="/settings">Vérifier la configuration</Link></div></section>;
}
