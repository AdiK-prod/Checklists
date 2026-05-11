-- ============================================================
-- Migration 003 — Default Template Seeder Function
-- PackSmart trip checklist app
--
-- Called from the onboarding flow (Module 8) after a household
-- is created. Creates 3 default templates with sensible items.
-- Usage: select seed_default_templates('<household_uuid>');
-- ============================================================

create or replace function seed_default_templates(p_household_id uuid)
returns void as $$
declare
  v_flight_id uuid;
  v_day_id    uuid;
  v_weekend_id uuid;
  v_sort      integer;
begin

  -- ── 1. Flight abroad ─────────────────────────────────────
  insert into templates (household_id, name, icon, is_default)
  values (p_household_id, 'Flight abroad', 'Plane', true)
  returning id into v_flight_id;

  v_sort := 0;
  -- Documents (8 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_flight_id, 'Passport',                    'Documents', v_sort + 1),
    (v_flight_id, 'Boarding pass',               'Documents', v_sort + 2),
    (v_flight_id, 'Travel insurance documents',  'Documents', v_sort + 3),
    (v_flight_id, 'EU Health Card (EHIC)',        'Documents', v_sort + 4),
    (v_flight_id, 'Hotel / Airbnb confirmation', 'Documents', v_sort + 5),
    (v_flight_id, 'Car hire confirmation',       'Documents', v_sort + 6),
    (v_flight_id, 'Foreign currency / cards',    'Documents', v_sort + 7),
    (v_flight_id, 'Emergency contact list',      'Documents', v_sort + 8);
  v_sort := v_sort + 10;

  -- Clothing (7 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_flight_id, 'T-shirts (1 per day)',         'Clothing', v_sort + 1),
    (v_flight_id, 'Shorts / trousers',            'Clothing', v_sort + 2),
    (v_flight_id, 'Underwear',                    'Clothing', v_sort + 3),
    (v_flight_id, 'Swimwear',                     'Clothing', v_sort + 4),
    (v_flight_id, 'Light jacket / cardigan',      'Clothing', v_sort + 5),
    (v_flight_id, 'Comfortable walking shoes',   'Clothing', v_sort + 6),
    (v_flight_id, 'Sandals / flip flops',         'Clothing', v_sort + 7);
  v_sort := v_sort + 10;

  -- Toiletries (7 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_flight_id, 'Toothbrush & toothpaste',     'Toiletries', v_sort + 1),
    (v_flight_id, 'Shampoo & conditioner',       'Toiletries', v_sort + 2),
    (v_flight_id, 'Deodorant',                   'Toiletries', v_sort + 3),
    (v_flight_id, 'Sunscreen SPF 50+',           'Toiletries', v_sort + 4),
    (v_flight_id, 'Moisturiser',                 'Toiletries', v_sort + 5),
    (v_flight_id, 'Razor / shaving kit',         'Toiletries', v_sort + 6),
    (v_flight_id, 'Hand sanitiser',              'Toiletries', v_sort + 7);
  v_sort := v_sort + 10;

  -- Electronics (6 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_flight_id, 'Phone charger',               'Essentials', v_sort + 1),
    (v_flight_id, 'Universal travel adapter',    'Essentials', v_sort + 2),
    (v_flight_id, 'Portable power bank',         'Essentials', v_sort + 3),
    (v_flight_id, 'Headphones / earbuds',        'Essentials', v_sort + 4),
    (v_flight_id, 'Camera',                      'Essentials', v_sort + 5),
    (v_flight_id, 'Laptop / tablet',             'Essentials', v_sort + 6);
  v_sort := v_sort + 10;

  -- Medications (5 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_flight_id, 'Prescription medication',     'Medications', v_sort + 1),
    (v_flight_id, 'Paracetamol / ibuprofen',     'Medications', v_sort + 2),
    (v_flight_id, 'Antihistamines',              'Medications', v_sort + 3),
    (v_flight_id, 'Plasters / first aid kit',    'Medications', v_sort + 4),
    (v_flight_id, 'Motion sickness tablets',     'Medications', v_sort + 5);
  v_sort := v_sort + 10;

  -- Entertainment / Kids (5 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_flight_id, 'Kids tablet + headphones',    'Entertainment', v_sort + 1),
    (v_flight_id, 'Colouring book / activity kit','Entertainment', v_sort + 2),
    (v_flight_id, 'Snacks for the flight',       'Entertainment', v_sort + 3),
    (v_flight_id, 'Diapers / nappies',           'Essentials',    v_sort + 4),
    (v_flight_id, 'Baby wipes',                  'Essentials',    v_sort + 5);


  -- ── 2. Day trip ──────────────────────────────────────────
  insert into templates (household_id, name, icon, is_default)
  values (p_household_id, 'Day trip', 'Car', true)
  returning id into v_day_id;

  v_sort := 0;
  -- Documents (4 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_day_id, 'ID / driving licence',          'Documents', v_sort + 1),
    (v_day_id, 'Cash & cards',                  'Documents', v_sort + 2),
    (v_day_id, 'Car breakdown cover card',      'Documents', v_sort + 3),
    (v_day_id, 'Map / offline maps downloaded', 'Documents', v_sort + 4);
  v_sort := v_sort + 10;

  -- Clothing (5 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_day_id, 'Comfortable shoes',             'Clothing', v_sort + 1),
    (v_day_id, 'Light jacket',                  'Clothing', v_sort + 2),
    (v_day_id, 'Sunhat / cap',                  'Clothing', v_sort + 3),
    (v_day_id, 'Sunglasses',                    'Clothing', v_sort + 4),
    (v_day_id, 'Spare clothes for kids',        'Clothing', v_sort + 5);
  v_sort := v_sort + 10;

  -- Toiletries (3 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_day_id, 'Sunscreen SPF 50+',             'Toiletries', v_sort + 1),
    (v_day_id, 'Insect repellent',              'Toiletries', v_sort + 2),
    (v_day_id, 'Hand sanitiser',                'Toiletries', v_sort + 3);
  v_sort := v_sort + 10;

  -- Snacks (4 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_day_id, 'Water bottles',                 'Essentials', v_sort + 1),
    (v_day_id, 'Snacks / packed lunch',         'Essentials', v_sort + 2),
    (v_day_id, 'Baby food / formula',           'Essentials', v_sort + 3),
    (v_day_id, 'Reusable bags',                 'Essentials', v_sort + 4);
  v_sort := v_sort + 10;

  -- Kids (6 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_day_id, 'Diapers / nappies',             'Essentials',    v_sort + 1),
    (v_day_id, 'Baby wipes',                    'Essentials',    v_sort + 2),
    (v_day_id, 'Changing mat',                  'Essentials',    v_sort + 3),
    (v_day_id, 'Small toy / comfort object',    'Entertainment', v_sort + 4),
    (v_day_id, 'Plasters / first aid kit',      'Medications',   v_sort + 5),
    (v_day_id, 'Paracetamol / ibuprofen',       'Medications',   v_sort + 6);


  -- ── 3. Weekend away ──────────────────────────────────────
  insert into templates (household_id, name, icon, is_default)
  values (p_household_id, 'Weekend away', 'Moon', true)
  returning id into v_weekend_id;

  v_sort := 0;
  -- Documents (5 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_weekend_id, 'ID / passport',                 'Documents', v_sort + 1),
    (v_weekend_id, 'Accommodation confirmation',    'Documents', v_sort + 2),
    (v_weekend_id, 'Cash & cards',                  'Documents', v_sort + 3),
    (v_weekend_id, 'Travel insurance (if abroad)',  'Documents', v_sort + 4),
    (v_weekend_id, 'Emergency contact list',        'Documents', v_sort + 5);
  v_sort := v_sort + 10;

  -- Clothing (8 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_weekend_id, 'T-shirts × 2',                 'Clothing', v_sort + 1),
    (v_weekend_id, 'Jeans / trousers',              'Clothing', v_sort + 2),
    (v_weekend_id, 'Smart outfit (evening)',        'Clothing', v_sort + 3),
    (v_weekend_id, 'Underwear × 3',                'Clothing', v_sort + 4),
    (v_weekend_id, 'Pyjamas',                       'Clothing', v_sort + 5),
    (v_weekend_id, 'Comfortable shoes',             'Clothing', v_sort + 6),
    (v_weekend_id, 'Light jacket',                  'Clothing', v_sort + 7),
    (v_weekend_id, 'Kids clothes × 3 sets',        'Clothing', v_sort + 8);
  v_sort := v_sort + 10;

  -- Toiletries (7 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_weekend_id, 'Toothbrush & toothpaste',      'Toiletries', v_sort + 1),
    (v_weekend_id, 'Shampoo & conditioner',        'Toiletries', v_sort + 2),
    (v_weekend_id, 'Deodorant',                    'Toiletries', v_sort + 3),
    (v_weekend_id, 'Moisturiser',                  'Toiletries', v_sort + 4),
    (v_weekend_id, 'Razor / shaving kit',          'Toiletries', v_sort + 5),
    (v_weekend_id, 'Hair dryer (if not provided)', 'Toiletries', v_sort + 6),
    (v_weekend_id, 'Sunscreen SPF 50+',            'Toiletries', v_sort + 7);
  v_sort := v_sort + 10;

  -- Electronics (5 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_weekend_id, 'Phone charger',                'Essentials', v_sort + 1),
    (v_weekend_id, 'Travel adapter',               'Essentials', v_sort + 2),
    (v_weekend_id, 'Portable power bank',          'Essentials', v_sort + 3),
    (v_weekend_id, 'Kids tablet + headphones',     'Essentials', v_sort + 4),
    (v_weekend_id, 'Camera',                       'Essentials', v_sort + 5);
  v_sort := v_sort + 10;

  -- Medications (3 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_weekend_id, 'Prescription medication',      'Medications', v_sort + 1),
    (v_weekend_id, 'Paracetamol / ibuprofen',      'Medications', v_sort + 2),
    (v_weekend_id, 'Plasters / first aid kit',     'Medications', v_sort + 3);
  v_sort := v_sort + 10;

  -- Kids (3 items)
  insert into template_items (template_id, label, category, sort_order) values
    (v_weekend_id, 'Diapers / nappies',            'Essentials',    v_sort + 1),
    (v_weekend_id, 'Baby wipes',                   'Essentials',    v_sort + 2),
    (v_weekend_id, 'Small toy / comfort object',   'Entertainment', v_sort + 3);

end;
$$ language plpgsql security definer;
