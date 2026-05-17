import { isDefaultBucketSubcategoryName } from '../../lib/templateLayout'
import { formatTripDates } from '../../lib/utils'

function PrintSection({ section }) {
  const subs = [...(section.subcategories || [])].sort(
    (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
  )

  return (
    <>
      <div className="print-section-name">{section.name}</div>
      {subs.map(cat => (
        <PrintCategory key={cat.id} category={cat} section={section} />
      ))}
    </>
  )
}

function PrintCategory({ category, section }) {
  const items = [...(category.items || [])].sort(
    (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
  )
  if (!items.length) return null

  const showLabel =
    !isDefaultBucketSubcategoryName(category.name) || (section.subcategories || []).length > 1

  return (
    <>
      {showLabel ? <div className="print-category-name">{category.name}</div> : null}
      {items.map(item => (
        <div key={item.id} className="print-item">
          <div className={`print-checkbox ${item.checked ? 'checked' : ''}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </>
  )
}

/** Renders hidden on screen; visible when printing (see src/styles/print.css). */
export default function PrintChecklist({ trip, sections, dir = 'ltr' }) {
  const sectionsSorted = [...(sections || [])].sort(
    (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0),
  )
  const shared = sectionsSorted.filter(s => s.sectionType === 'shared')
  const people = sectionsSorted.filter(s => s.sectionType === 'person')

  const metaParts = [
    trip?.destination?.trim(),
    trip?.datesFrom && trip?.datesTo ? formatTripDates(trip.datesFrom, trip.datesTo) : null,
  ].filter(Boolean)

  return (
    <div id="print-checklist" dir={dir}>
      <div className="print-trip-title">{trip?.name || 'Trip'}</div>
      <div className="print-trip-meta">{metaParts.join(' · ')}</div>

      {shared.map(section => (
        <PrintSection key={section.id} section={section} />
      ))}

      {people.map(section => (
        <div key={section.id} className="print-person-section">
          <PrintSection section={section} />
        </div>
      ))}
    </div>
  )
}
