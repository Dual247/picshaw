export const RETAINER_PATH = '/ai-visibility-retainer'
export const RETAINER_SELECTION_EVENT = 'picshaw:choose-retainer'
export const auditPrice = 1250
export const corePrice = 1500
export const foundingPrice = 1250
export const growthStartingPrice = 2500
export const annualDiscount = 0.1
export const usd = (amount: number) => '$' + amount.toLocaleString('en-US')
export const retainerOptions = [
  { value: 'retainer-core', label: 'Core AI Visibility Retainer — $1,500/mo' },
  { value: 'retainer-founding', label: 'LA Founding Core — $1,250/mo (eligibility checked)' },
  { value: 'retainer-growth', label: 'Growth AI Visibility Retainer — from $2,500/mo' },
  { value: 'retainer-annual', label: 'Core annual prepay — $16,200/year (10% off)' },
] as const
export function isRetainerService(value: string) { return retainerOptions.some(option => option.value === value) }
export function enquiryTerms(value: string) {
  switch (value) {
    case 'audit': return 'Single-location audit: $1,250. If your retainer begins within 30 days of the audit walkthrough, $625 is credited against month one. Subject to written scope and eligibility.'
    case 'retainer-core': return 'Core: $1,500 per month; three-month minimum, then month to month. One location and one primary market. Scope agreed before payment.'
    case 'retainer-founding': return 'Founding Core: $1,250 per month locked for six months; three-month minimum, then month to month. Only the first three eligible Los Angeles clients, with a case study subject to their approval and publication permission. Availability is confirmed in writing.'
    case 'retainer-growth': return 'Growth starts at $2,500 per month, quoted for additional market/location scope; three-month minimum. No work starts until a written quote is accepted.'
    case 'retainer-annual': return 'Core prepaid annual: $16,200 for 12 months (10% off the $18,000 standard annual total). Not combined with the founding discount or another promotion; written terms apply.'
    default: return null
  }
}

export type RetainerService = typeof retainerOptions[number]['value']
