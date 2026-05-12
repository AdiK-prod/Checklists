# GenAI Blueprint — Trip Checklist App
**Version:** 3.0 — Architecture Refactor: Sections, Subcategories & Shared Items  
**Prepared by:** Principal Product Architect  
**Target agent:** Cursor / Windsurf / Claude Engineer  
**Stack:** React + Vite + Tailwind CSS + Supabase + Vercel  

---

## Agent Operating Instructions

Before you write a single line of code, read this section fully.

**Decision rules:**
- **Stop and ask** for any decision that affects user flow, data structure, navigation, auth, or feature scope. These are product decisions, not implementation decisions.
- **Decide freely** on small UI choices: exact padding values, minor spacing, hover state timing, icon selection within a category, placeholder copy. Iterate without asking.
- **Never invent features** not described in this blueprint. If something is unclear, ask.
- **Never simplify a specified behaviour** to save time. If a feature is described, build it as described.
- **One module = one focused task.** Complete each module fully before moving to the next.

**Hardcoded-for-validation mindset (applies to every module):**

UI modules (1–6) use hardcoded data to enable fast visual validation before the backend exists. This is intentional and correct. However, every piece of hardcoded data must be treated as temporary scaffolding, not a foundation.

Follow this discipline throughout:
- When introducing hardcoded data, wrap it in a clearly named constant in its own file (e.g. `src/data/demo.js`) — never inline it directly into components.
- Add a `// DEMO SCAFFOLDING — delete in Module [N]` comment on every hardcoded constant, specifying exactly which module replaces it with real data.
- When a backend module replaces hardcoded data, the first task of that module is to delete the demo constant and all references to it. Do not leave orphaned demo data alongside real data.
- If a module is completed and any demo scaffolding from a prior module has not been removed, stop and clean it up before marking the module done.

The goal: zero demo data in production. Every hardcoded value is a debt with a known repayment date.

**Build sequence:** UI modules first (1–6), then backend modules (7–12). This lets the UI be validated before wiring up the real data layer.

---

## Product Context

**App name:** PackSmart *(working title — confirm with owner)*

**Problem:** Pre-trip anxiety and cognitive load. Families need a trustworthy, context-aware packing checklist — one per person — so they can prepare with confidence and nothing gets forgotten.

**Primary persona:** The Prepared Parent. 35–50. Mentally holds the packing list for the entire household. High stakes — a forgotten child's medication or travel document can derail the trip.

**Core mental model:** A **Trip** is the primary object. Templates are the starting point. The app is organised around trips, not lists.

---

## Design System

### Typography
- **Font:** DM Sans (Google Fonts)
- `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500&display=swap')`
- **Weights:** 400 and 500 only. Never 600 or 700.
- **Sizes:** 18px screen titles, 16px body, 14px secondary, 13px list items, 12px labels, 11px badges/hints
- **Sentence case everywhere.** No title case. Section labels are 11px uppercase with 0.08em letter-spacing.

### Colour Palette
```
Page background:     #faf8f4
Card background:     #ffffff
Surface fill:        #f1efe8   (badges, mini-bars, subtle fills)
Input background:    #ffffff   border #e0ddd8

Primary (navy):      #3d6494
Primary hover:       #335580
Primary text:        #ffffff

Success:             #2a9d6e
Success light:       #E1F5EE
Success text:        #0F6E56

Amber CTA:           #c47d1a   (AI / generate actions only)
Amber light:         #FAEEDA
Amber dark text:     #7a4f0d

Coral specific:      #FAECE7   (person-specific badge bg)
Coral text:          #993C1D

Blue info:           #E6F1FB
Blue info text:      #185FA5

Text primary:        #1a1a1a
Text secondary:      #6b6b6b
Text hint:           #9a9a9a

Border default:      rgba(0,0,0,0.08)    0.5px
Border emphasis:     rgba(0,0,0,0.16)    0.5px hover/focus
Border selected:     #3d6494             1.5px

Avatar colours (fixed per role — assigned at member creation):
  Parent slot 1:  bg #E6F1FB  text #185FA5
  Parent slot 2:  bg #E1F5EE  text #0F6E56
  Kid slot 1:     bg #FAEEDA  text #854F0B
  Kid slot 2:     bg #FBEAF0  text #993556
  Kid slot 3:     bg #E1F5EE  text #0F6E56
  (cycle through available colours for additional members)
```

### Spacing & Radius
- Vertical rhythm: 0.5rem, 1rem, 1.5rem, 2rem
- Component internals: 8px, 12px, 16px, 20px
- Card padding: 14px 16px mobile, 16px 20px tablet+
- Border radius: 12px cards, 10px buttons, 8px inputs/chips, 20px pills

### Elevation
- Cards: `border: 0.5px solid rgba(0,0,0,0.08)` — no box-shadow
- Selected: `border: 1.5px solid #3d6494`
- Inputs focus: `border-color: #3d6494`
- Amber CTA only: `box-shadow: 0 2px 8px rgba(196,125,26,0.30)`

### Iconography
Use **Lucide React** throughout. Never use emoji as icons.
```
Plane, Car, Moon          — trip types
FileText                  — documents
Shirt                     — clothing
ShoppingBag               — essentials/toiletries
Gamepad2                  — entertainment
Pill                      — medications
Sparkles                  — AI / suggestions
GripVertical              — drag handle
Plus, Check, X            — actions
ChevronDown, ChevronUp    — collapse/expand
ArrowLeft                 — back navigation
BookmarkPlus              — save to template
MoreVertical              — trip options
Users                     — household
Settings                  — settings
Mail                      — invite / email
LogOut                    — sign out
```

### Component Patterns

**Buttons:**
```
Primary:    bg #3d6494  text white  radius 10px  padding 13px 20px  font 15px/500
Amber CTA:  bg #c47d1a  text white  radius 10px  padding 13px 20px  shadow as above
Ghost:      bg transparent  border 0.5px #e0ddd8  text #1a1a1a  radius 10px  padding 7px 14px
Full-width: width 100%  flex  items-center  justify-center  gap 8px
Danger:     bg transparent  border 0.5px #e8b4b4  text #993C1D  radius 10px
```

