/** Canvas viewport presets (desktop / tablet / phone widths and zoom). */
export type Device = 'desktop' | 'tablet' | 'mobile'

export const WIDTHS: { px: number; label: string; device: Device }[] = [
  { px: 1920, label: 'Large desktop', device: 'desktop' },
  { px: 1440, label: 'Desktop', device: 'desktop' },
  { px: 1280, label: 'Laptop', device: 'desktop' },
  { px: 1024, label: 'Small laptop', device: 'desktop' },
  { px: 834, label: 'Tablet', device: 'tablet' },
  { px: 768, label: 'Tablet portrait', device: 'tablet' },
  { px: 430, label: 'Large phone', device: 'mobile' },
  { px: 390, label: 'Phone', device: 'mobile' },
  { px: 360, label: 'Small phone', device: 'mobile' },
]

export const DEVICE_DEFAULT: Record<Device, number> = { desktop: 1440, tablet: 834, mobile: 390 }

export function deviceOf(width: number): Device {
  return width >= 1024 ? 'desktop' : width >= 600 ? 'tablet' : 'mobile'
}

export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2]

/** Zoom that fits `frame` px into `available` px (with padding), capped at 100%. */
export function fitZoom(frame: number, available: number, pad = 48): number {
  if (available <= 0) return 1
  return Math.max(0.2, Math.min(1, Math.floor(((available - pad) / frame) * 100) / 100))
}

export function stepZoom(z: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((s) => s > z + 0.001) ?? ZOOM_STEPS.at(-1)!
  return [...ZOOM_STEPS].reverse().find((s) => s < z - 0.001) ?? ZOOM_STEPS[0]!
}

export function clampWidth(w: number): number {
  return Math.max(320, Math.min(2560, Math.round(w) || 1440))
}
