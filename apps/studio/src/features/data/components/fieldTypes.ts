import { FIELD_TYPES, type TableFieldType } from '@platon/definition'
import type { SelectOption } from '@platon/ui'

export const FIELD_TYPE_OPTIONS: SelectOption<TableFieldType>[] = (
  Object.keys(FIELD_TYPES) as TableFieldType[]
).map((k) => ({
  value: k,
  label: FIELD_TYPES[k].label,
}))