**Checklist item row:**
```
[GripVertical — opacity 0.3, cursor grab] [checkbox 18x18 radius 4px] [label flex:1] [optional right action]
Checked: bg #2a9d6e border #2a9d6e white Check icon. Label: line-through color #9a9a9a.
Separator: 0.5px border-bottom rgba(0,0,0,0.06). None on last item.
```

**Person avatar:**
```
Circle 32px, font 11px/500, initials = first 2 chars of name
Colour assigned at member creation, fixed thereafter
```

**Section label:**
```
11px / 500 / uppercase / #6b6b6b / letter-spacing 0.08em / margin-bottom 8px
```

**Form field:**
```
Label: 12px #6b6b6b margin-bottom 4px
Input: white bg, border 0.5px #e0ddd8, radius 8px, padding 10px 12px, 14px text
Focus: border-color #3d6494, outline none
Error: border-color #e24b4a, error message 12px #e24b4a below field
```

---

## Architecture Overview

```
Frontend:   React + Vite + Tailwind CSS → deployed to Vercel
Backend:    Supabase (Postgres + Auth + RLS)
AI:         Claude Haiku via Vercel serverless function
Email:      Supabase Auth handles auth emails (magic link, password reset)
```

**Screen routing:** React state-driven for Level 1. Introduce `react-router-dom` in Module 7 when real data and auth are wired up.

**Screens:**
```
/login                  Auth screen (sign in / sign up)
/onboarding             First-time setup (household + members)
/                       Trips Dashboard
/new                    New Trip Wizard (4 steps)
/trips/:id              Trip Page
/settings               Household & account management
```

---

## Database Schema

Run this SQL in Supabase SQL editor to create the full schema.

```sql
-- Households
create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Maps auth users to households (supports invited partners)
-- CRITICAL: user_id UNIQUE constraint enforces one household per user (MVP).
-- Without this, repeated onboarding runs accumulate duplicate rows, causing
-- PGRST116 ("multiple rows returned") which hangs the auth loading state.
create table household_users (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member', -- 'owner' | 'member'
  joined_at timestamptz default now(),
  primary key (household_id, user_id),
  constraint household_users_user_id_unique unique (user_id)
);

-- Household members (people, not necessarily users)
create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  role text not null, -- 'parent' | 'kid'
  age integer, -- nullable, for kids
  initials text not null,
  avatar_colour jsonb not null, -- { bg: '#E6F1FB', text: '#185FA5' }
  is_user boolean default false, -- true if this member has a login
  user_id uuid references auth.users(id), -- nullable
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Templates
create table templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  icon text not null, -- lucide icon name e.g. 'Plane', 'Car', 'Moon'
  is_default boolean default false, -- pre-seeded on household creation
  created_at timestamptz default now()
);

-- Template sections: either a shared category OR a specific family member
-- section_type = 'shared'  → Documents, Essentials, Snacks etc. No member_id.
-- section_type = 'person'  → references a real household_members row by name
-- This replaces the old flat template_items.category text field.
create table template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete cascade,
  section_type text not null check (section_type in ('shared', 'person')),
  name text not null,         -- display name: 'Documents', 'Mum', 'Tom' etc.
  member_id uuid references household_members(id) on delete set null,
  -- member_id is set when section_type = 'person', null for shared sections
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Template subcategories: groups within a section e.g. Clothing, Medications
-- Both shared and person sections can have subcategories.
create table template_subcategories (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references template_sections(id) on delete cascade,
  name text not null,         -- 'Clothing', 'Medications', 'Travel docs' etc.
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Template items: individual checklist items within a subcategory
create table template_items (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid references template_subcategories(id) on delete cascade,
  label text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Trips
create table trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  destination text not null,
  template_id uuid references templates(id),
  dates_from date,
  dates_to date,
  weather text,
  trip_type text,
  status text default 'upcoming', -- 'upcoming' | 'completed'
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Maps members to trips (who is travelling on this specific trip)
-- Shared sections always appear. Person sections only appear if that
-- member is in trip_travellers.
create table trip_travellers (
  trip_id uuid references trips(id) on delete cascade,
  member_id uuid references household_members(id) on delete cascade,
  primary key (trip_id, member_id)
);

-- Checklist sections: live copy of template_sections for a specific trip
-- Shared sections copied once. Person sections copied only for travelling members.
create table checklist_sections (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  section_type text not null check (section_type in ('shared', 'person')),
  name text not null,         -- real member name e.g. 'Tom', or category name
  member_id uuid references household_members(id) on delete set null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Checklist subcategories: live copy of template_subcategories per trip section
-- Can also be created ad-hoc by the user on the trip page.
create table checklist_subcategories (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references checklist_sections(id) on delete cascade,
  name text not null,
  sort_order integer default 0,
  is_manually_added boolean default false,
  created_at timestamptz default now()
);

-- Checklist items: live items within a subcategory, fully independent of template
-- is_manually_added: user added this item directly on the trip page
-- saved_to_template: user tapped "Save to template" — write back to template_items
create table checklist_items (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid references checklist_subcategories(id) on delete cascade,
  label text not null,
  sort_order integer default 0,
  checked boolean default false,
  is_ai_suggested boolean default false,
  is_manually_added boolean default false,
  saved_to_template boolean default false,
  created_at timestamptz default now()
);

-- AI suggestions log
create table ai_suggestions_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  prompt_sent text not null,
  response_raw text not null,
  suggestions_accepted integer default 0,
  suggestions_total integer default 0,
  model text default 'claude-haiku-4-5-20251001',
  created_at timestamptz default now()
);

-- Indexes for performance
create index idx_template_sections_template_id on template_sections(template_id);
create index idx_template_subcategories_section_id on template_subcategories(section_id);
create index idx_template_items_subcategory_id on template_items(subcategory_id);
create index idx_checklist_sections_trip_id on checklist_sections(trip_id);
create index idx_checklist_subcategories_section_id on checklist_subcategories(section_id);
create index idx_checklist_items_subcategory_id on checklist_items(subcategory_id);
create index idx_trips_household_id on trips(household_id);
create index idx_household_members_household_id on household_members(household_id);
create index idx_ai_suggestions_log_trip_id on ai_suggestions_log(trip_id);
```

