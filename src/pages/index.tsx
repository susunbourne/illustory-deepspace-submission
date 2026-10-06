import { Link } from 'react-router-dom'
import { ArrowRight, Clapperboard, Layers, LockKeyhole, Sparkles } from 'lucide-react'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

export default function Landing() {
  return <><Seo {...seo} path="/" /><div data-testid="static-landing" className="min-h-screen bg-[#0b1016] text-[#e9eff3]">
    <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-[#293744] px-6 py-6"><div className="text-sm font-bold tracking-[.2em]">ILLUSTORY</div><Link to="/studio" className="flex items-center gap-2 rounded-md border border-[#546f83] px-4 py-2 text-xs text-[#c9e3f2]">Open studio <ArrowRight size={14}/></Link></header>
    <main className="mx-auto max-w-6xl px-6 py-24"><p className="text-xs font-semibold tracking-[.25em] text-[#9fc6dc]">A PRODUCTION CONTROL PLANE</p><h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.08] tracking-[-.06em] md:text-7xl">From a script to a finished scene, with every decision visible.</h1><p className="mt-7 max-w-2xl text-base leading-7 text-[#a8b8c4]">Structure a story, develop its visual world, generate motion and deliver a cut. Workspaces, revisions, asset versions and durable jobs keep the production traceable.</p><Link to="/studio" className="mt-9 inline-flex items-center gap-3 rounded-md bg-[#c8e3f2] px-6 py-3 text-sm font-semibold text-[#122532]">Enter the studio <ArrowRight size={17}/></Link>
      <div className="mt-24 grid gap-4 border-t border-[#293744] pt-7 md:grid-cols-3"><div className="rounded-lg border border-[#2d3c48] bg-[#131d26] p-6"><Layers className="text-[#b3d5e9]" size={24}/><h2 className="mt-5 text-lg font-semibold">Editorial structure</h2><p className="mt-2 text-sm leading-6 text-[#91a5b4]">Edit characters, scenes and shots before spending on generation.</p></div><div className="rounded-lg border border-[#2d3c48] bg-[#131d26] p-6"><Clapperboard className="text-[#b3d5e9]" size={24}/><h2 className="mt-5 text-lg font-semibold">Versioned production</h2><p className="mt-2 text-sm leading-6 text-[#91a5b4]">Every generated frame and clip has an input revision, output version and review choice.</p></div><div className="rounded-lg border border-[#2d3c48] bg-[#131d26] p-6"><LockKeyhole className="text-[#b3d5e9]" size={24}/><h2 className="mt-5 text-lg font-semibold">Private engine boundary</h2><p className="mt-2 text-sm leading-6 text-[#91a5b4]">DeepSpace hosts the app and job control; proprietary rendering runs through a protected external service.</p></div></div>
      <p className="mt-12 flex items-center gap-2 text-xs text-[#718898]"><Sparkles size={13}/> Live generation requires an authorized private workflow service.</p>
    </main>
  </div></>
}
