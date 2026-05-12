import {
  FileText,
  ShoppingBag,
  FolderOpen,
  Apple,
  Zap,
  Heart,
  Shirt,
} from 'lucide-react'

/** Header icon map for shared sections (DB: checklist_sections / template_sections). Match on first word of name, case-insensitive. */
export const SECTION_ICONS = {
  documents: { icon: FileText, bg: '#E6F1FB', color: '#185FA5' },
  essentials: { icon: ShoppingBag, bg: '#E1F5EE', color: '#0F6E56' },
  misc: { icon: FolderOpen, bg: '#f1efe8', color: '#6b6b6b' },
  snacks: { icon: Apple, bg: '#FAEEDA', color: '#854F0B' },
  tech: { icon: Zap, bg: '#FAEEDA', color: '#854F0B' },
  health: { icon: Heart, bg: '#FBEAF0', color: '#993556' },
  clothing: { icon: Shirt, bg: '#f1efe8', color: '#6b6b6b' },
  default: { icon: FolderOpen, bg: '#f1efe8', color: '#6b6b6b' },
}

function firstWordKey(name) {
  const raw = String(name || '')
    .trim()
    .split(/\s+/)[0]
  return raw.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export function getSectionIconMeta(name) {
  const key = firstWordKey(name)
  return SECTION_ICONS[key] || SECTION_ICONS.default
}
