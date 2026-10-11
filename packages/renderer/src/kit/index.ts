/**
 * Platon UI Kit (@platon-rs/platon-ui-kit) components used by kit blocks.
 *
 * The package ships no type declarations (its .d.ts is `export {}`), so components are re-exported
 * here as plain `Component`s. Its stylesheet is imported once here; Studio's Vite config scopes it
 * (see vite/kitCss.ts) — render kit components inside a `.pk` element, and wrap blocks nested in a
 * kit container with `.pk-slot`.
 */
import type { Component } from 'vue'
import * as kit from '@platon-rs/platon-ui-kit'
import '@platon-rs/platon-ui-kit/style.css'

const K = kit as unknown as Record<string, Component>

export const KitBadge = K.Badge!
export const KitButton = K.Button!
export const KitCheckbox = K.Checkbox!
export const KitDatePicker = K.DatePicker!
export const KitDateRangePicker = K.DateRangePicker!
export const KitFileUpload = K.FileUpload!
export const KitImageUpload = K.ImageUpload!
export const KitInput = K.Input!
export const KitInputFileUpload = K.InputFileUpload!
export const KitInputSearch = K.InputSearch!
export const KitMultiselectButton = K.MultiselectButton!
export const KitRichTextEditor = K.RichTextEditor!
export const KitSelectItem = K.SelectItem!
export const KitSelectWrapper = K.SelectWrapper!
export const KitSwitch = K.Switch!
export const KitTable = K.Table!
export const KitTableBody = K.TableBody!
export const KitTableCell = K.TableCell!
export const KitTableEmpty = K.TableEmpty!
export const KitTableHead = K.TableHead!
export const KitTableHeader = K.TableHeader!
export const KitTablePagination = K.TablePagination!
export const KitTableRow = K.TableRow!
export const KitTabsContainer = K.TabsContainer!
export const KitTextarea = K.Textarea!
export const KitTooltipProvider = K.TooltipProvider!

/** Variants the kit's Button / Badge / MultiselectButton accept. */
export const KIT_VARIANTS = ['primary', 'secondary', 'info', 'success', 'warning', 'error'] as const
export type KitVariant = (typeof KIT_VARIANTS)[number]
export const kitVariant = (v: unknown, d: KitVariant = 'primary'): KitVariant =>
  (KIT_VARIANTS as readonly unknown[]).includes(v) ? (v as KitVariant) : d

/** Package name and docs, shown next to kit blocks in the inspector. */
export const KIT_PACKAGE = '@platon-rs/platon-ui-kit'
