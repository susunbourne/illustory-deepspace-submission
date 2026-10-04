import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from 'deepspace'
import { ArrowLeft, Clapperboard, Film, Image as ImageIcon, Layers, LoaderCircle, Plus, RefreshCw, Save, Sparkles, Users, X } from 'lucide-react'
import { action, assetObjectUrl } from '../../../illustory/client'
import { assetSlot, emptyStoryboard } from '../../../illustory/types'
import type { Asset, Character, Operation, Project, Row, Scene, Shot, Storyboard, WorkflowJob, Workspace, WorkspaceRole } from '../../../illustory/types'
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
  const [draftScript, setDraftScript] = useState('')
  const [draftBoard, setDraftBoard] = useState<Storyboard>(emptyStoryboard())
  const [dirty, setDirty] = useState(false)
  const [newWorkspace, setNewWorkspace] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newScript, setNewScript] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('viewer')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  const activeWorkspace = workspaces.find(w => w.recordId === workspaceId)
  const role = activeWorkspace?.role
  const canEdit = role === 'owner' || role === 'editor'
  const canGenerate = role === 'owner'
  const canReview = role === 'owner' || role === 'reviewer'
  const assetById = useMemo(() => new Map(assets.map(a => [a.recordId, a])), [assets])
  const currentAsset = (operation: Operation, targetId: string) => assetById.get(project?.data.currentAssets[assetSlot(operation, targetId)] ?? '')
  const activeJobs = jobs.filter(j => j.data.status === 'queued' || j.data.status === 'running')

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
    if (syncDraft) { setDraftTitle(p.data.title); setDraftScript(p.data.script); setDraftBoard(p.data.storyboard); setDirty(false) }
    return p
  }, [])

  useEffect(() => { if (userId) loadWorkspaces().catch(e => setMessage(String(e))) }, [userId, loadWorkspaces])
  useEffect(() => { if (!workspaceId) return; loadProjects(workspaceId).catch(e => setMessage(String(e))); action<List<{ userId: string; role: WorkspaceRole; status: string }>>('listMembers', { workspaceId }).then(r => setMembers(r.records)).catch(() => {}) }, [workspaceId, loadProjects])
  useEffect(() => { if (!projectId) { setProject(null); return }; loadProject(projectId, true).catch(e => setMessage(String(e))) }, [projectId, loadProject])
  useEffect(() => {
    if (!projectId) return
    const timer = setInterval(() => { loadProject(projectId).catch(e => setMessage(String(e))) }, 3000)
    return () => clearInterval(timer)
  }, [projectId, loadProject])
  useEffect(() => {
    if (!project || dirty) return
    setDraftTitle(project.data.title); setDraftScript(project.data.script); setDraftBoard(project.data.storyboard)
  }, [project?.data.revision, project?.recordId, dirty])

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label); setMessage('')
    try { await task() } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { setBusy('') }
  }
  async function createWorkspace() { await run('workspace', async () => { const w = await action<WorkspaceRow>('createWorkspace', { name: newWorkspace }); setNewWorkspace(''); await loadWorkspaces(); setWorkspaceId(w.recordId) }) }
  async function createProject() { await run('project', async () => { const p = await action<Row<Project>>('createProject', { workspaceId, title: newTitle, script: newScript }); setNewTitle(''); setNewScript(''); await loadProjects(workspaceId); setProjectId(p.recordId) }) }
  async function save() {
    if (!project) return
    await run('save', async () => {
      const p = await action<Row<Project>>('saveProject', { projectId, expectedRevision: project.data.revision, title: draftTitle, script: draftScript, storyboard: draftBoard })
      setProject(p); setDirty(false); setMessage('Saved revision ' + p.data.revision)
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
  function editBoard(board: Storyboard) { setDraftBoard(board); setDirty(true) }
  function changeCharacter(id: string, patch: Partial<Character>) { editBoard({ ...draftBoard, characters: draftBoard.characters.map(c => c.id === id ? { ...c, ...patch } : c) }) }
  function changeScene(id: string, patch: Partial<Scene>) { editBoard({ ...draftBoard, scenes: draftBoard.scenes.map(s => s.id === id ? { ...s, ...patch } : s) }) }
  function changeShot(sceneId: string, shotId: string, patch: Partial<Shot>) { editBoard({ ...draftBoard, scenes: draftBoard.scenes.map(s => s.id === sceneId ? { ...s, shots: s.shots.map(q => q.id === shotId ? { ...q, ...patch } : q) } : s) }) }

  return <div className="is-studio">
    <aside className="is-sidebar">
      <div className="is-brand"><span className="is-brand-mark">I<span>.</span></span><div><strong>ILLUSTORY</strong><small>PRODUCTION STUDIO</small></div></div>
      <div className="is-sidebar-section"><label>WORKSPACE</label><select value={workspaceId} onChange={e => { setWorkspaceId(e.target.value); setProjectId('') }}><option value="">Select workspace</option>{workspaces.map(w => <option key={w.recordId} value={w.recordId}>{w.data.name}</option>)}</select></div>
      {activeWorkspace && <div className="is-role">{role?.toUpperCase()} ACCESS</div>}
      <div className="is-sidebar-section"><label>PROJECTS</label><div className="is-project-list">{projects.map(p => <button key={p.recordId} className={projectId === p.recordId ? 'active' : ''} onClick={() => setProjectId(p.recordId)}><Film size={15} />{p.data.title}</button>)}</div></div>
      {workspaceId && canEdit && <div className="is-create"><input placeholder="Project title" value={newTitle} onChange={e => setNewTitle(e.target.value)} /><textarea placeholder="Paste a short script to begin" value={newScript} onChange={e => setNewScript(e.target.value)} rows={4} /><button disabled={!!busy || !newTitle.trim() || !newScript.trim()} onClick={createProject}><Plus size={15} /> Create project</button></div>}
      {!workspaceId && <div className="is-create"><input placeholder="Studio workspace name" value={newWorkspace} onChange={e => setNewWorkspace(e.target.value)} /><button disabled={!!busy || !newWorkspace.trim()} onClick={createWorkspace}><Plus size={15} /> Create workspace</button></div>}
      <div className="is-sidebar-footer">Private execution engine · DeepSpace control plane</div>
    </aside>
    <main className="is-main">
      {!project ? <div className="is-welcome"><div className="is-welcome-icon"><Sparkles size={28} /></div><p className="is-kicker">ILLUSTORY / STUDIO</p><h1>From script to finished scene.</h1><p>Choose a project or create one in your workspace. Every generation is a tracked job with a pinned input revision and a reviewable asset version.</p><div className="is-welcome-steps"><span>01 Script</span><span>02 Visual system</span><span>03 Motion</span><span>04 Export</span></div></div> : <>
        <header className="is-top"><div><button className="is-back" onClick={() => setProjectId('')}><ArrowLeft size={14} /> Projects</button><div className="is-title-line"><h1>{project.data.title}</h1><span>REV {project.data.revision}</span></div></div><div className="is-top-actions"><button onClick={() => loadProject(projectId, true)} title="Reload"><RefreshCw size={17} /></button>{canEdit && <button className="primary" disabled={!dirty || !!busy} onClick={save}><Save size={15} /> Save changes</button>}</div></header>
        <nav className="is-stage-tabs">{stages.map(s => <button key={s.id} className={stage === s.id ? 'active' : ''} onClick={() => setStage(s.id)}><s.icon size={16} />{s.label}</button>)}</nav>
        <div className="is-content">
          {stage === 'script' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">01 / SOURCE</p><h2>Script & storyboard</h2></div>{canGenerate && <button className="is-action" disabled={!!busy || dirty} onClick={() => generate('parse', projectId)}><Sparkles size={15} /> Parse script</button>}</div><p className="is-help">Parsing runs in the private workflow service. Review and edit the resulting structure before generating assets.</p><label className="is-field-label">PROJECT TITLE</label><input value={draftTitle} disabled={!canEdit} onChange={e => { setDraftTitle(e.target.value); setDirty(true) }} /><label className="is-field-label">SCRIPT</label><textarea className="is-script" value={draftScript} disabled={!canEdit} onChange={e => { setDraftScript(e.target.value); setDirty(true) }} placeholder="Paste your screenplay or scene draft" /><div className="is-stat-row"><div><strong>{draftBoard.characters.length}</strong><span>Characters</span></div><div><strong>{draftBoard.scenes.length}</strong><span>Scenes</span></div><div><strong>{draftBoard.scenes.reduce((n,s) => n+s.shots.length,0)}</strong><span>Shots</span></div></div></section>}
          {stage === 'cast' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">02 / PEOPLE</p><h2>Cast</h2></div>{canEdit && <button className="is-action" onClick={() => editBoard({ ...draftBoard, characters: [...draftBoard.characters, { id: newId(), name: 'New character', description: '' }] })}><Plus size={15} /> Add character</button>}</div><div className="is-card-grid">{draftBoard.characters.map(c => <article className="is-card" key={c.id}><Media asset={currentAsset('character', c.id)} label="Character reference" /><div className="is-card-body"><input value={c.name} disabled={!canEdit} onChange={e => changeCharacter(c.id, { name: e.target.value })} /><textarea value={c.description} disabled={!canEdit} onChange={e => changeCharacter(c.id, { description: e.target.value })} placeholder="Appearance and personality" rows={3} /><VersionPicker assets={assets} operation="character" targetId={c.id} currentId={project.data.currentAssets[assetSlot('character', c.id)]} onSelect={selectAsset} canReview={canReview} />{canGenerate && <button className="is-action full" disabled={!!busy || dirty} onClick={() => generate('character', c.id)}><Sparkles size={14} /> Generate reference</button>}</div></article>)}</div>{!draftBoard.characters.length && <Empty text="Parse a script or add your first character." />}</section>}
          {stage === 'scenes' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">03 / WORLD</p><h2>Scene anchors</h2></div>{canEdit && <button className="is-action" onClick={() => editBoard({ ...draftBoard, scenes: [...draftBoard.scenes, { id: newId(), title: 'New scene', description: '', shots: [] }] })}><Plus size={15} /> Add scene</button>}</div><div className="is-card-grid">{draftBoard.scenes.map(s => <article className="is-card" key={s.id}><Media asset={currentAsset('scene-anchor', s.id)} label="Scene anchor" /><div className="is-card-body"><input value={s.title} disabled={!canEdit} onChange={e => changeScene(s.id, { title: e.target.value })} /><textarea value={s.description} disabled={!canEdit} onChange={e => changeScene(s.id, { description: e.target.value })} placeholder="Location and visual continuity" rows={3} /><small>{s.shots.length} shots</small><VersionPicker assets={assets} operation="scene-anchor" targetId={s.id} currentId={project.data.currentAssets[assetSlot('scene-anchor', s.id)]} onSelect={selectAsset} canReview={canReview} />{canGenerate && <button className="is-action full" disabled={!!busy || dirty} onClick={() => generate('scene-anchor', s.id)}><Sparkles size={14} /> Generate anchor</button>}</div></article>)}</div>{!draftBoard.scenes.length && <Empty text="Parse a script or add a scene to start visual development." />}</section>}
          {stage === 'shots' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">04 / CAMERA</p><h2>Shots</h2></div></div>{draftBoard.scenes.map(s => <div key={s.id} className="is-scene-group"><div className="is-group-heading"><h3>{s.title}</h3>{canEdit && <button className="is-quiet" onClick={() => changeScene(s.id, { shots: [...s.shots, { id: newId(), title: `Shot ${s.shots.length + 1}`, description: '', durationSeconds: 5 }] })}><Plus size={14} /> Add shot</button>}</div>{s.shots.map(q => <article className="is-shot" key={q.id}><div className="is-shot-media"><Media asset={currentAsset('first-frame', q.id)} label="First frame" /></div><div className="is-shot-content"><input value={q.title} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { title: e.target.value })} /><textarea value={q.description} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { description: e.target.value })} placeholder="Action, camera movement, composition" rows={3} /><label>Duration <input type="number" min="3" max="15" value={q.durationSeconds} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { durationSeconds: Number(e.target.value) })} /> seconds</label><VersionPicker assets={assets} operation="first-frame" targetId={q.id} currentId={project.data.currentAssets[assetSlot('first-frame', q.id)]} onSelect={selectAsset} canReview={canReview} />{canGenerate && <button className="is-action" disabled={!!busy || dirty} onClick={() => generate('first-frame', q.id)}><Sparkles size={14} /> Generate first frame</button>}</div></article>)}</div>)}{!draftBoard.scenes.length && <Empty text="Create a scene before adding shots." />}</section>}
          {stage === 'edit' && <section className="is-panel"><div className="is-section-heading"><div><p className="is-kicker">05 / DELIVERY</p><h2>Edit & export</h2></div>{canReview && <button className="is-action" disabled={!!busy || dirty} onClick={() => generate('export', projectId)}><Film size={15} /> Export film</button>}</div><p className="is-help">Choose a video version for each shot, set trims, save the edit, then request a private FFmpeg export.</p>{draftBoard.scenes.flatMap(s => s.shots.map(q => <article className="is-edit-shot" key={q.id}><div className="is-edit-preview"><Media asset={currentAsset('seedvr2', q.id) ?? currentAsset('h3', q.id)} label="Video not generated" /></div><div className="is-edit-controls"><h3>{s.title} / {q.title}</h3><p>{q.description}</p><div className="is-inline-actions">{canGenerate && <><button disabled={!!busy || dirty || !currentAsset('first-frame', q.id)} onClick={() => generate('h3', q.id)}><Sparkles size={14} /> Generate H3</button><button disabled={!!busy || dirty || !currentAsset('h3', q.id)} onClick={() => generate('seedvr2', q.id)}><Sparkles size={14} /> Enhance</button></>}</div><VersionPicker assets={assets} operation="h3" targetId={q.id} currentId={project.data.currentAssets[assetSlot('h3', q.id)]} onSelect={selectAsset} canReview={canReview} /><VersionPicker assets={assets} operation="seedvr2" targetId={q.id} currentId={project.data.currentAssets[assetSlot('seedvr2', q.id)]} onSelect={selectAsset} canReview={canReview} /><div className="is-trim"><label>Start trim <input type="number" min="0" step="0.1" value={q.trimStartSeconds ?? 0} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { trimStartSeconds: Number(e.target.value) })} /> s</label><label>End trim <input type="number" min="0" step="0.1" value={q.trimEndSeconds ?? 0} disabled={!canEdit} onChange={e => changeShot(s.id, q.id, { trimEndSeconds: Number(e.target.value) })} /> s</label></div></div></article>))}<div className="is-export"><h3>Final export</h3><Media asset={currentAsset('export', projectId)} label="No export yet" /><VersionPicker assets={assets} operation="export" targetId={projectId} currentId={project.data.currentAssets[assetSlot('export', projectId)]} onSelect={selectAsset} canReview={canReview} /></div></section>}
        </div>
      </>}
    </main>
    <aside className="is-activity"><div className="is-activity-head"><div><p className="is-kicker">LIVE OPERATIONS</p><h2>Activity</h2></div><span className="is-live-dot" /></div>{message && <div className="is-notice"><button onClick={() => setMessage('')} aria-label="Dismiss"><X size={14} /></button>{message}</div>}{busy && <div className="is-running"><LoaderCircle className="animate-spin" size={15} /> Processing {busy}…</div>}{project ? <><div className="is-activity-section"><h3>Generation jobs <span>{jobs.length}</span></h3>{[...jobs].reverse().slice(0, 12).map(j => <div className="is-job" key={j.recordId}><div><strong>{j.data.operation}</strong><span className={`is-status ${j.data.status}`}>{j.data.status}</span></div><small>Input rev {j.data.inputRevision} · Output v{j.data.outputVersion || '—'}</small><small>ID {j.recordId.slice(0, 8)} · {Math.round(j.data.progress * 100)}%</small>{j.data.error && <p className="is-job-error">{j.data.error}</p>}{canGenerate && (j.data.status === 'queued' || j.data.status === 'running') && <button className="is-quiet" onClick={() => cancel(j.recordId)}>Cancel</button>}{canGenerate && j.data.status === 'failed' && <button className="is-quiet" onClick={() => generate(j.data.operation, j.data.targetId, j.data.request.options as Record<string, unknown>)}>Retry as new job</button>}</div>)}{!jobs.length && <p className="is-muted">No generation jobs yet.</p>}</div><div className="is-activity-section"><h3>Assets <span>{assets.length}</span></h3><p className="is-muted">{activeJobs.length ? `${activeJobs.length} active request${activeJobs.length === 1 ? '' : 's'}` : 'All jobs settled'}</p></div></> : <div className="is-activity-section"><h3>How it works</h3><p className="is-muted">Edits create a new revision. Generation uses a fixed snapshot. Stale or cancelled jobs cannot become the current asset.</p></div>}
      {workspaceId && role === 'owner' && <div className="is-activity-section"><h3>Members</h3>{members.map(m => <div className="is-member" key={m.recordId}><span>{m.data.userId === userId ? 'You' : m.data.userId.slice(0, 12)}</span><small>{m.data.role}</small></div>)}<input placeholder="DeepSpace user ID" value={memberId} onChange={e => setMemberId(e.target.value)} /><select value={memberRole} onChange={e => setMemberRole(e.target.value as WorkspaceRole)}>{(['editor','reviewer','viewer','owner'] as WorkspaceRole[]).map(r => <option key={r}>{r}</option>)}</select><button className="is-action full" disabled={!memberId.trim() || !!busy} onClick={() => run('member', async () => { await action('setMemberRole', { workspaceId, userId: memberId, role: memberRole }); setMemberId(''); const r = await action<List<{ userId: string; role: WorkspaceRole; status: string }>>('listMembers', { workspaceId }); setMembers(r.records) })}>Add or update member</button></div>}
    </aside>
  </div>
}

function Empty({ text }: { text: string }) { return <div className="is-empty"><Sparkles size={20} /><p>{text}</p></div> }
function VersionPicker({ assets, operation, targetId, currentId, canReview, onSelect }: { assets: Row<Asset>[]; operation: Operation; targetId: string; currentId?: string; canReview: boolean; onSelect: (id: string) => void }) {
  const versions = assets.filter(a => a.data.operation === operation && a.data.targetId === targetId).sort((a,b) => b.data.version - a.data.version)
  if (!versions.length) return <span className="is-muted">No versions</span>
  return <label className="is-version-label">{operation} version <select disabled={!canReview} value={currentId ?? ''} onChange={e => onSelect(e.target.value)}><option value="">Select version</option>{versions.map(a => <option key={a.recordId} value={a.recordId}>v{a.data.version} · input rev {a.data.inputRevision}</option>)}</select></label>
}
