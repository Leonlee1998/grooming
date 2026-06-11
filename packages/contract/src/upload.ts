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

const BUCKET = 'contracts'

/** 上傳 PDF 並回傳 storagePath（格式：`{orderId}/signed.pdf`）。不產出 URL，由呼叫端決定 URL 效期。 */
export async function uploadContractPdf(
  buffer: Buffer,
  orderId: string,
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const storagePath = `${orderId}/signed.pdf`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) throw new Error(`Failed to upload contract PDF: ${error.message}`)

  return storagePath
}

/** 為已存在的 storagePath 產出 signed URL，預設效期 3600 秒（1 小時）。 */
export async function createContractSignedUrl(
  storagePath: string,
  expiresIn = 3600,
): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn)

  if (error || !data)
    throw new Error(
      `Failed to create signed URL: ${error?.message ?? 'unknown'}`,
    )

  return data.signedUrl
}

/** 清理 Storage 上的孤立 PDF（補償用途）。失敗時 console.error 而非拋出。 */
export async function deleteContractPdf(storagePath: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin()
    await supabase.storage.from(BUCKET).remove([storagePath])
  } catch (e) {
    console.error('deleteContractPdf failed (non-fatal):', e)
  }
}
