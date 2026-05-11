// DEMO SCAFFOLDING — delete in Module 7 when Supabase auth + useHousehold hook are wired up.
// All references to HOUSEHOLD must be removed before Module 7 is marked done.

export const HOUSEHOLD = {
  id: 'demo-household-1',
  name: 'The Demo Family',
  members: [
    {
      id: 'member-mum',
      name: 'Mum',
      role: 'parent',
      initials: 'Mu',
      avatarColour: { bg: '#E6F1FB', text: '#185FA5' },
      sortOrder: 0,
    },
    {
      id: 'member-dad',
      name: 'Dad',
      role: 'parent',
      initials: 'Da',
      avatarColour: { bg: '#E1F5EE', text: '#0F6E56' },
      sortOrder: 1,
    },
    {
      id: 'member-tom',
      name: 'Tom',
      role: 'kid',
      age: 7,
      initials: 'To',
      avatarColour: { bg: '#FAEEDA', text: '#854F0B' },
      sortOrder: 2,
    },
    {
      id: 'member-sara',
      name: 'Sara',
      role: 'kid',
      age: 2,
      initials: 'Sa',
      avatarColour: { bg: '#FBEAF0', text: '#993556' },
      sortOrder: 3,
    },
  ],
}
