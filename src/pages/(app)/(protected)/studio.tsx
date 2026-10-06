import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from 'deepspace'
import { Activity, ArrowLeft, Clapperboard, Film, Image as ImageIcon, Layers, LoaderCircle, Plus, RefreshCw, Save, Settings2, Sparkles, Users, X } from 'lucide-react'
import { action, assetObjectUrl } from '../../../illustory/client'
import { voiceText } from '../../../illustory/creative'
import { assetSlot, emptyStoryboard } from '../../../illustory/types'
import type { Asset, Character, Operation, Project, Row, Scene, Shot, Storyboard, VideoReference, WorkflowJob, Workspace, WorkspaceRole } from '../../../illustory/types'
import './studio.css'

type WorkspaceRow = Row<Workspace> & { role: WorkspaceRole }
type List<T> = { records: Row<T>[]; count: number }
type Stage = 'script' | 'cast' | 'scenes' | 'shots' | 'edit'
const stages: { id: Stage; label: string; icon: typeof Film }[] = [
  { id: 'script', label: 'Script & Storyboard', icon: Layers }, { id: 'cast', label: 'Cast', icon: Users },
  { id: 'scenes', label: 'Scenes', icon: ImageIcon }, { id: 'shots', label: 'Shots', icon: Clapperboard }, { id: 'edit', label: 'Edit & Export', icon: Film },
]
const newId = () => crypto.randomUUID()

function Media({ asset, label }: { asset?: Row<Asset>; label: string }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    if (!asset) { setUrl(''); return }
    if (asset.data.mimeType.startsWith('video/')) { setUrl(`/api/illustory/assets/${encodeURIComponent(asset.recordId)}/content`); return }
    let cancelled = false
    let current = ''
    assetObjectUrl(asset.recordId).then(u => { if (cancelled) URL.revokeObjectURL(u); else { current = u; setUrl(u) } }).catch(e => setError(String(e)))
    return () => { cancelled = true; if (current) URL.revokeObjectURL(current) }
  }, [asset?.recordId])
  if (!asset) return <div className="is-media-empty"><ImageIcon size={22} /><span>{label}</span></div>
  if (error) return <div className="is-media-empty">{error}</div>
  if (!url) return <div className="is-media-empty"><LoaderCircle className="animate-spin" size={18} /> Loading asset…</div>
  if (asset.data.mimeType.startsWith('audio/')) return <div className="is-audio"><strong>{label}</strong><audio src={url} controls /></div>
  return asset.data.mimeType.startsWith('video/')
    ? <video className="is-media" src={url} controls playsInline />
    : <img className="is-media" src={url} alt={label} />
}

