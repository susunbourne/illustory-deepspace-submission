/**
 * Example gated page. Reached at /settings — no auth logic lives here
 * because (protected)/_layout.tsx already wraps the subtree in <AuthGate>.
 */

import { useState } from 'react'
import { signOut, useAuth, useUser } from 'deepspace'
import { Button } from '@/components/ui'

export default function SettingsPage() {
  const { user } = useUser()
  const { userId } = useAuth()
  const [copyStatus, setCopyStatus] = useState('')

  async function copyUserId() {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      setCopyStatus('Copied')
    } catch {
      setCopyStatus('Copy failed. Select the ID above to copy it.')
    }
  }

  return (
    // No background on page wrappers — pages render into whatever the app's
    // (app)/_layout provides (a plain background, or a raised panel), so they
    // stay transparent and inherit it.
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="mb-12 text-4xl font-bold tracking-tight">Settings</h1>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Your account</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user?.email ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">DeepSpace user ID</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2 text-foreground">
                <code className="select-all break-all rounded bg-muted px-2 py-1">{userId ?? '—'}</code>
                <Button variant="secondary" disabled={!userId} onClick={copyUserId}>Copy ID</Button>
              </dd>
              <p className="mt-1 text-xs text-muted-foreground">Share this ID with a workspace owner to join their workspace.</p>
              {copyStatus && <p role="status" className="mt-1 text-xs text-muted-foreground">{copyStatus}</p>}
            </div>
          </dl>

          <Button variant="secondary" className="mt-6" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>
      </div>
    </div>
  )
}
