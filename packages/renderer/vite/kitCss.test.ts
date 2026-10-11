import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { scopeKitCss, splitRules } from './kitCss'

const SAMPLE = [
  '@import"https://fonts.googleapis.com/css2?family=Ubuntu&display=swap";',
  '*,:before,:after{--tw-ring-color: rgb(59 130 246 / .5);content:"{"}',
  'html,:host{font-family:Ubuntu}',
  ':root{--primary: 30 107 216;--tabs: #1E6BD8}',
  '.bg-primary{background-color:rgb(30 107 216 / var(--tw-bg-opacity, 1))}',
  '@media (min-width:640px){.sm\\:flex{display:flex}body{margin:0}}',
  '@keyframes enter{0%{opacity:0}}',
  '.x[data-v-1]{color:red}',
].join('')

describe('scopeKitCss', () => {
  it('splits top-level rules, ignoring braces in strings', () => {
    const r = splitRules(SAMPLE)
    expect(r[0]!.body).toBeNull()
    expect(r[1]!.body).toContain('content:"{"')
    expect(r).toHaveLength(8)
  })

  const out = scopeKitCss(SAMPLE)
  const [layer, scope] = out.split('\n@scope')

  it('drops the remote font import', () => {
    expect(out).not.toContain('fonts.googleapis')
  })

  it('keeps only class-based rules and :root in the global layer', () => {
    expect(layer).toMatch(/^@layer platon-kit\{/)
    expect(layer).not.toContain('--tw-ring-color')
    expect(layer).not.toContain('font-family:Ubuntu')
    expect(layer).not.toContain('body{')
    expect(layer).toContain('.bg-primary{')
    expect(layer).toContain('@keyframes enter')
    expect(layer).toContain('.x[data-v-1]')
  })

  it('scopes the full sheet to .pk and maps :root to :scope', () => {
    expect(scope).toMatch(/^ \(\.pk\) to \(\.pk-slot\)\{/)
    expect(scope).toContain('--tw-ring-color')
    expect(scope).toContain(':scope{')
    expect(scope).not.toContain(':root')
    expect(scope).not.toContain('@keyframes')
  })

  it('routes the kit primary colour through --pk-primary', () => {
    expect(out).not.toMatch(/30 107 216\s*\/|#1e6bd8/i)
    expect(out).toContain('rgb(var(--pk-primary,30 107 216) / var(--tw-bg-opacity, 1))')
    expect(out).toContain('--tabs: rgb(var(--pk-primary,30 107 216))')
  })

  it('handles the real kit stylesheet', () => {
    const file = createRequire(import.meta.url).resolve('@platon-rs/platon-ui-kit/style.css')
    const css = readFileSync(file, 'utf8')
    const res = scopeKitCss(css)
    expect(res.split('{').length).toBe(res.split('}').length)
    expect(res).toContain('@scope (.pk) to (.pk-slot)')
    expect(res).not.toContain('googleapis')
  })
})
