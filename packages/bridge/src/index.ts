export * from './protocol'
export * from './channel'
import { createChannel, type ChannelOptions } from './channel'
import type { GuestMessages, HostMessages } from './protocol'

/** Studio side of the bridge. */
export function createHostChannel(opts: Omit<ChannelOptions, 'self' | 'peer'>) {
  return createChannel<HostMessages, GuestMessages>({
    ...opts,
    self: 'platon-studio',
    peer: 'platon-constructor',
  })
}

/** Constructor side of the bridge. */
export function createGuestChannel(opts: Omit<ChannelOptions, 'self' | 'peer'>) {
  return createChannel<GuestMessages, HostMessages>({
    ...opts,
    self: 'platon-constructor',
    peer: 'platon-studio',
  })
}
