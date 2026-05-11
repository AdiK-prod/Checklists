/** Build row payload for household_members insert (matches schema + RLS). */

const AVATAR_PALETTE = [
  { bg: '#E6F1FB', text: '#185FA5' },
  { bg: '#E1F5EE', text: '#0F6E56' },
  { bg: '#FAEEDA', text: '#854F0B' },
  { bg: '#FBEAF0', text: '#993556' },
  { bg: '#F3E8F3', text: '#6B2F6B' },
  { bg: '#E8F5E8', text: '#2A5A2A' },
]

function hash(s = '') {
  let h = 0
  for (const c of String(s)) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  return Math.abs(h)
}

function initialsFromName(name = '') {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase() || '?'
}

export function buildHouseholdMemberInsert(householdId, { name, role, age, sortOrder = 0 }) {
  const key = `${householdId}:${name}:${sortOrder}`
  const palette = AVATAR_PALETTE[hash(key) % AVATAR_PALETTE.length]
  return {
    household_id:   householdId,
    name:           name.trim(),
    role,
    age:            role === 'kid' && age != null && age !== '' ? Number(age) : null,
    initials:       initialsFromName(name),
    avatar_colour:  palette,
    sort_order:     sortOrder,
  }
}
