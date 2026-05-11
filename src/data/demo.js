// DEMO SCAFFOLDING — delete entirely in Module 9 when /api/suggest is wired up.
// Deletion checklist for Module 9:
//   [ ] Remove DEMO_SUGGESTIONS from src/data/demo.js
//   [ ] Remove all imports of DEMO_SUGGESTIONS
//   [ ] Verify Step 4 renders correctly from real API response
//   [ ] Confirm no demo data remains before marking Module 9 done

export const DEMO_SUGGESTIONS = [
  {
    id: 'sugg-1',
    label: 'Sunscreen SPF 50+',
    reason: 'Beach destination · 28°C · kids present',
    defaultChecked: true,
    memberIds: ['member-mum', 'member-dad', 'member-tom', 'member-sara'],
    hasAllChip: true,
    defaultAssignedTo: ['member-mum', 'member-dad', 'member-tom', 'member-sara'],
    isPersonSpecific: false,
    personSpecificNote: null,
  },
  {
    id: 'sugg-2',
    label: 'EU Health Card (EHIC)',
    reason: 'EU travel · emergency medical coverage',
    defaultChecked: true,
    memberIds: ['member-mum', 'member-dad'],
    hasAllChip: true,
    defaultAssignedTo: ['member-mum', 'member-dad'],
    isPersonSpecific: false,
    personSpecificNote: null,
  },
  {
    id: 'sugg-3',
    label: 'Extra diapers (travel pack)',
    reason: 'Airport delays may extend supply needs',
    defaultChecked: true,
    memberIds: ['member-sara', 'member-mum'],
    hasAllChip: false,
    defaultAssignedTo: ['member-sara'],
    isPersonSpecific: true,
    personSpecificNote: 'Sara · age 2',
  },
  {
    id: 'sugg-4',
    label: 'Portable fan / cooling towel',
    reason: 'July heat with young children outdoors',
    defaultChecked: false,
    memberIds: ['member-tom', 'member-sara'],
    hasAllChip: true,
    defaultAssignedTo: ['member-tom', 'member-sara'],
    isPersonSpecific: false,
    personSpecificNote: null,
  },
]
