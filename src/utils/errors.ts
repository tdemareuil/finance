// Détection d'une erreur « serveur injoignable » (fetch qui n'aboutit pas) :
// projet Supabase en pause, hors ligne, ou domaine bloqué par un filtrage
// réseau/DNS d'entreprise (type Cisco Umbrella, qui présente un certificat
// invalide → le fetch échoue).

export function isUnreachableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  const status =
    typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : undefined
  return status === 0 || /failed to fetch|networkerror|load failed|fetch/i.test(msg)
}
