import type { NextApiRequest, NextApiResponse } from 'next'
import { getHondurasTimestamp } from '../../lib/timezone'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const healthStatus: Record<string, unknown> = {
      status: 'healthy',
      timestamp: getHondurasTimestamp(),
      uptime: process.uptime(),
    }

    if (process.env.NODE_ENV !== 'production') {
      healthStatus.environment = process.env.NODE_ENV
      healthStatus.version = process.env.npm_package_version || '0.1.0'
    }

    return res.status(200).json(healthStatus)
  } catch {
    return res.status(503).json({
      status: 'unhealthy',
      timestamp: getHondurasTimestamp(),
      error: 'Service unavailable',
    })
  }
}
