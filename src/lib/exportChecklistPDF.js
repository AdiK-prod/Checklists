import jsPDF from 'jspdf'

function sanitizeFilename(name) {
  return (name || 'checklist')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Generate and download a PDF checklist for a trip.
 * @param {{ name: string, destination?: string, datesFrom?: string, datesTo?: string }} trip
 * @param {Array} sections – camelCase section objects from useTripDetail
 */
export function exportChecklistPDF(trip, sections) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const marginL = 16
  const marginR = 16
  const contentW = pageW - marginL - marginR
  let y = 16

  const LINE_HEIGHT_NORMAL = 6
  const SECTION_GAP = 8
  const CAT_GAP = 5

  function ensureSpace(needed) {
    if (y + needed > 280) {
      doc.addPage()
      y = 16
    }
  }

  // ── Header ────────────────────────────────────────────────
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('PackSmart', marginL, y)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(trip.name || 'Trip', pageW - marginR, y, { align: 'right' })
  y += 7

  const metaParts = [
    trip.datesFrom && trip.datesTo
      ? `${trip.datesFrom} – ${trip.datesTo}`
      : trip.datesFrom || '',
    trip.destination || '',
  ].filter(Boolean)
  if (metaParts.length) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(metaParts.join(' · '), pageW - marginR, y, { align: 'right' })
  }
  y += 10

  // Divider
  doc.setDrawColor(220, 220, 220)
  doc.line(marginL, y, pageW - marginR, y)
  y += 8

  // ── Section rendering ──────────────────────────────────────
  const sharedSections = (sections || []).filter(s => s.sectionType === 'shared')
  const personSections = (sections || []).filter(s => s.sectionType === 'person')

  function renderSection(sec) {
    ensureSpace(14)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(sec.name.toUpperCase(), marginL, y)
    y += 5
    doc.setDrawColor(200, 200, 200)
    doc.line(marginL, y, pageW - marginR, y)
    y += CAT_GAP

    const subs = (sec.subcategories || []).slice().sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
    )
    for (const sub of subs) {
      const items = (sub.items || []).slice().sort(
        (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
      )
      if (!items.length) continue

      // Category label
      ensureSpace(8)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(80, 80, 80)
      doc.text(sub.name.toUpperCase(), marginL, y)
      y += LINE_HEIGHT_NORMAL

      for (const item of items) {
        ensureSpace(6)
        const box = item.checked ? '[x]' : '[ ]'
        const label = `${box}  ${item.label}`
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(40, 40, 40)
        const lines = doc.splitTextToSize(label, contentW - 4)
        doc.text(lines, marginL + 4, y)
        y += LINE_HEIGHT_NORMAL * lines.length
      }
      y += 2
    }
    y += SECTION_GAP
  }

  // Shared sections first
  for (const sec of sharedSections) renderSection(sec)

  // Person sections — each on a new page if we've used significant space
  for (const sec of personSections) {
    if (y > 40) { doc.addPage(); y = 16 }
    renderSection(sec)
  }

  doc.save(`${sanitizeFilename(trip.name)}-checklist.pdf`)
}
