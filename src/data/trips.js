// DEMO SCAFFOLDING — delete in Module 7 when useTrips + useTripDetail hooks are wired up.
// All references to INITIAL_TRIPS must be removed before Module 7 is marked done.

export const INITIAL_TRIPS = [
  {
    id: 'trip-barcelona',
    householdId: 'demo-household-1',
    name: 'Barcelona',
    destination: 'Barcelona, Spain',
    templateId: 'template-flight',
    datesFrom: '2026-07-14',
    datesTo: '2026-07-21',
    weather: 'Hot & sunny ~28°C',
    tripType: 'Beach + city',
    status: 'upcoming',
    travellers: ['member-mum', 'member-dad', 'member-tom', 'member-sara'],
    // Accepted AI suggestions — shown in the trip hero panel
    aiSuggestions: [
      {
        label: 'Sunscreen SPF 50+',
        assignedTo: ['member-mum', 'member-dad', 'member-tom', 'member-sara'],
        reason: 'Beach destination · 28°C · kids present',
      },
      {
        label: 'EU Health Card (EHIC)',
        assignedTo: ['member-mum', 'member-dad'],
        reason: 'EU travel · emergency medical coverage',
      },
      {
        label: 'Extra diapers travel pack',
        assignedTo: ['member-sara'],
        reason: 'Airport delays may extend supply needs',
        personSpecificNote: 'Sara · age 2',
      },
    ],
    // Per-member checklists — keyed by member ID
    checklists: {
      'member-mum': [
        { id: 'i-mum-1', label: 'Passport',             category: 'Documents',  checked: true,  isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 1 },
        { id: 'i-mum-2', label: 'Boarding pass',         category: 'Documents',  checked: true,  isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 2 },
        { id: 'i-mum-3', label: 'Travel insurance',      category: 'Documents',  checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 3 },
        { id: 'i-mum-4', label: 'EU Health Card (EHIC)', category: 'Documents',  checked: false, isAiSuggested: true,  isManuallyAdded: false, savedToTemplate: false, sortOrder: 4 },
        { id: 'i-mum-5', label: 'Summer clothes 5 days', category: 'Clothing',   checked: true,  isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 5 },
        { id: 'i-mum-6', label: 'Swimwear',              category: 'Clothing',   checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 6 },
        { id: 'i-mum-7', label: 'Sunscreen SPF 50+',     category: 'Toiletries', checked: false, isAiSuggested: true,  isManuallyAdded: false, savedToTemplate: false, sortOrder: 7 },
      ],
      'member-dad': [
        { id: 'i-dad-1', label: 'Passport',             category: 'Documents',  checked: true,  isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 1 },
        { id: 'i-dad-2', label: 'Boarding pass',         category: 'Documents',  checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 2 },
        { id: 'i-dad-3', label: 'EU Health Card (EHIC)', category: 'Documents',  checked: false, isAiSuggested: true,  isManuallyAdded: false, savedToTemplate: false, sortOrder: 3 },
        { id: 'i-dad-4', label: 'Summer clothes',        category: 'Clothing',   checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 4 },
        { id: 'i-dad-5', label: 'Swimwear',              category: 'Clothing',   checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 5 },
        { id: 'i-dad-6', label: 'Sunscreen SPF 50+',     category: 'Toiletries', checked: false, isAiSuggested: true,  isManuallyAdded: false, savedToTemplate: false, sortOrder: 6 },
      ],
      'member-tom': [
        { id: 'i-tom-1', label: 'Summer clothes 5 sets', category: 'Clothing',       checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 1 },
        { id: 'i-tom-2', label: 'Swimwear',               category: 'Clothing',       checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 2 },
        { id: 'i-tom-3', label: 'iPad + headphones',      category: 'Entertainment',  checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 3 },
        { id: 'i-tom-4', label: 'Sunscreen SPF 50+',      category: 'Toiletries',     checked: false, isAiSuggested: true,  isManuallyAdded: false, savedToTemplate: false, sortOrder: 4 },
      ],
      'member-sara': [
        { id: 'i-sara-1', label: 'Diapers travel supply',      category: 'Essentials', checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 1 },
        { id: 'i-sara-2', label: 'Extra diapers travel pack',  category: 'Essentials', checked: false, isAiSuggested: true,  isManuallyAdded: false, savedToTemplate: false, sortOrder: 2 },
        { id: 'i-sara-3', label: 'Summer clothes 7 sets',      category: 'Clothing',   checked: false, isAiSuggested: false, isManuallyAdded: false, savedToTemplate: false, sortOrder: 3 },
        { id: 'i-sara-4', label: 'Sunscreen SPF 50+',          category: 'Toiletries', checked: false, isAiSuggested: true,  isManuallyAdded: false, savedToTemplate: false, sortOrder: 4 },
      ],
    },
  },
  {
    id: 'trip-brighton',
    householdId: 'demo-household-1',
    name: 'Brighton Day Out',
    destination: 'Brighton, UK',
    templateId: 'template-day',
    datesFrom: '2026-06-20',
    datesTo: '2026-06-20',
    weather: 'Mild & sunny',
    tripType: 'Beach + seaside',
    status: 'upcoming',
    travellers: ['member-mum', 'member-dad', 'member-tom', 'member-sara'],
    aiSuggestions: [],
    checklists: {
      'member-mum':  [],
      'member-dad':  [],
      'member-tom':  [],
      'member-sara': [],
    },
  },
  {
    id: 'trip-edinburgh',
    householdId: 'demo-household-1',
    name: 'Edinburgh Weekend',
    destination: 'Edinburgh, Scotland',
    templateId: 'template-weekend',
    datesFrom: '2026-03-14',
    datesTo: '2026-03-16',
    weather: 'Cold & overcast',
    tripType: 'City break',
    status: 'completed',
    travellers: ['member-mum', 'member-dad'],
    aiSuggestions: [],
    checklists: {},
  },
]
