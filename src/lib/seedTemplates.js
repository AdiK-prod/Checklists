/**
 * Seeds default templates for a household (call after household is created).
 * @param {*} supabaseClient
 * @param {string} householdId
 * @param {Array<{ id: string, name: string }>} members
 */
export async function seedTemplates(supabaseClient, householdId, members = []) {
  const { data: tplList, error: tplErr } = await supabaseClient
    .from('templates')
    .select('id')
    .eq('household_id', householdId)

  if (tplErr) throw tplErr

  if (tplList?.length) {
    const ids = tplList.map(t => t.id)
    const { count: secCount, error: cErr } = await supabaseClient
      .from('template_sections')
      .select('id', { count: 'exact', head: true })
      .in('template_id', ids)

    if (cErr) throw cErr
    if ((secCount ?? 0) > 0) return

    const { error: delErr } = await supabaseClient.from('templates').delete().eq('household_id', householdId)
    if (delErr) throw delErr
  }

  const flightDefs = {
    meta: { name: 'Flight abroad', icon: 'Plane', is_default: true },
    shared: [
      {
        name: 'Documents',
        subcategories: [
          {
            name: 'Travel',
            items: [
              'Passports',
              'Boarding passes',
              'Travel insurance',
              'Hotel confirmation',
              'EU Health Card',
            ],
          },
          {
            name: 'Finance',
            items: ['Foreign currency', 'Travel wallet'],
          },
        ],
      },
      {
        name: 'Essentials',
        subcategories: [
          {
            name: 'Tech',
            items: ['Phone charger', 'Travel adapter', 'Power bank'],
          },
          {
            name: 'Health',
            items: ['Sunscreen SPF 50+', 'First aid kit', 'Hand sanitiser'],
          },
        ],
      },
      {
        name: 'Misc.',
        subcategories: [{ name: 'Items', items: [] }],
      },
    ],
    personSubcategories: [
      {
        name: 'Clothing',
        items: ['Underwear', 'T-shirts', 'Bottoms', 'Sleepwear', 'Swimwear', 'Shoes'],
      },
      {
        name: 'Toiletries',
        items: ['Toothbrush + toothpaste', 'Shampoo', 'Deodorant'],
      },
      { name: 'Medications', items: [] },
    ],
  }

  const dayDefs = {
    meta: { name: 'Day trip', icon: 'Car', is_default: true },
    shared: [
      {
        name: 'Essentials',
        subcategories: [
          {
            name: 'Basics',
            items: ['Phone + charger', 'Snacks', 'Water bottles', 'Sunscreen', 'Cash / card'],
          },
        ],
      },
      {
        name: 'Misc.',
        subcategories: [{ name: 'Items', items: [] }],
      },
    ],
    personSubcategories: [
      {
        name: 'Clothing',
        items: ['Comfortable shoes', 'Weather-appropriate layer'],
      },
      { name: 'Personal', items: [] },
    ],
  }

  const weekendDefs = {
    meta: { name: 'Weekend away', icon: 'Moon', is_default: true },
    shared: [
      {
        name: 'Documents',
        subcategories: [
          {
            name: 'Travel',
            items: ['ID / passport', 'Accommodation confirmation'],
          },
        ],
      },
      {
        name: 'Essentials',
        subcategories: [
          { name: 'Tech', items: ['Phone charger', 'Laptop (if needed)'] },
          { name: 'Health', items: ['First aid kit'] },
        ],
      },
      {
        name: 'Misc.',
        subcategories: [{ name: 'Items', items: [] }],
      },
    ],
    personSubcategories: [
      {
        name: 'Clothing',
        items: ['Underwear', 'Casual outfits', 'Sleepwear', 'Shoes'],
      },
      {
        name: 'Toiletries',
        items: ['Toothbrush + toothpaste', 'Deodorant'],
      },
      { name: 'Medications', items: [] },
    ],
  }

  for (const def of [flightDefs, dayDefs, weekendDefs]) {
    await seedOneTemplate(supabaseClient, householdId, members, def)
  }
}

async function seedOneTemplate(supabaseClient, householdId, members, def) {
  const { data: tpl, error: te } = await supabaseClient
    .from('templates')
    .insert({
      household_id: householdId,
      name: def.meta.name,
      icon: def.meta.icon,
      is_default: def.meta.is_default ?? true,
    })
    .select('id')
    .single()
  if (te) throw te
  const templateId = tpl.id

  let sortOrder = 0
  const sectionRows = []
  const sectionSubs = []

  for (const sec of def.shared) {
    sectionRows.push({
      template_id: templateId,
      section_type: 'shared',
      name: sec.name,
      member_id: null,
      sort_order: sortOrder++,
    })
    sectionSubs.push(sec.subcategories)
  }

  for (const m of members) {
    sectionRows.push({
      template_id: templateId,
      section_type: 'person',
      name: m.name,
      member_id: m.id,
      sort_order: sortOrder++,
    })
    sectionSubs.push(def.personSubcategories)
  }

  const { data: insertedSecs, error: seErr } = await supabaseClient
    .from('template_sections')
    .insert(sectionRows)
    .select('id, sort_order')
    .order('sort_order', { ascending: true })

  if (seErr) throw seErr
  const orderedSecs = [...(insertedSecs || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  for (let i = 0; i < orderedSecs.length; i++) {
    const subcats = sectionSubs[i]
    if (!subcats?.length) continue
    await insertSubcategoriesWithItems(supabaseClient, orderedSecs[i].id, subcats)
  }
}

async function insertSubcategoriesWithItems(supabaseClient, sectionId, subcategories) {
  const subRows = subcategories.map((sc, idx) => ({
    section_id: sectionId,
    name: sc.name,
    sort_order: idx,
  }))
  const { data: subIns, error: suErr } = await supabaseClient
    .from('template_subcategories')
    .insert(subRows)
    .select('id, sort_order')
    .order('sort_order', { ascending: true })
  if (suErr) throw suErr
  const ordered = [...(subIns || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  for (let j = 0; j < ordered.length; j++) {
    const labels = subcategories[j].items || []
    if (!labels.length) continue
    const itemRows = labels.map((label, k) => ({
      subcategory_id: ordered[j].id,
      label,
      sort_order: k,
    }))
    const { error: itErr } = await supabaseClient.from('template_items').insert(itemRows)
    if (itErr) throw itErr
  }
}
