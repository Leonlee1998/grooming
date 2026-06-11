import { NextRequest, NextResponse } from 'next/server'
import { prismaAdmin } from '@repo/db'
import { createClient } from '@supabase/supabase-js'

// Server-side only — service role is acceptable for auth token exchange
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const accessToken = body?.accessToken as string | undefined
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 })
  }

  // ── 1. Verify LINE access token ──────────────────────────────────────────
  const verifyRes = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,
  )
  if (!verifyRes.ok) {
    return NextResponse.json(
      { error: 'Invalid LINE access token' },
      { status: 401 },
    )
  }

  // ── 2. Get LINE user profile ──────────────────────────────────────────────
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!profileRes.ok) {
    return NextResponse.json(
      { error: 'Failed to get LINE profile' },
      { status: 401 },
    )
  }
  const profile = (await profileRes.json()) as {
    userId: string
    displayName: string
    pictureUrl?: string
  }
  const { userId: lineUserId, displayName } = profile

  // ── 3. Look up customer by lineUserId ─────────────────────────────────────
  const customer = await prismaAdmin.customer.findUnique({
    where: { lineUserId },
    select: { id: true, name: true },
  })

  if (!customer) {
    // LINE account not yet bound to any customer — cannot auto-login
    return NextResponse.json({ bound: false, displayName })
  }

  // ── 4. Create Supabase session via magic link ─────────────────────────────
  // Internal email derived deterministically from LINE user ID (never exposed)
  const lineEmail = `line.${lineUserId}@line.internal`

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: lineEmail,
    options: {
      data: {
        lineUserId,
        customerId: customer.id,
        customerName: customer.name,
        displayName,
      },
    },
  })

  if (error || !data?.properties?.hashed_token) {
    console.error('[line-liff] generateLink failed:', error)
    return NextResponse.json(
      { error: 'Session creation failed' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    bound: true,
    tokenHash: data.properties.hashed_token,
    email: lineEmail,
    displayName,
    customerName: customer.name,
  })
}
