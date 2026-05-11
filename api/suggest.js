// Vercel serverless function — stubbed for Module 1.
// Full implementation with Claude API in Module 9.
// See blueprint section: "Vercel Serverless Function — AI Suggestions"

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // TODO Module 9: implement full prompt + parse logic
  return res.status(503).json({ error: 'Not implemented yet — see Module 9' })
}
