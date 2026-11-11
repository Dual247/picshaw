export const dynamic = 'force-dynamic'
export const revalidate = 0

// Explicit future API routes take precedence. No URL or request data is echoed.
function unavailable() {
  return Response.json(
    { error: 'not_found', message: 'This platform endpoint is unavailable. Platform setup is incomplete.' },
    {
      status: 404,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    },
  )
}

export const GET = unavailable
export const HEAD = unavailable
export const POST = unavailable
export const PUT = unavailable
export const PATCH = unavailable
export const DELETE = unavailable
export const OPTIONS = unavailable