export default function Studio() {
  const { userId } = useAuth()
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [workspaceId, setWorkspaceId] = useState('')
  const [projects, setProjects] = useState<Row<Project>[]>([])
  const [projectId, setProjectId] = useState('')
  const [project, setProject] = useState<Row<Project> | null>(null)
  const [assets, setAssets] = useState<Row<Asset>[]>([])
  const [jobs, setJobs] = useState<Row<WorkflowJob>[]>([])
  const [members, setMembers] = useState<Row<{ userId: string; role: WorkspaceRole; status: string }>[]>([])
  const [stage, setStage] = useState<Stage>('script')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftScript, setDraftScript] = useState('')
  const [draftBoard, setDraftBoard] = useState<Storyboard>(emptyStoryboard())
  const [dirty, setDirty] = useState(false)
  const [newWorkspace, setNewWorkspace] = useState('')
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newScript, setNewScript] = useState('')
  const [voiceChoices, setVoiceChoices] = useState<Array<{ id: string; name: string; previewUrl: string }>>([])
  const [voiceDrafts, setVoiceDrafts] = useState<Record<string, string>>({})
  const [references, setReferences] = useState<VideoReference[]>([])
  const [memberId, setMemberId] = useState('')
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('viewer')
  const [drawer, setDrawer] = useState<'activity' | 'members' | null>(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [billingAccess, setBillingAccess] = useState<{ userId: string; approved: boolean } | null>(null)
  const billingApproved = billingAccess?.userId === userId && billingAccess?.approved === true

  const activeWorkspace = workspaces.find(w => w.recordId === workspaceId)
  const role = activeWorkspace?.role
  const canEdit = role === 'owner' || role === 'editor'
  const canGenerate = role === 'owner' && billingApproved
  const voiceLine = (character: Character) => voiceDrafts[character.id] ?? voiceText(draftBoard, character)
  const revision = project?.data.revision
  const canReview = role === 'owner' || role === 'reviewer'
  const assetById = useMemo(() => new Map(assets.map(a => [a.recordId, a])), [assets])
  const currentAsset = (operation: Operation, targetId: string) => assetById.get(project?.data.currentAssets[assetSlot(operation, targetId)] ?? '')
  const activeJobs = jobs.filter(j => j.data.status === 'queued' || j.data.status === 'running')

  useEffect(() => {
    if (!drawer) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawer(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [drawer])

  const loadWorkspaces = useCallback(async () => {
    const rows = await action<WorkspaceRow[]>('listWorkspaces')
    setWorkspaces(rows)
    setWorkspaceId(previous => rows.some(w => w.recordId === previous) ? previous : rows[0]?.recordId ?? '')
  }, [])
  const loadProjects = useCallback(async (id: string) => {
    const result = await action<List<Project>>('listProjects', { workspaceId: id })
    setProjects(result.records)
  }, [])
  const loadProject = useCallback(async (id: string, syncDraft = false) => {
    const [p, a, j] = await Promise.all([
      action<Row<Project>>('getProject', { projectId: id }), action<List<Asset>>('listAssets', { projectId: id }), action<List<WorkflowJob>>('listJobs', { projectId: id }),
    ])
    setProject(p); setAssets(a.records); setJobs(j.records)
    if (syncDraft) { setDraftTitle(p.data.title); setDraftDescription(p.data.description ?? ''); setDraftScript(p.data.script); setDraftBoard(p.data.storyboard); setReferences(p.data.referenceCandidates ?? []); setDirty(false) }
    return p
  }, [])

  useEffect(() => { setSessionExpired(false); if (userId) loadWorkspaces().catch(e => setMessage(String(e))) }, [userId, loadWorkspaces])
  useEffect(() => {
    let cancelled = false
    setBillingAccess(null)
    if (userId) action<{ approved: boolean }>('getBillingAccess')
      .then(result => { if (!cancelled) setBillingAccess({ userId, approved: result.approved }) })
      .catch(e => { if (!cancelled) setMessage(String(e)) })
    return () => { cancelled = true }
  }, [userId])
  useEffect(() => { if (!workspaceId) return; loadProjects(workspaceId).catch(e => setMessage(String(e))); action<List<{ userId: string; role: WorkspaceRole; status: string }>>('listMembers', { workspaceId }).then(r => setMembers(r.records)).catch(() => {}) }, [workspaceId, loadProjects])
  useEffect(() => { if (!projectId) { setProject(null); return }; loadProject(projectId, true).catch(e => setMessage(String(e))) }, [projectId, loadProject])
  useEffect(() => { setVoiceDrafts({}) }, [projectId])
  useEffect(() => { if (revision != null) setMessage(previous => /^Saved revision \d+/.test(previous) && !previous.startsWith(`Saved revision ${revision}`) ? '' : previous) }, [revision])
  useEffect(() => {
    if (!projectId || !userId || sessionExpired) return
    const timer = setInterval(() => { loadProject(projectId).catch(e => {
      if (String(e).includes('Sign in to continue')) { setSessionExpired(true); setMessage('Your session is unavailable. Reload to sign in again.'); return }
      setMessage(String(e))
    }) }, 3000)
    return () => clearInterval(timer)
  }, [projectId, userId, sessionExpired, loadProject])
  useEffect(() => {
    if (!project || dirty) return
    setDraftTitle(project.data.title); setDraftDescription(project.data.description ?? ''); setDraftScript(project.data.script); setDraftBoard(project.data.storyboard); setReferences(project.data.referenceCandidates ?? [])
  }, [project?.data.revision, project?.recordId, dirty])

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label); setMessage('')
    try { await task() } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      if (detail.includes('Sign in to continue')) { setSessionExpired(true); setMessage('Your session is unavailable. Reload to sign in again.') }
      else setMessage(detail)
    }
    finally { setBusy('') }
  }
  async function createWorkspace() { await run('workspace', async () => { const w = await action<WorkspaceRow>('createWorkspace', { name: newWorkspace }); setNewWorkspace(''); setShowWorkspaceForm(false); await loadWorkspaces(); setWorkspaceId(w.recordId) }) }
  async function createProject() { await run('project', async () => { const p = await action<Row<Project>>('createProject', { workspaceId, title: newTitle, description: newDescription, script: newScript }); setNewTitle(''); setNewDescription(''); setNewScript(''); await loadProjects(workspaceId); setProjectId(p.recordId) }) }
  async function save() {
    if (!project) return
    await run('save', async () => {
      const p = await action<Row<Project>>('saveProject', { projectId, expectedRevision: project.data.revision, title: draftTitle, description: draftDescription, script: draftScript, storyboard: draftBoard })
      const selectionInvalidated = Object.keys(project.data.currentAssets).length > 0 && Object.keys(p.data.currentAssets).length === 0
      setProject(p); setDirty(false); setMessage(`Saved revision ${p.data.revision}${selectionInvalidated ? '. Creative changes cleared selected media; prior versions remain available.' : ''}`)
    })
  }
  async function generate(operation: Operation, targetId: string, options?: Record<string, unknown>) {
    if (!project) return
    await run(operation, async () => {
      const j = await action<Row<WorkflowJob>>('requestJob', { projectId, expectedRevision: project.data.revision, operation, targetId, idempotencyKey: newId(), options: options ?? {} })
      setMessage(`${operation} queued · job ${j.recordId}`); await loadProject(projectId)
    })
  }
  async function selectAsset(assetId: string) {
    await run('select', async () => { await action('selectAsset', { projectId, assetId }); await loadProject(projectId, true) })
  }
  async function cancel(jobId: string) { await run('cancel', async () => { await action('cancelJob', { jobId }); await loadProject(projectId) }) }
  async function resumeSaved(jobId: string) { await run('resume', async () => { await action('resumeSavedJob', { jobId }); setMessage('Saved media queued for verification without another generation call.'); await loadProject(projectId) }) }
  async function loadVoices() { await run('voices', async () => { setVoiceChoices(await action('listVoices', { projectId })); setMessage('Voice catalog loaded. Choose a voice for a character, then save.') }) }
  async function findReferences() { await run('references', async () => { setReferences(await action('searchReferences', { projectId })) }) }
  async function setExportNotice(enabled: boolean) { if (!project) return; await run('notification', async () => { const p = await action<Row<Project>>('setExportNotification', { projectId, enabled }); setProject(p) }) }
  function editBoard(board: Storyboard) { setDraftBoard(board); setDirty(true) }
  function changeCharacter(id: string, patch: Partial<Character>) {
    const before = draftBoard.characters.find(c => c.id === id)?.name
    const board = { ...draftBoard, characters: draftBoard.characters.map(c => c.id === id ? { ...c, ...patch, ...(patch.description === undefined ? {} : { personality: patch.description }) } : c) }
    if (before && patch.name && patch.name !== before) board.scenes = board.scenes.map(scene => ({ ...scene, shots: scene.shots.map(shot => ({ ...shot,
      speaker: shot.speaker === before ? patch.name : shot.speaker,
      beats: shot.beats?.map(beat => ({ ...beat, speaker: beat.speaker === before ? patch.name : beat.speaker })),
    })) }))
    editBoard(board)
  }
  function changeScene(id: string, patch: Partial<Scene>) { editBoard({ ...draftBoard, scenes: draftBoard.scenes.map(s => s.id === id ? { ...s, ...patch, ...(patch.description === undefined ? {} : { sceneVisualAnchor: patch.description }) } : s) }) }
  function changeShot(sceneId: string, shotId: string, patch: Partial<Shot>) { editBoard({ ...draftBoard, scenes: draftBoard.scenes.map(s => s.id === sceneId ? { ...s, shots: s.shots.map(q => q.id === shotId ? { ...q, ...patch, ...(patch.description === undefined ? {} : { action: patch.description }) } : q) } : s) }) }

  return <div className="is-studio">
    <aside className="is-sidebar">
      <div className="is-brand"><span className="is-brand-mark">I</span><div><strong>ILLUSTORY</strong><small>PRODUCTION STUDIO</small></div></div>
      <div className="is-sidebar-section"><label>WORKSPACE</label><select value={workspaceId} onChange={e => { setWorkspaceId(e.target.value); setProjectId(''); setDrawer(null) }}><option value="">Select workspace</option>{workspaces.map(w => <option key={w.recordId} value={w.recordId}>{w.data.name}</option>)}</select>{!showWorkspaceForm && <button className="is-quiet" onClick={() => setShowWorkspaceForm(true)}><Plus size={14} /> New workspace</button>}{workspaceId && role === 'owner' && <button className="is-quiet" onClick={() => setDrawer('members')}><Settings2 size={14} /> Workspace settings</button>}</div>
      {activeWorkspace && <div className="is-role">{role?.toUpperCase()} ACCESS</div>}
      <button className="is-side-action" onClick={() => setDrawer('activity')}><Activity size={15} /> Activity {activeJobs.length > 0 && <span>{activeJobs.length}</span>}</button>
      <div className="is-sidebar-section"><label>PROJECTS</label><div className="is-project-list">{projects.map(p => <button key={p.recordId} className={projectId === p.recordId ? 'active' : ''} onClick={() => setProjectId(p.recordId)}><Film size={15} />{p.data.title}</button>)}</div></div>
      {workspaceId && canEdit && <div className="is-create"><input placeholder="Project title" value={newTitle} onChange={e => setNewTitle(e.target.value)} /><textarea placeholder="Brief synopsis for visual research" value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} /><textarea placeholder="Paste a short script to begin" value={newScript} onChange={e => setNewScript(e.target.value)} rows={4} /><button disabled={!!busy || !newTitle.trim() || !newScript.trim()} onClick={createProject}><Plus size={15} /> Create project</button></div>}
      {showWorkspaceForm && <div className="is-create"><input placeholder="Studio workspace name" value={newWorkspace} onChange={e => setNewWorkspace(e.target.value)} /><button disabled={!!busy || !newWorkspace.trim()} onClick={createWorkspace}><Plus size={15} /> Create workspace</button><button className="is-quiet" onClick={() => { setShowWorkspaceForm(false); setNewWorkspace('') }}>Cancel</button></div>}
    </aside>
    <main className="is-main">
      {billingAccess?.userId === userId && !billingApproved && <div className="is-main-notice" role="status">You can create and edit your projects. AI generation, reference search and export require approval from the app owner. For review access, share your user ID from Settings with the app owner.</div>}
      {message && <div className="is-main-notice" role="status"><span>{message}</span>{sessionExpired && <button onClick={() => window.location.reload()}>Reload sign-in</button>}<button onClick={() => setMessage('')} aria-label="Dismiss notice"><X size={14} /></button></div>}
      {!project ? <div className="is-welcome"><div className="is-welcome-icon"><Sparkles size={28} /></div><p className="is-kicker">ILLUSTORY / STUDIO</p><h1>From script to finished scene.</h1><p>Choose a project or create one in your workspace. Every generation is a tracked job with a pinned input revision and a reviewable asset version.</p><div className="is-welcome-steps"><span>01 Script</span><span>02 Visual system</span><span>03 Motion</span><span>04 Export</span></div></div> : <>
        <header className="is-top"><div><button className="is-back" onClick={() => setProjectId('')}><ArrowLeft size={14} /> Projects</button><div className="is-title-line"><h1>{project.data.title}</h1><span>REV {project.data.revision}</span></div></div><div className="is-top-actions"><button onClick={() => setDrawer('activity')}><Activity size={15} /> Activity{activeJobs.length > 0 ? ` (${activeJobs.length})` : ''}</button><button onClick={() => loadProject(projectId, true)} title="Reload"><RefreshCw size={17} /></button>{canEdit && <button className="primary" disabled={!dirty || !!busy} onClick={save}><Save size={15} /> Save changes</button>}</div></header>
        <nav className="is-stage-tabs">{stages.map(s => <button key={s.id} className={stage === s.id ? 'active' : ''} onClick={() => setStage(s.id)}><s.icon size={16} />{s.label}</button>)}</nav>
        <div className="is-content">
          {stage === 'script' && <section className="is-panel">
            <div className="is-section-heading"><div><p className="is-kicker">01 / SOURCE</p><h2>Script & storyboard</h2></div>{canGenerate && <button className="is-action" disabled={!!busy || dirty} onClick={() => generate('parse', projectId)}><Sparkles size={15} /> Parse script</button>}</div>
            <p className="is-help">OpenAI converts a screenplay of up to 20,000 characters into editable film production data. Review every shot before generating media.</p>
            <label className="is-field-label">PROJECT TITLE</label><input value={draftTitle} disabled={!canEdit} onChange={e => { setDraftTitle(e.target.value); setDirty(true) }} />
            <label className="is-field-label">SYNOPSIS</label><textarea value={draftDescription} disabled={!canEdit} onChange={e => { setDraftDescription(e.target.value); setDirty(true) }} rows={2} placeholder="Used with the title for optional visual reference search" />
            {(draftBoard.title || draftBoard.chapter) && <div className="is-stat-row"><div><strong>{draftBoard.title}</strong><span>Parsed story title</span></div><div><strong>{draftBoard.chapter}</strong><span>Chapter</span></div></div>}
            <label className="is-field-label">SCRIPT</label><textarea className="is-script" value={draftScript} disabled={!canEdit} onChange={e => { setDraftScript(e.target.value); setDirty(true) }} placeholder="Paste your screenplay or scene draft" />
            <div className="is-stat-row"><div><strong>{draftBoard.characters.length}</strong><span>Characters</span></div><div><strong>{draftBoard.scenes.length}</strong><span>Scenes</span></div><div><strong>{draftBoard.scenes.reduce((n,s) => n+s.shots.length,0)}</strong><span>Shots</span></div></div>
            {canGenerate && <button className="is-action" disabled={!!busy || dirty} onClick={findReferences}>Find YouTube visual references</button>}
            {!!references.length && <div className="is-references"><h3>Reference research</h3><p className="is-help">Open a result to review it, then attach its link to a shot in the Shots tab. Search metadata is never treated as generated footage.</p>{references.map(ref => <a key={ref.url} href={ref.url} target="_blank" rel="noreferrer">{ref.title}</a>)}</div>}
          </section>}
          {stage === 'cast' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">02 / PEOPLE</p><h2>Cast</h2></div>{canEdit && <button className="is-action" onClick={() => editBoard({ ...draftBoard, characters: [...draftBoard.characters, { id: newId(), name: 'New character', description: '' }] })}><Plus size={15} /> Add character</button>}</div>
            {canGenerate && <button className="is-action" disabled={!!busy} onClick={loadVoices}>Load ElevenLabs voices</button>}
            <div className="is-card-grid">{draftBoard.characters.map(c => <article className="is-card" key={c.id}>
              <Media asset={currentAsset('character', c.id)} label="Character reference" />
              <div className="is-card-body"><input value={c.name} disabled={!canEdit} onChange={e => changeCharacter(c.id, { name: e.target.value })} />
                {canGenerate && <button className="is-action full" disabled={!!busy || dirty} onClick={() => generate('character', c.id)}><Sparkles size={14} /> Generate character image</button>}
                <label>English/source name<input value={c.nameEn ?? ''} disabled={!canEdit} onChange={e => changeCharacter(c.id, { nameEn: e.target.value })} /></label><label>Personality / visual archetype<textarea value={c.personality ?? c.description} disabled={!canEdit} onChange={e => changeCharacter(c.id, { description: e.target.value })} rows={3} /></label>
                <details><summary>Stable visual identity</summary>{['nationality', 'gender', 'age_range', 'hair', 'face', 'body', 'costume'].map(key => <label key={key}>{key.replace('_', ' ')}<input value={c.appearance?.[key] ?? ''} disabled={!canEdit} onChange={e => changeCharacter(c.id, { appearance: { ...c.appearance, [key]: e.target.value } })} /></label>)}</details>
                <VersionPicker assets={assets} operation="character" targetId={c.id} currentId={project.data.currentAssets[assetSlot('character', c.id)]} onSelect={selectAsset} canReview={canReview} />
                <label className="is-field-label">VOICE</label>
                <select value={c.voiceId ?? ''} disabled={!canEdit} onChange={e => changeCharacter(c.id, { voiceId: e.target.value })}><option value="">Select a catalog voice</option>{voiceChoices.map(v => <option value={v.id} key={v.id}>{v.name}</option>)}</select>
                {voiceChoices.find(v => v.id === c.voiceId)?.previewUrl && <a href={voiceChoices.find(v => v.id === c.voiceId)?.previewUrl} target="_blank" rel="noreferrer">Preview selected voice</a>}
                <label className="is-field-label">SAMPLE LINE</label>
                <textarea rows={2} maxLength={240} placeholder="Enter one line to preview this character's voice (max 240 characters)" value={voiceLine(c)} onChange={e => setVoiceDrafts(previous => ({ ...previous, [c.id]: e.target.value }))} />
                {canGenerate && <button className="is-action full" disabled={!!busy || dirty || !c.voiceId || !voiceLine(c).trim()} onClick={() => generate('voice', c.id, { text: voiceLine(c) })}>Generate voice reference</button>}
                <Media asset={currentAsset('voice', c.id)} label="Selected voice reference" />
                <VersionPicker assets={assets} operation="voice" targetId={c.id} currentId={project.data.currentAssets[assetSlot('voice', c.id)]} onSelect={selectAsset} canReview={canReview} />
              </div>
            </article>)}</div>{!draftBoard.characters.length && <Empty text="Parse a script or add your first character." />}</section>}
          {stage === 'scenes' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">03 / WORLD</p><h2>Scene anchors</h2></div>{canEdit && <button className="is-action" onClick={() => editBoard({ ...draftBoard, scenes: [...draftBoard.scenes, { id: newId(), title: 'New scene', description: '', shots: [] }] })}><Plus size={15} /> Add scene</button>}</div><div className="is-card-grid">{draftBoard.scenes.map(s => <article className="is-card" key={s.id}><Media asset={currentAsset('scene-anchor', s.id)} label="Scene anchor" /><div className="is-card-body"><input value={s.title} disabled={!canEdit} onChange={e => changeScene(s.id, { title: e.target.value })} /><textarea value={s.description} disabled={!canEdit} onChange={e => changeScene(s.id, { description: e.target.value })} placeholder="Location and visual continuity" rows={3} /><small>{s.shots.length} shots</small><VersionPicker assets={assets} operation="scene-anchor" targetId={s.id} currentId={project.data.currentAssets[assetSlot('scene-anchor', s.id)]} onSelect={selectAsset} canReview={canReview} />{canGenerate && <button className="is-action full" disabled={!!busy || dirty} onClick={() => generate('scene-anchor', s.id)}><Sparkles size={14} /> Generate anchor</button>}</div></article>)}</div>{!draftBoard.scenes.length && <Empty text="Parse a script or add a scene to start visual development." />}</section>}
          {stage === 'shots' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">04 / CAMERA</p><h2>Shots</h2></div></div>{draftBoard.scenes.map(s => <div key={s.id} className="is-scene-group"><div className="is-group-heading"><h3>{s.title}</h3>{canEdit && <button className="is-quiet" onClick={() => changeScene(s.id, { shots: [...s.shots, { id: newId(), title: `Shot ${s.shots.length + 1}`, description: '', durationSeconds: 5 }] })}><Plus size={14} /> Add shot</button>}</div>
            {s.shots.map(q => <article className="is-shot" key={q.id}><div className="is-shot-media"><Media asset={currentAsset('first-frame', q.id)} label="First frame" /></div><div className="is-shot-content">
              <input value={q.title} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { title: e.target.value })} />
              <label>First-frame action<textarea value={q.action ?? q.description} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { description: e.target.value })} rows={3} /></label>
              <label>Location<input value={q.location ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { location: e.target.value })} /></label>
              <label>Time of day<input value={q.timeOfDay ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { timeOfDay: e.target.value })} /></label>
              <label>Visible environment<textarea value={q.environmentDetails ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { environmentDetails: e.target.value })} rows={2} /></label>
              <label>Duration <input type="number" min="3" max="15" value={q.durationSeconds} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { durationSeconds: Number(e.target.value) })} /> seconds</label>
              <label>Shot type <select value={q.shotType ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { shotType: e.target.value })}><option value="">Choose framing</option>{['close_up', 'medium_shot', 'wide_shot', 'extreme_wide'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
              <label>Camera angle <select value={q.cameraAngle ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { cameraAngle: e.target.value })}><option value="">Choose angle</option>{['three quarter angle', 'low angle looking up', 'high angle looking down'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              <label>Dialogue <textarea value={q.dialogue ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { dialogue: e.target.value })} rows={2} /></label>
              <label>Speaker<input value={q.speaker ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { speaker: e.target.value })} /></label>
              <label>Narration<textarea value={q.narration ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { narration: e.target.value })} rows={2} /></label>
              {!!q.beats?.length && <details><summary>Motion beats · {q.beats.length}</summary><small>Beat seconds must add up to shot duration ({q.durationSeconds}s).</small>{q.beats.map((b, i) => <div key={b.id} className="is-beat-editor"><label>Beat {i + 1} action<textarea value={b.description} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { beats: q.beats?.map((item, j) => j === i ? { ...item, description: e.target.value } : item) })} rows={2} /></label><label>Seconds<input type="number" min="1" max="15" value={b.durationSeconds} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { beats: q.beats?.map((item, j) => j === i ? { ...item, durationSeconds: Number(e.target.value) } : item) })} /></label><label>Speaker<input value={b.speaker ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { beats: q.beats?.map((item, j) => j === i ? { ...item, speaker: e.target.value } : item) })} /></label><label>Dialogue<input value={b.dialogue ?? ''} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { beats: q.beats?.map((item, j) => j === i ? { ...item, dialogue: e.target.value } : item) })} /></label></div>)}</details>}
              {!!q.emotions?.length && <details><summary>Character emotions · {q.emotions.length}</summary>{q.emotions.map((emotion, i) => <label key={i}>{draftBoard.characters.find(c => c.id === emotion.characterId)?.name ?? emotion.characterId}<select value={emotion.emotion} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { emotions: q.emotions?.map((item, j) => j === i ? { ...item, emotion: e.target.value as typeof item.emotion } : item) })}>{['tense', 'melancholy', 'fearful', 'determined', 'neutral'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}</details>}
              <div className="is-shot-characters"><small>Characters in shot</small>{draftBoard.characters.map(c => <label key={c.id}><input type="checkbox" disabled={!canEdit} checked={q.characters?.includes(c.id) ?? false} onChange={e => changeShot(s.id, q.id, { characters: e.target.checked ? [...(q.characters ?? []), c.id] : (q.characters ?? []).filter(id => id !== c.id) })} />{c.name}</label>)}</div>
              {!!references.length && <label>Visual reference <select value={q.referenceVideo?.url ?? ''} disabled={!canEdit} onChange={e => { const ref = references.find(r => r.url === e.target.value); changeShot(s.id, q.id, { referenceVideo: ref ? { title: ref.title, url: ref.url } : undefined }) }}><option value="">None</option>{references.map(ref => <option key={ref.url} value={ref.url}>{ref.title}</option>)}</select></label>}
              {q.referenceVideo && <a href={q.referenceVideo.url} target="_blank" rel="noreferrer">Open selected reference</a>}
              {!!q.beats?.length && <small>{q.beats.length} motion beat{q.beats.length === 1 ? '' : 's'} · {q.beats.map(b => b.description).join(' / ')}</small>}
              <VersionPicker assets={assets} operation="first-frame" targetId={q.id} currentId={project.data.currentAssets[assetSlot('first-frame', q.id)]} onSelect={selectAsset} canReview={canReview} />
              {canGenerate && <button className="is-action" disabled={!!busy || dirty} onClick={() => generate('first-frame', q.id)}><Sparkles size={14} /> Generate first frame</button>}
            </div></article>)}
          </div>)}{!draftBoard.scenes.length && <Empty text="Create a scene before adding shots." />}</section>}
          {stage === 'edit' && <section className="is-execution-overview"><div><p className="is-kicker">PRIVATE EXECUTION</p><h2>Video pipeline</h2><p>DeepSpace checks access, pins the selected inputs, and tracks each job. Your private engine runs the reference-conditioned first frame, Vast GPU / ComfyUI H3, optional SeedVR2, and FFmpeg export.</p></div><ol><li>First frame from selected visual references</li><li>H3 render on Vast GPU and ComfyUI</li><li>Optional SeedVR2 enhancement</li><li>FFmpeg cut from selected clip versions</li></ol><div className="is-execution-foot"><span>{jobs.some(j => ['h3', 'seedvr2', 'export'].includes(j.data.operation)) ? 'Open Activity for actual job IDs, phases, timings and output checksums.' : 'No video execution recorded yet. A real run is required to show timing and cost.'}</span><button onClick={() => setDrawer('activity')}>View execution jobs</button></div></section>}
          {stage === 'edit' && <div className="is-email-settings"><label><input type="checkbox" checked={!!project.data.notifyOnExport} disabled={!canGenerate || !!busy || dirty} onChange={e => setExportNotice(e.target.checked)} /> Email the workspace owner when export completes</label><p className="is-help">The workspace owner controls this setting. The message goes to the owner's account email, even when a reviewer requests the export. Export still succeeds if mail delivery fails.</p>{jobs.filter(j => j.data.operation === 'export' && j.data.notificationStatus && j.data.notificationStatus !== 'none').map(j => <small key={j.recordId}>Export {j.recordId.slice(0, 8)} · email {j.data.notificationStatus}{j.data.notificationStatus === 'failed' && j.data.notificationError ? ` · ${j.data.notificationError}` : ''}</small>)}</div>}
          {stage === 'edit' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">05 / DELIVERY</p><h2>Edit & export</h2></div>{canReview && billingApproved && <button className="is-action" disabled={!!busy || dirty} onClick={() => generate('export', projectId)}><Film size={15} /> Export film</button>}</div><p className="is-help">Choose a video version for each shot, set trims, save the edit, then request a private FFmpeg export.</p>{draftBoard.scenes.flatMap(s => s.shots.map(q => <article className="is-edit-shot" key={q.id}><div className="is-edit-preview"><Media asset={currentAsset('seedvr2', q.id) ?? currentAsset('h3', q.id)} label="Video not generated" /></div><div className="is-edit-controls"><h3>{s.title} / {q.title}</h3><p>{q.description}</p><div className="is-inline-actions">{canGenerate && <><button disabled={!!busy || dirty || !currentAsset('first-frame', q.id)} onClick={() => generate('h3', q.id)}><Sparkles size={14} /> Generate H3</button><button disabled={!!busy || dirty || !currentAsset('h3', q.id)} onClick={() => generate('seedvr2', q.id)}><Sparkles size={14} /> Enhance</button></>}</div><VersionPicker assets={assets} operation="h3" targetId={q.id} currentId={project.data.currentAssets[assetSlot('h3', q.id)]} onSelect={selectAsset} canReview={canReview} /><VersionPicker assets={assets} operation="seedvr2" targetId={q.id} currentId={project.data.currentAssets[assetSlot('seedvr2', q.id)]} onSelect={selectAsset} canReview={canReview} /><div className="is-trim"><label>Start trim <input type="number" min="0" step="0.1" value={q.trimStartSeconds ?? 0} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { trimStartSeconds: Number(e.target.value) })} /> s</label><label>End trim <input type="number" min="0" step="0.1" value={q.trimEndSeconds ?? 0} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { trimEndSeconds: Number(e.target.value) })} /> s</label></div></div></article>))}<div className="is-export"><h3>Final export</h3><Media asset={currentAsset('export', projectId)} label="No export yet" /><VersionPicker assets={assets} operation="export" targetId={projectId} currentId={project.data.currentAssets[assetSlot('export', projectId)]} onSelect={selectAsset} canReview={canReview} /></div></section>}
        </div>
      </>}
    </main>
    {drawer && <><button className="is-drawer-backdrop" aria-label="Close panel" onClick={() => setDrawer(null)} /><aside className="is-drawer" role="dialog" aria-modal="true" aria-label={drawer === 'activity' ? 'Activity' : 'Workspace settings'}><div className="is-drawer-head"><div><p className="is-kicker">{drawer === 'activity' ? 'PROJECT STATUS' : activeWorkspace?.data.name}</p><h2>{drawer === 'activity' ? 'Activity' : 'Workspace settings'}</h2></div><button onClick={() => setDrawer(null)} aria-label="Close panel"><X size={18} /></button></div>
      {drawer === 'activity' && <>{busy && <div className="is-running"><LoaderCircle className="animate-spin" size={15} /> Processing {busy}…</div>}{project ? <><div className="is-activity-section"><h3>Generation jobs <span>{jobs.length}</span></h3>{[...jobs].reverse().slice(0, 12).map(j => <div className="is-job" key={j.recordId}><div><strong>{j.data.operation}</strong><span className={`is-status ${j.data.status}`}>{j.data.status}</span></div><small>Input rev {j.data.inputRevision} · Output v{j.data.outputVersion || '—'}</small><small>ID {j.recordId.slice(0, 8)} · {['first-frame', 'h3', 'seedvr2', 'export'].includes(j.data.operation) ? (j.data.providerPhase === 'private_execution' ? 'Private engine running' : j.data.providerPhase || 'Awaiting private service') : `${Math.round(j.data.progress * 100)}%`}</small><JobEvidence job={j} assets={assets} />{j.data.error && <p className="is-job-error">{j.data.error}</p>}{canGenerate && (j.data.status === 'queued' || j.data.status === 'running') && <button className="is-quiet" onClick={() => cancel(j.recordId)}>Cancel</button>}{canGenerate && j.data.status === 'failed' && (j.data.catalogResult?.asset && j.data.inputRevision === project.data.revision ? <button className="is-quiet" onClick={() => resumeSaved(j.recordId)}>Resume saved media · no new generation</button> : <button className="is-quiet" onClick={() => generate(j.data.operation, j.data.targetId, j.data.request.options as Record<string, unknown>)}>Retry as new job</button>)}</div>)}{!jobs.length && <p className="is-muted">No generation jobs yet. Private execution evidence appears after a real job runs.</p>}</div><div className="is-activity-section"><h3>Assets <span>{assets.length}</span></h3><p className="is-muted">{activeJobs.length ? `${activeJobs.length} active request${activeJobs.length === 1 ? '' : 's'}` : 'All jobs settled'}</p></div></> : <div className="is-activity-section"><h3>Choose a project</h3><p className="is-muted">Project jobs and asset versions appear here.</p></div>}</>}
      {drawer === 'members' && workspaceId && role === 'owner' && <div className="is-activity-section"><h3>Members <span>{members.length}</span></h3><p className="is-muted">Only an owner can change roles. Ask the collaborator to sign in to this app once, then copy their DeepSpace user ID from Settings.</p>{members.map(m => <div className="is-member" key={m.recordId}><span>{m.data.userId === userId ? 'You' : m.data.userId.slice(0, 12)}</span><small>{m.data.role}</small></div>)}<label className="is-field-label">DEEPSPACE USER ID</label><input placeholder="DeepSpace user ID" value={memberId} onChange={e => setMemberId(e.target.value)} /><label className="is-field-label">ROLE</label><select value={memberRole} onChange={e => setMemberRole(e.target.value as WorkspaceRole)}>{(['editor','reviewer','viewer','owner'] as WorkspaceRole[]).map(r => <option key={r}>{r}</option>)}</select><button className="is-action full" disabled={!memberId.trim() || !!busy} onClick={() => run('member', async () => { await action('setMemberRole', { workspaceId, userId: memberId, role: memberRole }); setMemberId(''); const r = await action<List<{ userId: string; role: WorkspaceRole; status: string }>>('listMembers', { workspaceId }); setMembers(r.records) })}>Add or update member</button></div>}
    </aside></>}
  </div>
}

