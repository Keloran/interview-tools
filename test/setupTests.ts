import '@testing-library/jest-dom'
import {afterEach, vi} from 'vitest'
import {cleanup} from '@testing-library/react'

// Auto-cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock next/navigation router
vi.mock('next/navigation', () => {
  return {
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
      pathname: '/',
    }),
  }
})

// Mock Clerk client/server
vi.mock('@clerk/nextjs', () => {
  return {
    useUser: () => ({user: {id: 'user_123', emailAddresses: []}}),
  }
})

vi.mock('@clerk/nextjs/server', () => {
  return {
    currentUser: vi.fn(async () => ({id: 'user_123'})),
  }
})

// Mock flags lib
vi.mock('@flags-gg/react-library', () => {
  return {
    useFlags: () => ({is: () => true}),
  }
})

// Basic mock for prisma client; individual tests can override implementations
vi.mock('@/lib/prisma', () => {
  const fn = vi.fn
  return {
    default: {
      user: {upsert: fn()},
      company: {findMany: fn(), upsert: fn()},
      stage: {findMany: fn(), upsert: fn()},
      stageMethod: {findFirst: fn(), create: fn()},
      interview: {findMany: fn(), create: fn(), update: fn()},
    },
  }
})

// matchMedia mock for components relying on it
if (!('matchMedia' in window)) {
  // @ts-expect-error - jsdom polyfill for window.matchMedia
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {
    },
    removeListener: () => {
    },
    addEventListener: () => {
    },
    removeEventListener: () => {
    },
    dispatchEvent: () => false,
  })
}

// Polyfill ResizeObserver for cmdk / UI libs in jsdom
declare global {
  var ResizeObserver: any
}

if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  class ResizeObserver {
    observe() {
    }

    unobserve() {
    }

    disconnect() {
    }
  }
  ;(globalThis as any).ResizeObserver = ResizeObserver
}

// scrollIntoView polyfill for cmdk list focusing
if (!(Element.prototype as any).scrollIntoView) {
  // @ts-expect-error - jsdom polyfill for Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = () => {
  }
}
