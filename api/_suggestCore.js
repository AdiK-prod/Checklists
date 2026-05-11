import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-haiku-4-5-20251001'

/**
 * @param {{ tripContext: object, baseItems: Array<{ label: string, category: string }> }} body
 * @param {string} apiKey
 * @returns {Promise<{ suggestions: Array<object>, promptSent: string, responseRaw: string }>}
 */
export async function runSuggest(body, apiKey) {
  const { tripContext = {}, baseItems = [] } = body || {}
  const client = new Anthropic({ apiKey })

  const userPayload = JSON.stringify({ tripContext, baseItems }, null, 2)

  const promptSent = `You are a family travel packing assistant. Given trip context and base template items, suggest **additional** packing items (not duplicates of base items) that this family should consider.

Return **only** valid JSON (no markdown fence) with this exact shape:
{"suggestions":[{"label":"string","reason":"string","category":"Documents|Clothing|Essentials|Toiletries|Entertainment|Medications|Other","assignToAll":true|false,"memberNames":["optional names from travellers to assign when assignToAll is false"],"personSpecificNote":null|"short badge text"}]}

Rules:
- 4–12 suggestions; concise reasons (max ~120 chars).
- Use categories from the allowed list only.
- When assignToAll is true, memberNames must be [].
- When assignToAll is false, memberNames must be non-empty and use exact traveller names from tripContext.travellers.
- personSpecificNote only for person-specific items (or null).

Trip and travellers JSON:
${userPayload}`

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0.3,
    messages: [{ role: 'user', content: promptSent }],
  })

  const text = message.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      parsed = JSON.parse(text.slice(start, end + 1))
    } else {
      throw new Error('Invalid JSON from model')
    }
  }

  const rawList = Array.isArray(parsed.suggestions) ? parsed.suggestions : []
  const suggestions = rawList.map((s, i) => ({
    label: String(s.label || '').slice(0, 200),
    reason: String(s.reason || '').slice(0, 240),
    category: normalizeCategory(s.category),
    assignToAll: Boolean(s.assignToAll),
    memberNames: Array.isArray(s.memberNames) ? s.memberNames.map(String) : [],
    personSpecificNote: s.personSpecificNote == null ? null : String(s.personSpecificNote).slice(0, 80),
    _index: i,
  })).filter(s => s.label.length > 0)

  return {
    suggestions,
    promptSent,
    responseRaw: text,
  }
}

function normalizeCategory(c) {
  const allowed = ['Documents', 'Clothing', 'Essentials', 'Toiletries', 'Entertainment', 'Medications', 'Other']
  const s = String(c || 'Other')
  return allowed.includes(s) ? s : 'Other'
}
