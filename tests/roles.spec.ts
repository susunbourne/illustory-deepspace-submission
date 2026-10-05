import { test, expect } from 'deepspace/testing'

test('workspace roles see the appropriate production controls', async ({ users }) => {
  test.setTimeout(120_000)
  const [owner, editor, reviewer, viewer] = await users([
    'Illustory owner', 'Illustory editor', 'Illustory reviewer', 'Illustory viewer',
  ])
  for (const member of [owner, editor, reviewer, viewer]) {
    await member.page.goto('/studio')
    await expect(member.page.getByRole('heading', { name: 'From script to finished scene.' })).toBeVisible()
    if (!member.userId) throw new Error(`Missing DeepSpace user ID for ${member.name}`)
  }

  const workspace = `Role studio ${Date.now()}`
  const project = `Role scene ${Date.now()}`
  await owner.page.getByRole('button', { name: 'New workspace' }).click()
  await owner.page.getByPlaceholder('Studio workspace name').fill(workspace)
  await owner.page.getByRole('button', { name: 'Create workspace' }).click()
  await expect(owner.page.getByText('OWNER ACCESS')).toBeVisible()
  await owner.page.getByPlaceholder('Project title').fill(project)
  await owner.page.getByPlaceholder('Paste a short script to begin').fill('EXT. COURTYARD - DAY. Ari opens the gate.')
  await owner.page.getByRole('button', { name: 'Create project' }).click()
  await expect(owner.page.getByRole('heading', { name: project })).toBeVisible()

  for (const [member, role] of [[editor, 'editor'], [reviewer, 'reviewer'], [viewer, 'viewer']] as const) {
    await owner.page.getByPlaceholder('DeepSpace user ID').fill(member.userId!)
    await owner.page.locator('.is-activity select').selectOption(role)
    await owner.page.getByRole('button', { name: 'Add or update member' }).click()
    await expect(owner.page.locator('.is-member').filter({ hasText: member.userId!.slice(0, 12) })).toContainText(role)
  }

  for (const [member, role] of [[editor, 'EDITOR'], [reviewer, 'REVIEWER'], [viewer, 'VIEWER']] as const) {
    await member.page.reload()
    await expect(member.page.getByText(`${role} ACCESS`)).toBeVisible()
    await member.page.getByRole('button', { name: project }).click()
    await expect(member.page.getByRole('heading', { name: project })).toBeVisible()
  }

  await expect(editor.page.locator('textarea.is-script')).toBeEnabled()
  await expect(editor.page.getByRole('button', { name: 'Parse script' })).toHaveCount(0)
  await expect(reviewer.page.locator('textarea.is-script')).toBeDisabled()
  await expect(viewer.page.locator('textarea.is-script')).toBeDisabled()
  await reviewer.page.getByRole('button', { name: 'Edit & Export' }).click()
  await viewer.page.getByRole('button', { name: 'Edit & Export' }).click()
  await expect(reviewer.page.getByRole('button', { name: 'Export film' })).toBeVisible()
  await expect(viewer.page.getByRole('button', { name: 'Export film' })).toHaveCount(0)
})
