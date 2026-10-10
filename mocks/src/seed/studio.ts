/** Studio-level seed data: projects, people, change log and releases (from the v4 mockup). */
import type { Change, Member, ProjectSummary, Release, StudioUser } from '@platon/definition'

export const ME: StudioUser = {
  id: 'u_maya',
  name: 'Maya Chen',
  email: 'maya@acme-facilities.com',
  role: 'owner',
}

export const ORG = { id: 'acme', name: 'Acme Facilities' }

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

export const PROJECTS: ProjectSummary[] = [
  {
    id: 'fieldops',
    name: 'FieldOps Service Desk',
    slug: 'fieldops',
    description: 'Work orders, technicians and parts for field teams',
    status: 'production',
    accent: '#0e7c66',
    tint: '#e3f5ef',
    updatedAt: ago(2),
    updatedBy: 'Maya Chen',
    version: 142,
    liveRelease: 'v1.4',
  },
  {
    id: 'purchase_approvals',
    name: 'Purchase Approvals',
    slug: 'purchase-approvals',
    description: 'Requests, budgets and two-step approvals',
    status: 'draft',
    accent: '#4f5bea',
    tint: '#eef0ff',
    updatedAt: ago(60 * 24),
    updatedBy: 'Jordan Lee',
    version: 12,
  },
  {
    id: 'client_onboarding',
    name: 'Client Onboarding Portal',
    slug: 'client-onboarding',
    description: 'Checklists, documents and client sign-off',
    status: 'production',
    accent: '#9a5b00',
    tint: '#fff3df',
    updatedAt: ago(60 * 24 * 11),
    updatedBy: 'Priya Nair',
    version: 88,
    liveRelease: 'v2.1',
  },
]

export const MEMBERS: Member[] = [
  { ...ME, lastSeenAt: ago(0) },
  {
    id: 'u_jordan',
    name: 'Jordan Lee',
    email: 'jordan@acme-facilities.com',
    role: 'editor',
    lastSeenAt: ago(5),
  },
  {
    id: 'u_priya',
    name: 'Priya Nair',
    email: 'priya@acme-facilities.com',
    role: 'editor',
    lastSeenAt: ago(0),
  },
  { id: 'u_tom', name: 'Tom Avery', email: 'tom@cedarschools.org', role: 'viewer', lastSeenAt: ago(60 * 24) },
]

const FIRST = [
  'Aziz',
  'Dilnoza',
  'Jasur',
  'Malika',
  'Sardor',
  'Nodira',
  'Bekzod',
  'Kamola',
  'Otabek',
  'Shahlo',
  'Rustam',
  'Gulnora',
  'Timur',
  'Zarina',
  'Farrukh',
  'Lola',
  'Alex',
  'Sofia',
  'Daniel',
  'Elena',
  'Marco',
  'Hana',
  'Omar',
  'Ines',
]
const LAST = [
  'Karimov',
  'Rashidova',
  'Tursunov',
  'Yusupova',
  'Aliev',
  'Nazarova',
  'Ortiz',
  'Brandt',
  'Costa',
  'Kim',
  'Patel',
  'Novak',
  'Haddad',
]

/** Organisation directory used by the member picker (120 people). */
export const DIRECTORY: StudioUser[] = Array.from({ length: 120 }, (_, i) => {
  const first = FIRST[i % FIRST.length]!
  const last = LAST[(i * 7) % LAST.length]!
  return {
    id: `u_dir_${i}`,
    name: `${first} ${last}`,
    email: `${first}.${last}${i}@acme-facilities.com`.toLowerCase(),
    role: 'editor' as const,
  }
})

export function seedChanges(): Change[] {
  return [
    {
      id: 'chg_1',
      key: 'interface.pages.orders.blocks.o3.props.columns',
      area: 'Pages',
      author: 'Maya Chen',
      authorKind: 'human',
      text: 'Added “Due” column to All work orders',
      machinePath: '+ pages.orders.blocks.o3.columns += "due"',
      ops: [
        {
          op: 'replace',
          path: '/interface/pages/orders/blocks/o3/props/columns',
          value: ['ref', 'job', 'customer', 'tech', 'status', 'due'],
        },
      ],
      baseVersion: 140,
      createdAt: ago(60 * 20),
    },
    {
      id: 'chg_2',
      key: 'workflows.work_order.states.waiting_on_parts',
      area: 'Workflow',
      author: 'Studio AI',
      authorKind: 'ai',
      text: 'Added “Waiting on parts” state between In progress and Done',
      machinePath: '+ workflows.work_order.states.waiting_on_parts',
      ops: [],
      baseVersion: 141,
      createdAt: ago(60 * 19),
    },
  ]
}

export function seedReleases(): Release[] {
  return [
    {
      id: 'rel_v1_4',
      name: 'v1.4',
      note: 'Parts used table, technicians page',
      fromVersion: 120,
      toVersion: 128,
      changes: [],
      migrations: ['V127__add_parts_used.sql', 'V128__technicians_region.sql'],
      deployments: [
        { env: 'development', status: 'succeeded', at: ago(60 * 24 * 10) },
        { env: 'staging', status: 'succeeded', at: ago(60 * 24 * 10) },
        { env: 'production', status: 'succeeded', at: ago(60 * 24 * 9), by: 'Maya Chen' },
      ],
      createdAt: ago(60 * 24 * 10),
      createdBy: 'Maya Chen',
    },
    {
      id: 'rel_v1_3',
      name: 'v1.3',
      note: 'Customer role and record visibility',
      fromVersion: 104,
      toVersion: 120,
      changes: [],
      migrations: ['V119__customer_role.sql'],
      deployments: [{ env: 'production', status: 'succeeded', at: ago(60 * 24 * 27), by: 'Maya Chen' }],
      createdAt: ago(60 * 24 * 28),
      createdBy: 'Maya Chen',
    },
    {
      id: 'rel_v1_2',
      name: 'v1.2',
      note: 'Work order workflow',
      fromVersion: 90,
      toVersion: 104,
      changes: [],
      migrations: ['V101__work_order_states.sql'],
      deployments: [{ env: 'production', status: 'succeeded', at: ago(60 * 24 * 38), by: 'Jordan Lee' }],
      createdAt: ago(60 * 24 * 38),
      createdBy: 'Jordan Lee',
    },
  ]
}