### Row Level Security (RLS)

```sql
-- Enable RLS on all tables
alter table households enable row level security;
alter table household_users enable row level security;
alter table household_members enable row level security;
alter table templates enable row level security;
alter table template_sections enable row level security;
alter table template_subcategories enable row level security;
alter table template_items enable row level security;
alter table trips enable row level security;
alter table trip_travellers enable row level security;
alter table checklist_sections enable row level security;
alter table checklist_subcategories enable row level security;
alter table checklist_items enable row level security;
alter table ai_suggestions_log enable row level security;

-- Helper function: get current user's household_id
-- ORDER BY joined_at ensures client and DB always agree on the same household
-- (matters if a user somehow has multiple rows during dev cleanup)
create or replace function get_my_household_id()
returns uuid as $$
  select household_id from household_users
  where user_id = auth.uid()
  order by joined_at asc
  limit 1;
$$ language sql security definer;

-- Households: members of the household can read; owner can update
create policy "household members can read"
  on households for select
  using (id = get_my_household_id());

create policy "owner can update household"
  on households for update
  using (owner_id = auth.uid());

-- Household members: all household users can read and write
create policy "household users can read members"
  on household_members for select
  using (household_id = get_my_household_id());

create policy "household users can manage members"
  on household_members for all
  using (household_id = get_my_household_id());

-- Templates and all nested template objects
create policy "household users can manage templates"
  on templates for all
  using (household_id = get_my_household_id());

create policy "household users can manage template sections"
  on template_sections for all
  using (
    template_id in (
      select id from templates where household_id = get_my_household_id()
    )
  );

create policy "household users can manage template subcategories"
  on template_subcategories for all
  using (
    section_id in (
      select ts.id from template_sections ts
      join templates t on t.id = ts.template_id
      where t.household_id = get_my_household_id()
    )
  );

create policy "household users can manage template items"
  on template_items for all
  using (
    subcategory_id in (
      select tsc.id from template_subcategories tsc
      join template_sections ts on ts.id = tsc.section_id
      join templates t on t.id = ts.template_id
      where t.household_id = get_my_household_id()
    )
  );

-- Trips
create policy "household users can manage trips"
  on trips for all
  using (household_id = get_my_household_id());

-- Checklist sections, subcategories, items
create policy "household users can manage checklist sections"
  on checklist_sections for all
  using (
    trip_id in (
      select id from trips where household_id = get_my_household_id()
    )
  );

create policy "household users can manage checklist subcategories"
  on checklist_subcategories for all
  using (
    section_id in (
      select cs.id from checklist_sections cs
      join trips t on t.id = cs.trip_id
      where t.household_id = get_my_household_id()
    )
  );

create policy "household users can manage checklist items"
  on checklist_items for all
  using (
    subcategory_id in (
      select csc.id from checklist_subcategories csc
      join checklist_sections cs on cs.id = csc.section_id
      join trips t on t.id = cs.trip_id
      where t.household_id = get_my_household_id()
    )
  );

-- AI suggestions log
create policy "household users can read suggestions log"
  on ai_suggestions_log for select
  using (household_id = get_my_household_id());
```

---

## Vercel Serverless Function — AI Suggestions

**File:** `api/suggest.js`

This function sits between the React client and Claude API. The client never touches the API key.

```javascript
// api/suggest.js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tripContext, baseItems } = req.body;

  if (!tripContext || !baseItems) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompt = buildPrompt(tripContext, baseItems);

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].text;
    const suggestions = parseResponse(raw);

    return res.status(200).json({ suggestions, raw });

  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: 'Suggestion generation failed' });
  }
}

// IMPORTANT: checklist_items inserts must be chunked.
// PostgREST can hang or fail on large single-request payloads
// (e.g. 4 travellers x 38-item template = 152+ rows in one call).
// Insert in chunks of 200 rows maximum.
const CHECKLIST_INSERT_CHUNK = 200

async function insertChecklistChunks(supabase, rows) {
  if (!rows.length) return
  for (let i = 0; i < rows.length; i += CHECKLIST_INSERT_CHUNK) {
    const chunk = rows.slice(i, i + CHECKLIST_INSERT_CHUNK)
    const { error } = await supabase.from('checklist_items').insert(chunk)
    if (error) throw error
  }
}

// IMPORTANT: truncate AI log text before insert.
// prompt_sent and response_raw can be very large and slow or break the insert.
const AI_LOG_MAX_CHARS = 120_000
function clipText(s) {
  const t = typeof s === 'string' ? s : ''
  return t.length <= AI_LOG_MAX_CHARS ? t : t.slice(0, AI_LOG_MAX_CHARS) + '…[truncated]'
}

function buildPrompt(tripContext, baseItems) {
  return `You are a helpful travel packing assistant for a family.

TRIP CONTEXT:
- Destination: ${tripContext.destination}
- Dates: ${tripContext.datesFrom} to ${tripContext.datesTo}
- Weather: ${tripContext.weather}
- Trip type: ${tripContext.tripType}
- Travellers: ${tripContext.travellers.map(t => `${t.name} (${t.role}${t.age ? ', age ' + t.age : ''})`).join(', ')}

ITEMS ALREADY IN THE PACKING LIST:
${baseItems.map(i => `- ${i.label} (for ${i.memberName})`).join('\n')}

Your task: Identify important items that are MISSING from the list above, given this specific trip context.

Rules:
- Only suggest items that are genuinely important for this specific trip
- Do not suggest items already in the list
- For each suggestion, identify which travellers it is most relevant to
- If a suggestion is specific to one traveller due to age or role, flag it
- Return 3 to 6 suggestions maximum — quality over quantity
- Be specific: "Sunscreen SPF 50+" not just "sunscreen"

