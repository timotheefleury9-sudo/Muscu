import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// jsdom n'implémente pas window.scrollTo, que Framer Motion appelle en mesurant les animations de hauteur « auto ».
window.scrollTo = (() => {}) as typeof window.scrollTo
