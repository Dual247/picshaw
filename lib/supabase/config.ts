import 'server-only'

export type SupabaseEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL?: string
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string
}

export class SupabaseConfigurationError extends Error {
  readonly code = 'SUPABASE_NOT_CONFIGURED'
  constructor() {
    super('Supabase authentication is not configured.')
    this.name = 'SupabaseConfigurationError'
  }
}

/** Configuration validation only; does not establish a real project or key. */
export function readSupabaseConfig(env: SupabaseEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
}) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!url || !publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new SupabaseConfigurationError()
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
        parsed.pathname !== '/' || parsed.search || parsed.hash ||
        parsed.hostname === 'localhost' || parsed.hostname.endsWith('.invalid')) {
      throw new SupabaseConfigurationError()
    }
    return { url: parsed.origin, publishableKey }
  } catch {
    // Do not echo configuration values into errors or logs.
    throw new SupabaseConfigurationError()
  }
}