Respond ONLY with a JSON array. No preamble, no explanation, no markdown fences.

Format:
[
  {
    "label": "item name",
    "reason": "short reason why this matters for this trip (max 10 words)",
    "assignTo": ["all"] or ["Mum", "Tom"] etc — use actual traveller names,
    "isPersonSpecific": false,
    "personSpecificNote": null or "Sara · age 2"
  }
]`;
}

function parseResponse(raw) {
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    console.error('Failed to parse Claude response:', raw);
    return [];
  }
}
```

**Environment variables required in Vercel:**
```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## Module 1 — Project Setup

```
Set up a new React + Vite project called "trip-checklist" with the following:

1. Install dependencies:
   - react, react-dom, vite
   - tailwindcss, postcss, autoprefixer
   - lucide-react
   - @supabase/supabase-js
   - react-router-dom
   - @anthropic-ai/sdk (for the serverless function only — not used client-side)

2. Configure Tailwind with custom theme:
   - Font family 'dm-sans' → 'DM Sans', sans-serif
   - Extend colours with all tokens from the design system
   - Border radius tokens: card (12px), button (10px), pill (20px), input (8px)

3. Add Google Fonts import for DM Sans 400 and 500 in index.html.

4. Create folder structure:
   src/
     components/
       screens/       ← one file per screen
       ui/            ← reusable components (Button, Avatar, CheckItem etc.)
       wizard/        ← wizard step components
     data/
       household.js   ← hardcoded HOUSEHOLD for Level 1
       templates.js   ← hardcoded TEMPLATES for Level 1
       trips.js       ← hardcoded INITIAL_TRIPS with full Barcelona data
     hooks/
       useTrips.js    ← stub for now
       useHousehold.js ← stub for now
     lib/
       supabase.js    ← supabase client initialisation (stubbed for Level 1)
     App.jsx
     main.jsx
     index.css
   api/
     suggest.js       ← Vercel serverless function (stubbed for Level 1)

5. Set page background #faf8f4. Apply DM Sans globally via Tailwind.

6. App.jsx: implement state-driven screen switching for Level 1.
   State: currentScreen ('dashboard' | 'wizard' | 'trip'), currentTripId.

Do not build any screen content yet. Confirm structure before proceeding.
STOP and confirm before moving to Module 2.
```

---

## Module 2 — Trips Dashboard

```
Build the Trips Dashboard screen (mobile-first, max-width 430px).

TOP BAR:
- Left: "My Trips" (18px/500) + subtitle "N trips · N upcoming" (12px secondary)
- Right: circular icon button with Plus icon → navigates to wizard

BODY (scrollable, padding 12px 16px):
- Section "Upcoming" → upcoming trips
- Section "Archive" → completed trips
- Each section has a section label above

TRIP CARD (reusable component):
- White card, border 0.5px, radius 12px, padding 14px 16px, margin-bottom 8px
- Left: 38x38px icon tile, radius 8px. Colours by template + status:
    Flight upcoming:   bg #3d6494  icon white Plane
    Flight completed:  bg #E6F1FB  icon #185FA5 Plane
    Day trip:          bg #E1F5EE  icon #0F6E56 Car
    Weekend:           bg #FAEEDA  icon #854F0B Moon
