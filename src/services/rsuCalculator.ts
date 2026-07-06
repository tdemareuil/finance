import type { RsuGrant, VestingEvent } from '../types'

function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const totalMonths = y * 12 + (m - 1) + months
  const year = Math.floor(totalMonths / 12)
  const month = (totalMonths % 12) + 1
  const lastDay = new Date(year, month, 0).getDate()
  const day = Math.min(d, lastDay)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function computeVestingEvents(grant: RsuGrant, today: string): VestingEvent[] {
  if (grant.vestingType === 'cliff') {
    if (!grant.vestingDate) return []
    return [
      {
        date: grant.vestingDate,
        shares: grant.totalShares,
        cumulativeShares: grant.totalShares,
        status: grant.vestingDate <= today ? 'vested' : 'pending',
      },
    ]
  }

  if (!grant.vestingStartDate || !grant.vestingMonths || grant.vestingMonths <= 0) return []
  const n = grant.vestingMonths
  const base = Math.floor(grant.totalShares / n)
  const events: VestingEvent[] = []

  for (let i = 0; i < n; i++) {
    const date = addMonths(grant.vestingStartDate, i)
    // Last tranche absorbs any rounding remainder
    const shares = i === n - 1 ? grant.totalShares - base * (n - 1) : base
    const prev = events[events.length - 1]?.cumulativeShares ?? 0
    events.push({
      date,
      shares,
      cumulativeShares: prev + shares,
      status: date <= today ? 'vested' : 'pending',
    })
  }
  return events
}

export function computeVestingSummary(grant: RsuGrant, today: string) {
  const events = computeVestingEvents(grant, today)
  const vestedShares = events
    .filter((e) => e.status === 'vested')
    .reduce((s, e) => s + e.shares, 0)
  const nextEvent = events.find((e) => e.status === 'pending') ?? null
  return {
    vestedShares,
    pendingShares: grant.totalShares - vestedShares,
    nextEvent,
    events,
  }
}
