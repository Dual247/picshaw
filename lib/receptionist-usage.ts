import { receptionistOffer } from './receptionist'

/** Illustrative whole-minute estimate; not a quote, booking or billing engine. */
export function estimateReceptionistUsage(minutes: number) {
  const estimatedMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0
  const additionalMinutes = Math.max(0, estimatedMinutes - receptionistOffer.includedMinutes)
  const usageCharge = additionalMinutes * receptionistOffer.additionalMinute
  const monthlyTotal = receptionistOffer.monthly + usageCharge
  return { estimatedMinutes, additionalMinutes, usageCharge, monthlyTotal, withSetup: monthlyTotal + receptionistOffer.setup }
}
export const receptionistMoney = (amount: number) => '$' + amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