- Centre: trip name (14px/500) + meta (12px secondary: "dates · traveller description")
    Upcoming: show mini progress bar (48px wide, 4px, bg #f1efe8, fill #2a9d6e) below meta
- Right: status badge
    In progress: bg #FAEEDA text #854F0B shows completion % e.g. "42%"
    Completed:   bg #f1efe8 text #6b6b6b shows "Done"

BEHAVIOUR:
- Upcoming trip → navigates to Trip Page
- Completed trips → no action (Level 1)
- Plus button → navigates to Wizard

Seed with 3 hardcoded trips from INITIAL_TRIPS.
Small decisions: gap between sections, empty state copy, hover states.
STOP if navigation model or data shape is unclear.
```

---

## Module 3 — New Trip Wizard

```
Build the 4-step New Trip Wizard, controlled by wizardStep state (1–4).

SHARED CHROME:
- Top bar: "Cancel" + X on step 1, "Back" + ArrowLeft on steps 2–4
- Step indicator: 4 dots + connecting lines
    Done: filled #2a9d6e + white Check
    Active: filled #3d6494 + white number
    Upcoming: outlined + secondary number
    Lines: #e0ddd8 default, #2a9d6e when left step is done
- Sticky bottom action area: border-top 0.5px, padding 12px 16px, full-width CTA

---

STEP 1 — Template:
- Section label: "Choose a template"
- 3 stacked template cards (white, border 1.5px, radius 12px, padding 16px)
    Left: 42x42px icon tile (default: #f1efe8 + secondary icon; selected: #3d6494 + white)
    Centre: name (14px/500) + item count (12px secondary)
    Right: circle check (outlined default, filled #3d6494 selected)
    One selectable at a time. "Flight abroad" pre-selected.
- Footer hint: "You can customise items after generation"
- CTA: "Next — Who's coming" (navy)

---

STEP 2 — Who's coming:
- Section label: "Who's coming?"
- 2×2 grid of traveller cards (white, border 1.5px, radius 12px, padding 14px)
    Avatar circle (34px) + name (13px/500) + role/age (11px secondary) + check circle right
    Selected: border #3d6494, check filled #3d6494
    All 4 pre-selected on load. Tap to toggle.
- Hint below grid: "N travellers · each gets their own checklist" (updates dynamically)
- CTA: "Next — Trip details" (navy)

---

STEP 3 — Trip details:
- Section label: "Trip details"
- 4 static display fields (Level 1 — not editable inputs):
    Destination, Dates, Expected weather, Trip type
    Each: label (12px secondary) + value div (14px, border 0.5px #e0ddd8, radius 8px, padding 10px 12px, white bg)
- Hardcoded values: Barcelona, Spain / Jul 14–21 2026 / Hot & sunny ~28°C / Beach + city
- CTA: "Next — Review suggestions" (navy)

---

STEP 4 — AI Suggestions:
- Header: Sparkles icon (amber) + "Suggested additions" (14px/500)
- Subtitle: "Based on [destination] in [month] with [kid count] kids." (12px secondary)
- 4 suggestion cards (white, border 0.5px, radius 12px, padding 13px 14px)

SUGGESTION CARD:
  Top row: [checkbox 20x20 radius 5px] + [name (14px/500) + optional person badge + reason (12px secondary)]
    Checked: bg #2a9d6e. Person badge: bg #FAECE7 text #993C1D radius 20px 11px
  Assign row (indented 30px): person chips
    Default chip: bg #f1efe8 border 0.5px text #1a1a1a
    Selected chip: bg #3d6494 text white
    "All" chip toggles all other chips for that card

HARDCODED SUGGESTIONS:
// DEMO SCAFFOLDING — delete entirely in Module 9 when /api/suggest is wired up.
// Store these in src/data/demo.js as DEMO_SUGGESTIONS, never inline in the component.
// In Module 9, Step 4 renders the live Claude API response instead.
// Deletion checklist for Module 9:
//   [ ] Remove DEMO_SUGGESTIONS from src/data/demo.js
//   [ ] Remove all imports of DEMO_SUGGESTIONS
//   [ ] Verify Step 4 renders correctly from real API response
//   [ ] Confirm no demo data remains before marking Module 9 done

1. "Sunscreen SPF 50+" — "Beach destination · 28°C · kids present" — All/Mum/Dad/Tom/Sara — pre-checked, All selected
2. "EU Health Card (EHIC)" — "EU travel · emergency medical coverage" — All/Mum/Dad — pre-checked, All selected
3. "Extra diapers (travel pack)" — "Airport delays may extend supply needs" — badge "Sara · age 2" — Sara/Mum — pre-checked, Sara selected
4. "Portable fan / cooling towel" — "July heat with young children outdoors" — All/Tom/Sara — NOT pre-checked

ON "Generate all checklists":
- Merge accepted suggestions into Barcelona checklists (isAiSuggested: true)
- Navigate to Trip Page for Barcelona

Small decisions: chip spacing, overflow scroll, suggestion card gaps.
STOP if suggestion merging logic or navigation is unclear.
```

---

## Module 4 — Trip Page

```
Build the Trip Page — the main working screen.

TOP BAR:
- Left: "All trips" back link (ArrowLeft, color #2d6fb5, 13px)
- Right: MoreVertical icon button (no action — Level 1)

TRIP HERO CARD:
- bg #3d6494, radius 12px, padding 16px, margin-bottom 12px
- Trip name + Plane icon (17px/500, white)
- Meta: "dates · nights · template name" (12px #aec6e8)
- Pills row: weather, traveller count, trip type
    Pill: bg rgba(255,255,255,0.15), text #deeeff, radius 20px, padding 3px 9px, 11px
- Progress row: track (flex:1, 5px, bg rgba(255,255,255,0.2)) + fill #2a9d6e at correct % + label "N% ready" (#aee8cc 12px)
- Progress % = total checked / total items across all person checklists

AI SUGGESTIONS COLLAPSIBLE PANEL:
- White card, border 0.5px solid #e8d8b0, radius 12px
- COLLAPSED (default):
    Single row: Sparkles (amber) + "Suggestions included" (13px/500 #7a4f0d) + count badge (amber bg, white text) + ChevronDown
    Tap to expand
- EXPANDED:
    Body bg #fffaf3, border-top 0.5px #e8d8b0
    List of accepted suggestions: name (13px/500) + "Added to: [names]" (11px secondary)
    Display only — no navigation, no editing
- Implement with max-height CSS transition (250ms ease)
- ChevronDown rotates 180° when expanded

PERSON CARDS (one per traveller):
- White card, border 0.5px, radius 12px, margin-bottom 10px, overflow hidden

PERSON HEADER (always visible, tappable):
  Avatar (32px) + name (14px/500) + [mini bar 44px + "N/N" count] + Chevron
  Padding 13px 14px. Border-bottom 0.5px when expanded.

PERSON BODY (expanded by default, collapsible via max-height transition):
  Padding 0 14px 13px
  Items grouped by category. Category label above each group.

  CHECKLIST ITEM ROW:
    [GripVertical — opacity 0.3, cursor grab] [checkbox 18x18 radius 4px] [label flex:1]
    Checked: bg #2a9d6e, label line-through #9a9a9a
    Border-bottom 0.5px rgba(0,0,0,0.06) between items, none on last
    Add TODO comment: // TODO L2: implement drag-to-reorder with react-beautiful-dnd

  ADD ITEM ROW (bottom of each person body):
    Dashed border input + "Add" button (bg #3d6494, white, radius 8px, padding 7px 12px, 12px)
    On Add:
      - Create item: isManuallyAdded true, category "Other"
      - Append to person's list
      - Clear input
      - New item appears with BookmarkPlus icon + "Save to template" link (11px #2d6fb5) on right
    On "Save to template" tap:
      - Change to "✓ Saved" (color #2a9d6e)
      - Set savedToTemplate: true
      - Add TODO: // TODO L2: persist saved item back to template_items in Supabase

BARCELONA HARDCODED CHECKLIST DATA:

Mum — Documents: Passport (checked), Boarding pass (checked), Travel insurance, EU Health Card [AI]
      Clothing: Summer clothes 5 days (checked), Swimwear
      Toiletries: Sunscreen SPF 50+ [AI]

Dad — Documents: Passport (checked), Boarding pass, EU Health Card [AI]
      Clothing: Summer clothes, Swimwear
      Toiletries: Sunscreen SPF 50+ [AI]

Tom (age 7) — Clothing: Summer clothes 5 sets, Swimwear
              Entertainment: iPad + headphones
              Toiletries: Sunscreen SPF 50+ [AI]

Sara (age 2) — Essentials: Diapers travel supply, Extra diapers travel pack [AI]
               Clothing: Summer clothes 7 sets
               Toiletries: Sunscreen SPF 50+ [AI]

Small decisions: order of person cards, empty state per person, animation timing.
STOP if collapse behaviour, progress calculation, or add-item flow is unclear.
```

---

## Module 5 — Polish & Transitions

```
Add motion and micro-interactions. Do not change any layout or behaviour.

1. SCREEN TRANSITIONS:
   Forward (dashboard → wizard → trip): slide in from right, 200ms ease-out
   Back: slide out to right, 200ms ease-in
   Use CSS classes + React state. No library needed.

2. WIZARD STEP TRANSITIONS:
   Forward/back: content fade out 80ms → new content fade in 150ms

3. CHECKLIST ITEM CHECK:
   Checkbox: scale(0.85) → scale(1) pop on check, 100ms
   Label: opacity transition to secondary color (fallback for line-through)

4. PERSON CARD COLLAPSE:
   max-height transition 250ms ease
   ChevronDown rotates 180° when expanded, 200ms

5. AI SUGGESTIONS PANEL:
   Same max-height collapse/expand as person cards

6. ADD ITEM:
   New row: translateY(8px) opacity 0 → translateY(0) opacity 1, 150ms ease-out

7. PROGRESS BAR:
   On load: animate fill from 0 to value, 600ms ease-out, delay 200ms

8. AMBER CTA:
   Single pulse on first render: scale 1 → 1.03 → 1, 400ms. Not looping.

Small decisions: easing curves within described timings, card hover bg tint.
STOP if any animation conflicts with existing layout.
```

---

## Module 6 — Responsive Breakpoint

```
Add single responsive breakpoint for tablet/desktop.

≥ 768px:
- Centre app in 430px max-width container, auto horizontal margins
- Container: border 1px solid rgba(0,0,0,0.08), border-radius 32px
- Page background outside container: #ede9e3
- App scrolls inside container, not the page

< 768px:
- Full width, no border, no outer radius, standard mobile scroll

Do not change any internal layout or component behaviour.
```

---


## Auth Bootstrap — Lessons Learned

**Do not skip this section.** These patterns emerged from debugging and must be followed exactly.

### The core rule: one linear bootstrap, no competing paths

```
await getSession()           // single source of truth for cold start
  → set user/session
  → if logged in: await fetchHousehold()
  → finally: setLoading(false)   // ALWAYS runs, even on error

onAuthStateChange()          // handles SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED
                             // does NOT re-run fetchHousehold on TOKEN_REFRESHED or USER_UPDATED
                             // does NOT handle INITIAL_SESSION (avoids a second competing bootstrap)
```

Never have two parallel paths both trying to resolve the session on first load.

### fetchHousehold rules

- Query `household_users` with `.order('joined_at', { ascending: true }).limit(1).maybeSingle()`
- Then fetch `households` separately — do not use nested PostgREST embeds (RLS edge cases)
- Use a module-level in-flight Map to deduplicate concurrent calls for the same userId
- Wrap in try/finally — `householdLoading` must always clear
- Cap with a timeout (25s default, configurable via `VITE_HOUSEHOLD_FETCH_TIMEOUT_MS`)
- On timeout: clear loading and continue — the user can still see the app

### householdLoading — what it gates and when NOT to show it

`householdLoading` blocks routing only on the **first** household resolution per user per page session.
After the first resolution completes (success, error, or timeout), subsequent background refetches
must NOT set `householdLoading = true` again. Doing so causes repeated full-screen loading flashes
on every auth event (TOKEN_REFRESHED fires ~every 60s).

Track this with a module-level `householdFetchCompletedForUserId` variable:
- If `userId !== householdFetchCompletedForUserId` → show loading gate, set it after first fetch
- If already completed for this user → refetch silently in background, never show loading gate

### Auth events — what triggers fetchHousehold

| Event | Action |
|---|---|
| `SIGNED_IN` (first time for this user) | Run fetchHousehold, show loading gate |
| `SIGNED_IN` (same user, already resolved) | Update session only, skip fetchHousehold |
| `TOKEN_REFRESHED` | Update session only, skip fetchHousehold |
| `USER_UPDATED` | Update session only, skip fetchHousehold |
| `SIGNED_OUT` | Clear user, household, reset householdFetchCompletedForUserId |

### The PGRST116 error — what it means and how to prevent it

`PGRST116: Results contain N rows, application/vnd.pgrst.object+json requires 1 row`

This error means `.maybeSingle()` found more than 1 row. In this app it means a user has
multiple rows in `household_users` — almost always caused by repeated onboarding runs in dev.

**Prevention:** the `household_users_user_id_unique` constraint (in schema above) makes this impossible.

**If you see it in production:** a user has duplicate membership rows. Fix:
```sql
-- Keep the oldest, delete the rest
DELETE FROM household_users
WHERE user_id = '<affected_user_id>'
AND household_id NOT IN (
  SELECT household_id FROM household_users
  WHERE user_id = '<affected_user_id>'
  ORDER BY joined_at ASC
  LIMIT 1
);
```

### LoginScreen loading states — avoid UI flashes

After a successful sign-in, do NOT immediately drop the form spinner.
The button stays in submitting state until `user` appears in context.
While `authLoading || householdLoading` and `user` is set → show a full-screen
"Signing you in…" overlay instead of the form or verify card.
This prevents a split-second flash of the wrong UI state between sign-in and redirect.

## Module 7 — Supabase Integration & Auth

```
Wire up Supabase Auth and replace hardcoded data with real database queries.
This module introduces react-router-dom for proper routing.

SETUP:
- Initialise Supabase client in src/lib/supabase.js using env vars
- Add react-router-dom. Define routes matching the screen structure above.
- Create an AuthContext (src/contexts/AuthContext.jsx):
    Exposes: user, session, household, loading
    On mount: check existing session, fetch household + household_members
    Provides: signIn, signUp, signOut functions

PROTECTED ROUTES:
- / (dashboard), /new, /trips/:id, /settings → require auth → redirect to /login if no session
- /login, /onboarding → redirect to / if already authenticated

AUTH SCREEN (/login):
- Two tabs: "Sign in" / "Sign up" (toggle, not separate routes)
- Sign in: email + password fields + "Sign in" button
- Sign up: email + password + confirm password + "Create account" button
- Both: inline field-level validation (empty, invalid email, password mismatch)
- Error messages from Supabase displayed inline (e.g. "Invalid credentials")
- Loading state on submit button
- After sign in → check if household exists:
    Yes → redirect to /
    No → redirect to /onboarding

HOOKS TO IMPLEMENT:
- useTrips(householdId): fetches trips + trip_travellers + checklist progress
- useHousehold(householdId): fetches household_members
- useTripDetail(tripId): fetches full trip with all checklist_items per member
- useTemplates(householdId): fetches templates + template_items

Replace all hardcoded data references with these hooks.
Show loading skeletons while data fetches (simple grey rounded rectangles — match card shapes).
Show inline error states if fetch fails ("Couldn't load trips — tap to retry").

Small decisions: skeleton animation style (pulse), exact loading state timing.
STOP if the auth flow, routing structure, or hook design is unclear.
```

---

## Module 8 — Onboarding Flow

```
Build the onboarding flow at /onboarding. Runs once after first sign-up.
Controlled by onboardingStep state (1–3).

STEP 1 — Welcome:
- Full-screen centred layout
- App icon (use Plane in a 64px rounded square, bg #3d6494, white icon)
- Heading: "Welcome to PackSmart" (22px/500)
- Subtext: "Let's set up your household so you never forget a thing." (16px secondary, centred)
- CTA: "Get started" (navy, full-width)
- Skip link below: "Skip for now" (12px #6b6b6b) → goes directly to dashboard, creates unnamed household

STEP 2 — Household name:
- Section label: "Your household"
- Single text input: placeholder "e.g. The Levi Family"
- Helper text: "This helps identify your household if you invite a partner." (12px secondary)
- CTA: "Next" (navy)
- Skip: "I'll do this later" (12px secondary, centred below CTA)
- On Next: create household record in Supabase, create household_users record for current user (role: owner)

STEP 3 — Add family members:
- Section label: "Who's in your family?"
- List of added members (starts empty)
- ADD MEMBER FORM (inline, always visible below list):
    Name input + Role selector (Parent / Kid toggle chips) + Age input (only if Kid selected)
    "Add member" button (ghost style)
    On add: POST to household_members, append to list
- Each added member shows as a row: avatar + name + role/age + remove button (X)
- CTA: "All done — let's go" (navy) → creates 3 default templates for household → redirects to /
- Skip: "I'll add people later" (12px secondary) → redirects to /

DEFAULT TEMPLATES TO SEED ON HOUSEHOLD CREATION:
See architecture-refactor-prompt.md Step 2 for the full section → subcategory → item
structure for all 3 templates. That document is the authoritative seeding spec.

Summary:
- Flight abroad: shared sections (Documents, Essentials) + person section per member
- Day trip: shared section (Essentials) + person section per member
- Weekend away: shared sections (Documents, Essentials) + person section per member

Person sections use the member's real name and member_id — not generic labels.
Shared sections have member_id = null.

STOP if the template seeding logic or member creation flow is unclear.
```

---

## Module 9 — Trip Creation with Real Data

```
Replace the hardcoded wizard with a real trip creation flow backed by Supabase.

STEP 1 — Template: fetch from templates table for this household.
STEP 2 — Who's coming: fetch from household_members for this household.
STEP 3 — Trip details: real input fields (not static display values).
  Fields: Destination (text), Dates (date range picker — use two date inputs for simplicity), Weather (text), Trip type (text)
  All fields required. Inline validation on Next tap.

STEP 4 — AI Suggestions:
  On entering step 4:
  1. Fetch template_sections → template_subcategories → template_items for the selected template
  2. POST to /api/suggest with:
       tripContext: { destination, datesFrom, datesTo, weather, tripType, travellers (with ages) }
       baseItems: flattened list of template items (label + subcategory name + section name)
  3. Show loading state: "Generating suggestions..." with Sparkles icon animating (pulse)
  4. On response: render suggestion cards with real data from Claude
  5. On error: show "Couldn't generate suggestions" + "Skip suggestions" button

  Suggestions panel shows two tracks:
    - Shared suggestions (adapter, documents) → will land in shared checklist sections
    - Person-specific suggestions (diapers for Sara) → will land in that person's section

ON "Generate all checklists":
  1. Create trip record in Supabase
  2. Insert trip_travellers records for selected members
  3. Copy template structure → checklist structure using createChecklistFromTemplate()
     See architecture-refactor-prompt.md Step 3 for the exact copy logic.
     - Shared sections: always copied regardless of who is travelling
     - Person sections: only copied for travelling members
     - Use insertChecklistChunks() — max 200 rows per insert
  4. Insert AI-suggested items (is_ai_suggested: true) into correct section + subcategory
     See architecture-refactor-prompt.md Step 7 for routing logic.
  5. Log to ai_suggestions_log:
       prompt_sent, response_raw, suggestions_accepted (count of checked), suggestions_total
  6. Navigate to /trips/:newTripId

STOP if the trip creation transaction, suggestion routing, or logging logic is unclear.
```

---

## Module 10 — Trip Page with Real Data

```
Replace hardcoded trip page data with live Supabase queries.

- useTripDetail(tripId) fetches full nested structure:
    checklist_sections → checklist_subcategories → checklist_items
    Returns normalised object with sections split into shared and person tracks.
    See architecture-refactor-prompt.md Step 5 for the exact return shape.

- Trip page renders two visual tracks:
    SHARED sections at top (Documents, Essentials etc.)
    PEOPLE sections below (one card per travelling member, showing real name + avatar)
    See architecture-refactor-prompt.md Step 4 for full layout spec.

- Checking an item: PATCH checklist_items set checked = true/false immediately (optimistic update)
- Progress bar recalculates reactively from local state after each check
  Overall = total checked / total items across ALL sections (shared + person)

- Add subcategory: INSERT checklist_subcategories, append to section in local state
- Add item within subcategory: INSERT checklist_items (is_manually_added: true)
  Show "Save to template" link on new item
- Save to template:
    UPDATE checklist_items set saved_to_template = true
    INSERT template_items into matching template_subcategory
    (match by section name + subcategory name)

- AI suggestions panel: reads from checklist_items where is_ai_suggested = true,
  grouped by their parent section (shared or person)

STOP if the optimistic update pattern, subcategory creation, or save-to-template mutation is unclear.
```

---

## Module 11 — Settings & Household Management

```
Build the Settings screen at /settings.

TOP BAR: "Settings" title + back arrow

SECTIONS:

1. HOUSEHOLD
   - Display household name with edit button (inline edit on tap)
   - List of household members (same card style as onboarding)
     Each member: avatar + name + role/age + Edit button
   - Edit member: inline form (name, role, age) — save on confirm
   - Remove member: tap X → confirmation dialog "Remove [name]? Their checklist items will remain on existing trips." → confirm deletes member
   - "Add family member" button (ghost, Plus icon) → same inline form as onboarding

2. INVITE PARTNER
   - "Invite someone to your household" section
   - "Copy invite link" button → generates a Supabase invite URL and copies to clipboard
   - Helper text: "Anyone with this link can join your household."
   - Note: link expires after 7 days (Supabase default)

3. ACCOUNT
   - Display current user email (read-only)
   - "Sign out" button (danger ghost style)
   - Tap sign out → clear session → redirect to /login

Small decisions: confirmation dialog styling, success toast on member save.
STOP if the invite link generation or member edit flow is unclear.
```

---

## Module 12 — Final QA Pass

```
Perform a full quality assurance pass across the entire application.

1. AUTH FLOW:
   [ ] Sign up → onboarding → dashboard
   [ ] Sign in → dashboard (skips onboarding)
   [ ] Sign out → login screen
   [ ] Invited user link → sign up → dashboard (no onboarding)
   [ ] Protected routes redirect to /login when unauthenticated

2. ONBOARDING:
   [ ] Skip at step 1 → dashboard with empty state
   [ ] Skip at step 2/3 → dashboard
   [ ] Complete flow → household + members + templates created in Supabase
   [ ] Default templates seeded with correct section → subcategory → item structure
   [ ] Person sections in templates use real member names and member_ids
   [ ] Shared sections in templates have member_id = null
   [ ] Verify in Supabase: template_sections, template_subcategories, template_items all populated

3. TRIP CREATION:
   [ ] All 4 wizard steps navigable forward and back
   [ ] Template selection reflects real household templates
   [ ] Traveller selection reflects real household members
   [ ] Trip detail fields validate correctly (required fields, date logic)
   [ ] AI suggestions load correctly from /api/suggest
   [ ] AI error state shows correctly when API fails
   [ ] Trip creation writes correct records to all tables
   [ ] ai_suggestions_log record created with correct accepted/total counts
   [ ] New trip appears on dashboard

4. TRIP PAGE:
   [ ] Shared sections render above people sections with correct track labels
   [ ] Shared section cards show category icon (no avatar)
   [ ] Person section cards show avatar + real member name
   [ ] Subcategory labels visible within each section
   [ ] Checking items updates Supabase immediately (optimistic update)
   [ ] Progress bar updates reactively — overall and per-section
   [ ] Add subcategory works within any section
   [ ] Add item works within any subcategory
   [ ] Save to template writes back to correct template_items row
   [ ] AI suggestions panel shows accepted items grouped by section
   [ ] All section cards collapse and expand independently
   [ ] Suggestions panel collapses and expands without navigating away

5. SETTINGS:
   [ ] Edit household name persists
   [ ] Add / edit / remove member works
   [ ] Invite link copies to clipboard
   [ ] Sign out clears session

6. DESIGN:
   [ ] DM Sans applied globally
   [ ] All colours match design system exactly
   [ ] No hardcoded hex values outside of Tailwind config
   [ ] Mobile layout correct at 375px
   [ ] Desktop frame correct at ≥ 768px
   [ ] No console errors or warnings
   [ ] All transitions present and non-janky

STOP and report any failures before marking QA complete.
```

---

## Development TODO Flags

The following are explicitly deferred. Add these as TODO comments in relevant components:

```javascript
// TODO L3: Drag-to-reorder checklist items within subcategory (react-beautiful-dnd)
// TODO L3: Drag-to-reorder subcategories within a section
// TODO L3: Duplicate member section across templates
//          ("copy Kid A list to Kid C" — resolves new member onboarding)
// TODO L3: Nudge user to add new household member to existing templates
//          ("You added Charlie — want to add him to your templates?")
// TODO L3: Post-trip "update template?" prompt after marking trip complete
// TODO L3: Category auto-assign on add-item via Claude API
// TODO L3: PWA / offline mode with service worker caching
// TODO L3: Push notifications for trip departure reminders
// TODO L3: Trip sharing / export as PDF summary
// TODO L3: Per-person completion notifications to invited partner
// TODO L3: Template editor UI (dedicated screen for editing template structure)
```

---

## Environment Variables

```
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Supabase service key (server-side only — used by keepalive cron)
SUPABASE_SERVICE_KEY=eyJ...

# Anthropic (server-side only — Vercel function)
ANTHROPIC_API_KEY=sk-ant-...

# Optional: extend household fetch timeout on slow networks (default 25000ms)
VITE_HOUSEHOLD_FETCH_TIMEOUT_MS=25000
```

Never expose `ANTHROPIC_API_KEY` or `SUPABASE_SERVICE_KEY` to the client.
Both must only be used in server-side Vercel functions (`api/suggest.js`, `api/keepalive.js`).
