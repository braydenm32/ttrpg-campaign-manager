/**
 * The test server's port (4173, vite preview's usual one, is often busy with a copy already running).
 * TEST_PORT picks another, for running two copies of the tests side by side.
 */
export const PORT = Number(process.env.TEST_PORT) || 4175

/** The two screen sizes every screen is tried at (playwright.config.ts projects). */
export type Device = 'laptop' | 'phone'
