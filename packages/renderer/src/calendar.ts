/** Month grid for the calendar block. */
export interface DayCell {
  day: number
  inMonth: boolean
  iso: string
  today: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

export function monthGrid(year: number, month: number, todayIso: string): DayCell[] {
  const first = new Date(year, month, 1).getDay()
  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(year, month, i - first + 1)
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    cells.push({ day: d.getDate(), inMonth: d.getMonth() === month, iso, today: iso === todayIso })
  }
  return cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
