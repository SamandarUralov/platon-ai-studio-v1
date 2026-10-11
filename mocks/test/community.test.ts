import { describe, expect, it } from 'vitest'
import { communityCatalog, installCommunity } from '../src/seed/components'

describe('community catalog', () => {
  it('filters by name, description and tags without leaking sources', () => {
    expect(communityCatalog().length).toBeGreaterThan(2)
    expect(communityCatalog('rating').map((c) => c.name)).toEqual(['RatingStars'])
    expect(communityCatalog('sla').map((c) => c.name)).toEqual(['Countdown'])
    expect(communityCatalog()[0]).not.toHaveProperty('template')
  })

  it('installs a project copy, renamed when the name is taken', () => {
    const first = installCommunity('community:rating_stars', [])!
    expect(first.component).toMatchObject({
      id: 'component:rating_stars',
      name: 'RatingStars',
      file: 'src/components/RatingStars.vue',
      status: 'reviewed',
    })
    expect(first.source).toContain("defineEmits(['change'])")
    const second = installCommunity('community:rating_stars', ['RatingStars'])!
    expect(second.component).toMatchObject({ id: 'component:rating_stars2', name: 'RatingStars2' })
    expect(installCommunity('community:nope', [])).toBeNull()
  })
})
