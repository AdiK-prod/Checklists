import {
  ArrowLeft, ArrowRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

// Map Lucide component → its RTL mirror
const FLIP_MAP = new Map([
  [ArrowLeft,    ArrowRight],
  [ArrowRight,   ArrowLeft],
  [ChevronLeft,  ChevronRight],
  [ChevronRight, ChevronLeft],
])

/**
 * Returns the Lucide component to render, flipping direction-sensitive icons in RTL.
 * @param {React.ElementType} IconComponent  - the Lucide component (e.g. ArrowLeft)
 * @param {'ltr'|'rtl'} dir
 * @returns {React.ElementType}
 */
export function flipIcon(IconComponent, dir) {
  if (dir !== 'rtl') return IconComponent
  return FLIP_MAP.get(IconComponent) ?? IconComponent
}
