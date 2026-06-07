import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key)
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    )
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function uploadContractPdf(
  buffer: Buffer,
  orderId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const storagePath = `${orderId}/signed.pdf`

  const { error: uploadError } = await supabase.storage
    .from('contracts')
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Failed to upload contract PDF: ${uploadError.message}`)
  }

  // Signed URL valid for 1 year; store storagePath in DB for refresh on expiry
  const { data, error: signError } = await supabase.storage
    .from('contracts')
    .createSignedUrl(storagePath, 31_536_000)

  if (signError || !data) {
    throw new Error(
      `Failed to create signed URL: ${signError?.message ?? 'unknown'}`,
    )
  }

  return data.signedUrl
}
