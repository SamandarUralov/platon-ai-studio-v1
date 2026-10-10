/** Development records per table (FieldOps). Records never move between environments. */
const o = (
  n: number,
  job: string,
  customer: string,
  tech: string,
  status: string,
  due: string,
  hours: string,
) => ({
  id: `wo_${n}`,
  ref: `WO-${n}`,
  job,
  customer,
  tech,
  status,
  due,
  hours,
  photos: ['2 photos', '—', '4 photos', '1 photo'][n % 4],
})

export function seedRecords(): Record<string, Record<string, unknown>[]> {
  return {
    work_orders: [
      o(1042, 'HVAC quarterly inspection', 'Northwind Clinics', 'Sam Ortiz', 'Scheduled', '2026-10-06', '0'),
      o(
        1043,
        'Replace rooftop compressor',
        'Harbor Foods',
        'Priya Nair',
        'Waiting on parts',
        '2026-10-08',
        '3.5',
      ),
      o(1044, 'Backup generator test', 'Northwind Clinics', 'Sam Ortiz', 'In progress', '2026-10-06', '1.0'),
      o(1045, 'Leak above server room', 'Lumen Data', 'Leo Brandt', 'New', '2026-10-07', '0'),
      o(1046, 'Install badge readers', 'Cedar Schools', 'Ana Costa', 'Scheduled', '2026-10-09', '0'),
      o(1047, 'Boiler pressure fault', 'Harbor Foods', 'Sam Ortiz', 'Done', '2026-10-03', '2.0'),
      o(1048, 'Fire alarm annual check', 'Cedar Schools', 'Priya Nair', 'Done', '2026-10-02', '4.0'),
      o(1049, 'Lighting retrofit, level 2', 'Lumen Data', 'Leo Brandt', 'In progress', '2026-10-10', '6.5'),
    ],
    customers: [
      { id: 'c1', name: 'Northwind Clinics', contact: 'Dana Brooks', city: 'Portland', plan: 'Premium' },
      { id: 'c2', name: 'Harbor Foods', contact: 'Luis Ortega', city: 'Tacoma', plan: 'Standard' },
      { id: 'c3', name: 'Lumen Data', contact: 'Grace Kim', city: 'Seattle', plan: 'Premium' },
      { id: 'c4', name: 'Cedar Schools', contact: 'Tom Avery', city: 'Salem', plan: 'Standard' },
      { id: 'c5', name: 'Alder Hotels', contact: 'Nina Patel', city: 'Eugene', plan: 'Standard' },
    ],
    technicians: [
      { id: 't1', name: 'Sam Ortiz', region: 'North', skills: 'HVAC, Electrical', login: 'sam@fieldops.app' },
      {
        id: 't2',
        name: 'Priya Nair',
        region: 'South',
        skills: 'Fire safety, HVAC',
        login: 'priya@fieldops.app',
      },
      {
        id: 't3',
        name: 'Leo Brandt',
        region: 'Central',
        skills: 'Electrical, Plumbing',
        login: 'leo@fieldops.app',
      },
      { id: 't4', name: 'Ana Costa', region: 'Central', skills: 'Access control', login: 'ana@fieldops.app' },
    ],
    parts_used: [
      { id: 'p1', part: 'Compressor unit', order: 'WO-1043', qty: '1', cost: '$2,140' },
      { id: 'p2', part: 'Air filter pack', order: 'WO-1042', qty: '4', cost: '$36' },
      { id: 'p3', part: 'Pressure valve', order: 'WO-1047', qty: '1', cost: '$180' },
      { id: 'p4', part: 'LED panel 60×60', order: 'WO-1049', qty: '24', cost: '$58' },
    ],
    tech_sessions: [
      { id: 'k1', key: 'fieldops:tech_sessions:a81f', value: '{user: sam, device: iPhone}', ttl: '21h' },
      { id: 'k2', key: 'fieldops:tech_sessions:c02d', value: '{user: priya, device: Pixel}', ttl: '6h' },
      { id: 'k3', key: 'fieldops:tech_sessions:f9e4', value: '{user: leo, device: iPad}', ttl: '40m' },
    ],
  }
}
