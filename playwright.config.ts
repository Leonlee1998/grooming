import { defineConfig, devices } from '@playwright/test'

const POS_BASE_URL = process.env.POS_BASE_URL ?? 'http://localhost:3001'
const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'pos',
      testDir: './e2e/pos',
      use: {
        ...devices['iPad (gen 7) landscape'],
        baseURL: POS_BASE_URL,
      },
    },
    {
      name: 'admin',
      testDir: './e2e/admin',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: ADMIN_BASE_URL,
      },
    },
  ],
})
