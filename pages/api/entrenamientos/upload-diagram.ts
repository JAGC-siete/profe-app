import type { NextApiRequest, NextApiResponse } from 'next'
import { requireCompanyAccess } from '../../../lib/auth/api-auth-fixed'
import { logger } from '../../../lib/logger'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const auth = await requireCompanyAccess(req, res)
    const { supabase, companyId } = auth

    if (!companyId) {
      return res.status(400).json({ error: 'Company required' })
    }

    const { fileBase64, fileName, contentType } = req.body ?? {}

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'fileBase64 requerido' })
    }
    if (!contentType || !ALLOWED.has(contentType)) {
      return res.status(400).json({ error: 'Tipo de imagen no permitido' })
    }

    const raw = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64
    const buffer = Buffer.from(raw, 'base64')
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Máximo 5MB' })
    }

    const safeName = String(fileName || 'diagram.jpg')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80)
    const path = `${companyId}/drafts/${Date.now()}-${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('profe-training-diagrams')
      .upload(path, buffer, { contentType, upsert: false })

    if (uploadError) {
      logger.error('Diagram upload failed', { error: uploadError.message, companyId })
      return res.status(500).json({ error: 'Error al subir diagrama' })
    }

    const { data: publicData } = supabase.storage
      .from('profe-training-diagrams')
      .getPublicUrl(path)

    return res.status(200).json({ url: publicData.publicUrl, path })
  } catch (error) {
    if (
      error instanceof Error &&
      ['UNAUTHORIZED', 'PROFILE_REQUIRED', 'COMPANY_ACCESS_REQUIRED'].includes(error.message)
    ) {
      return
    }
    logger.error('upload-diagram error', { error: String(error) })
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Error interno' })
    }
  }
}