function Empty({ text }: { text: string }) { return <div className="is-empty"><Sparkles size={20} /><p>{text}</p></div> }
function JobEvidence({ job, assets }: { job: Row<WorkflowJob>; assets: Row<Asset>[] }) {
  const work = job.data
  if (!['first-frame', 'h3', 'seedvr2', 'export'].includes(work.operation)) return null
  const engine = { 'first-frame': 'Reference-conditioned image engine', h3: 'Vast GPU · ComfyUI / MiniMax H3', seedvr2: 'Vast GPU · SeedVR2', export: 'FFmpeg composition' }[work.operation as 'first-frame' | 'h3' | 'seedvr2' | 'export']
  const output = assets.find(asset => asset.recordId === work.outputAssetId)
  const elapsed = work.providerStartedAt && work.providerFinishedAt ? Math.max(0, Math.round(work.providerFinishedAt - work.providerStartedAt)) : null
  return <details className="is-job-evidence"><summary>Execution details</summary><dl>
    <dt>Engine path</dt><dd>{engine} · private service</dd>
    <dt>DeepSpace job</dt><dd><code>{job.recordId}</code></dd>
    <dt>Private job</dt><dd><code>{work.providerJobId || 'Awaiting submission'}</code></dd>
    <dt>Pinned input</dt><dd>Revision {work.inputRevision} · {work.targetType} {work.targetId}</dd>
    <dt>Private phase</dt><dd>{work.providerPhase === 'private_execution' ? 'Private engine running' : work.providerPhase || 'Awaiting response'}</dd>
    <dt>Execution time</dt><dd>{elapsed === null ? 'Not measured yet' : `${elapsed} seconds`}</dd>
    <dt>Output record</dt><dd>{work.status === 'stale' || work.status === 'cancelled' ? 'Not selected: input changed or job was cancelled' : output ? `Asset v${output.data.version} · ${output.data.byteSize.toLocaleString()} bytes` : work.outputVersion ? `Version ${work.outputVersion}` : 'No asset published'}</dd>
    {output && <><dt>SHA-256</dt><dd><code>{output.data.sha256}</code></dd></>}
  </dl><p>Phase and timing come from the private adapter. GPU utilization and provider cost require a real render and are not reported here.</p></details>
}
function VersionPicker({ assets, operation, targetId, currentId, canReview, onSelect }: { assets: Row<Asset>[]; operation: Operation; targetId: string; currentId?: string; canReview: boolean; onSelect: (id: string) => void }) {
  const versions = assets.filter(a => a.data.operation === operation && a.data.targetId === targetId).sort((a,b) => b.data.version - a.data.version)
  if (!versions.length) return <span className="is-muted">No versions</span>
  return <label className="is-version-label">{operation} version <select disabled={!canReview} value={currentId ?? ''} onChange={e => onSelect(e.target.value)}><option value="">Select version</option>{versions.map(a => <option key={a.recordId} value={a.recordId}>v{a.data.version} · input rev {a.data.inputRevision}</option>)}</select></label>
}
