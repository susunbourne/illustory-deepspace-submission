import { test, expect } from 'deepspace/testing'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Smoke tests covering both page kinds this template ships:
 *   - '/'      → the static landing (top level of src/pages/): no providers,
 *                so no auth fetch and no records WebSocket on load.
 *   - '/studio' → a protected production page: signed-out visitors see the
 *                 DeepSpace login gate, while signed-in users can edit records.
 *
 * The "static contract" test is the guardrail for the per-page opt-out: if
 * someone moves the providers back up into _app.tsx, it fails.
 */

/** Wait for the React app shell (present on every page). */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-root"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('static landing loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await waitForApp(page)
    await expect(page.getByTestId('static-landing')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('landing carries one title, one description, one canonical', async ({ page }) => {
    // <Seo> (src/pages/index.tsx, values from src/seo.ts) hoists these into
    // <head>. Exactly one of each: index.html ships no static description or
    // canonical, because React 19 would not dedupe against them on mount.
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await expect(page).toHaveTitle(/\S/)
    expect(await page.locator('head meta[name="description"]').count()).toBe(1)
    expect(await page.locator('head link[rel="canonical"]').count()).toBe(1)
  })

  test('static contract: landing fires no auth request, opens no websocket', async ({ page }) => {
    const offenders: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/')) offenders.push(req.url())
    })
    // Only the DO room route counts — vite's own HMR socket is a dev artifact.
    page.on('websocket', (ws) => {
      if (new URL(ws.url()).pathname.startsWith('/ws/')) offenders.push(`ws: ${ws.url()}`)
    })
    await page.goto('/')
    await expect(page.getByTestId('static-landing')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(offenders).toEqual([])
  })

  test('protected studio shows the DeepSpace login gate when signed out', async ({ page }) => {
    await page.goto('/studio')
    await expect(page.getByRole('heading', { name: 'Sign in to DeepSpace' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Studio workspace name')).toHaveCount(0)
  })

  test('signed-in owner creates a workspace and project that survive refresh', async ({ users }) => {
    test.setTimeout(90_000)
    const [owner] = await users(['Illustory owner'])
    await owner.page.goto('/studio')
    await expect(owner.page.getByRole('heading', { name: 'From script to finished scene.' })).toBeVisible({
      timeout: 15000,
    })
    const workspaceName = `Smoke studio ${Date.now()}`
    await owner.page.getByRole('button', { name: 'New workspace' }).click()
    await owner.page.getByPlaceholder('Studio workspace name').fill(workspaceName)
    await owner.page.getByRole('button', { name: 'Create workspace' }).click()
    await expect(owner.page.getByText('OWNER ACCESS')).toBeVisible()
    const projectName = `Smoke scene ${Date.now()}`
    await owner.page.getByPlaceholder('Project title').fill(projectName)
    await owner.page
      .getByPlaceholder('Brief synopsis for visual research')
      .fill('A quiet meeting at a station.')
    await owner.page
      .getByPlaceholder('Paste a short script to begin')
      .fill('INT. STATION - NIGHT. Ari waits beneath a clock.')
    await owner.page.getByRole('button', { name: 'Create project' }).click()
    await expect(owner.page.getByRole('heading', { name: projectName })).toBeVisible()
    await owner.page.getByRole('button', { name: 'Cast', exact: true }).click()
    await owner.page.getByRole('button', { name: 'Add character' }).click()
    await owner.page.locator('.is-card-body input').first().fill('Ari')
    await owner.page.getByRole('button', { name: 'Scenes', exact: true }).click()
    await owner.page.getByRole('button', { name: 'Add scene' }).click()
    await owner.page.locator('.is-card-body input').first().fill('Station platform')
    await owner.page.getByRole('button', { name: 'Shots', exact: true }).click()
    await owner.page.getByRole('button', { name: 'Add shot' }).click()
    await owner.page.locator('.is-shot-content > input').fill('Clock close-up')
    await owner.page.getByLabel('First-frame action').fill('Ari studies the station clock.')
    await owner.page.getByRole('button', { name: 'Save changes' }).click()
    await expect(owner.page.getByText('REV 2')).toBeVisible()
    await owner.page.reload()
    await expect(owner.page.getByRole('button', { name: projectName })).toBeVisible({ timeout: 15000 })
    await owner.page.getByRole('button', { name: projectName }).click()
    await expect(owner.page.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 15000 })
    await expect(owner.page.locator('textarea.is-script')).toHaveValue(
      'INT. STATION - NIGHT. Ari waits beneath a clock.',
    )
    await owner.page.getByRole('button', { name: 'Shots', exact: true }).click()
    await expect(owner.page.locator('.is-shot-content > input')).toHaveValue('Clock close-up')
    if (process.env.ILLUSTORY_SCREENSHOT_PATH) {
      await owner.page.screenshot({ path: process.env.ILLUSTORY_SCREENSHOT_PATH, fullPage: true })
    }
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
