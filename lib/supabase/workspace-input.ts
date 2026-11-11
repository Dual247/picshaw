/** Shared shape only. No authorization or credentials belong in this module. */
export type WorkspaceInput = { name: string; site: string }
export function parseWorkspaceInput(value: unknown): WorkspaceInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const fields = value as Record<string, unknown>
  if (Object.keys(fields).some(key => !['name', 'site'].includes(key))) return null
  if (typeof fields.name !== 'string' || fields.name !== fields.name.trim() ||
      fields.name.length < 1 || fields.name.length > 160 || /[\u0000-\u001f\u007f]/.test(fields.name) ||
      typeof fields.site !== 'string' || fields.site.length > 253) return null
  // Store an unverified public hostname, never fetch it or claim property ownership.
  const site = fields.site.toLowerCase()
  if (site !== fields.site || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(site)) return null
  return { name: fields.name, site }
}
