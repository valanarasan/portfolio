import { lazy, Suspense, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Atom, Check, Crosshair, Download, ExternalLink as Linkedin, Mail, MapPin, Menu, Sparkles, Volume2, VolumeX, X, Zap } from 'lucide-react'
import { forms as skillForms, experience } from './content'
import type { WatchPhase } from './WatchFace'
import './App.css'

const WatchFace = lazy(() => import('./WatchFace'))
const forms = skillForms.map(form => ({ ...form, logo: `${import.meta.env.BASE_URL}${form.logo.slice(1)}` }))

interface TransformationState { selected: number; preview: number; phase: WatchPhase; autoTransform: boolean }
type TransformationAction = { type: 'browse'; index: number } | { type: 'activate' | 'complete' }

function transformationReducer(state: TransformationState, action: TransformationAction): TransformationState {
  if (action.type === 'complete') {
    if (state.phase === 'opening') return { ...state, phase: state.autoTransform ? 'transforming' : 'selecting' }
    if (state.phase === 'transforming') return { ...state, selected: state.preview, phase: 'active', autoTransform: false }
    return state
  }
  if (state.phase === 'opening' || state.phase === 'transforming') return state
  if (action.type === 'browse') {
    const selected = (action.index + forms.length) % forms.length
    return { selected, preview: selected, phase: state.phase === 'idle' ? 'opening' : 'transforming', autoTransform: state.phase === 'idle' }
  }
  return { ...state, phase: state.phase === 'selecting' ? 'transforming' : 'opening' }
}

function App() {
  const [{ selected, preview, phase }, dispatch] = useReducer(transformationReducer, { selected: 0, preview: 0, phase: 'idle', autoTransform: false })
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const queuedCue = useRef<'transform' | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem('watch-sound') !== 'muted' } catch { return true }
  })
  const form = forms[selected]
  const previewForm = forms[preview]
  const busy = phase === 'opening' || phase === 'transforming'
  const nextForm = () => browse(preview + 1)
  const previousForm = () => browse(preview - 1)
  const status = { idle: 'WATCH STANDBY', opening: 'DIAL ACTIVATING', selecting: 'SKILL SELECTED', transforming: 'TRANSFORMING', active: 'SKILL ACTIVATED' }[phase]

  async function playCue(cue: 'activate' | 'select' | 'transform', following: 'transform' | null = null) {
    const player = audio.current
    queuedCue.current = null
    if (!soundEnabled || !player) return
    queuedCue.current = following
    player.pause()
    player.src = `${import.meta.env.BASE_URL}audio/${cue}.wav`
    player.volume = 0.65
    try {
      await player.play()
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setSoundEnabled(false)
    }
  }

  function browse(index: number) {
    if (busy || (phase === 'selecting' && index === preview)) return
    void playCue(phase === 'idle' ? 'activate' : 'transform', phase === 'idle' ? 'transform' : null)
    dispatch({ type: 'browse', index })
  }

  function activate() {
    if (busy) return
    void playCue(phase === 'selecting' ? 'transform' : 'activate')
    dispatch({ type: 'activate' })
  }

  useEffect(() => {
    if (!soundEnabled) {
      queuedCue.current = null
      audio.current?.pause()
    }
    try { localStorage.setItem('watch-sound', soundEnabled ? 'enabled' : 'muted') } catch { return }
  }, [soundEnabled])

  useEffect(() => {
    if (phase !== 'opening' && phase !== 'transforming') return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => dispatch({ type: 'complete' }), reduced ? 0 : phase === 'opening' ? 650 : 1000)
    return () => window.clearTimeout(timer)
  }, [phase])

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText('avalanarasan@gmail.com')
      setCopied(true)
    } catch {
      window.location.href = 'mailto:avalanarasan@gmail.com'
    }
  }

  return (
    <div className="portfolio" style={{ '--accent': form.color, '--accent-soft': form.soft, '--accent-ink': form.ink } as CSSProperties} data-form={form.id} data-phase={phase}>
      <audio ref={audio} preload="none" data-watch-audio onEnded={() => {
        const next = queuedCue.current
        queuedCue.current = null
        if (next) void playCue(next)
      }} />
      {phase === 'transforming' && <div className="transformation-wash" aria-hidden="true" />}
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="Valan Arasan home"><span className="brand-symbol"><Atom size={25} strokeWidth={2.2} /></span> VALAN<span className="brand-dot">.</span></a>
        <nav className={menuOpen ? 'navigation open' : 'navigation'} aria-label="Main navigation">
          <a href="#arsenal" onClick={() => setMenuOpen(false)}>The arsenal <span>01</span></a>
          <a href="#journey" onClick={() => setMenuOpen(false)}>My journey <span>02</span></a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>Let's talk <ArrowUpRight size={16} /></a>
        </nav>
        <div className="header-right"><span className="location"><span className="status-dot" /> Bangalore, IN</span><button className="icon-button" aria-label={soundEnabled ? 'Mute watch sounds' : 'Enable watch sounds'} title={soundEnabled ? 'Mute watch sounds' : 'Enable watch sounds'} aria-pressed={!soundEnabled} onClick={() => setSoundEnabled(current => !current)}>{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</button><button className="menu-button icon-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(current => !current)}>{menuOpen ? <X /> : <Menu />}</button></div>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-grid" aria-hidden="true" />
          <span className="edge-coordinate coordinate-top" aria-hidden="true">12.9716 N / 77.5946 E</span>
          <div className="scene-layer"><Suspense fallback={<div className="scene-loading"><Atom size={56} /><span>Initializing transformation...</span></div>}><WatchFace selected={preview} phase={phase} onActivate={activate} /></Suspense></div>
          <div className="hero-content">
            <div className="eyebrow"><span className="mini-cross">+</span> ONE ENGINEER. MULTIPLE FORMS.</div>
            <h1 id="hero-title">VALAN<br /><span>ARASAN</span><span className="name-period">.</span></h1>
            <div className="hero-role"><span /> Lead Frontend Engineer<br /><span className="role-second">& Senior Full Stack Developer</span></div>
            <p className="hero-description">Experience built before the AI coding boom.<br />AI agents + GitHub Copilot.<br /><strong className="highlight">A deadly combo.</strong></p>
            <div className="hero-actions"><a className="button button-dark" href="#arsenal">Explore my powers <ArrowDown size={17} /></a><a className="text-link resume-link" href={`${import.meta.env.BASE_URL}resume.html`} target="_blank" rel="noreferrer">Resume <Download size={16} /></a></div>
            <div className="hero-footnote"><span className="tiny-avatar">VA</span><span>Currently building at <strong>Thoughtworks</strong></span><ArrowUpRight size={14} /></div>
          </div>
          <div className="scene-marker"><Crosshair size={16} /><span>SKILL MATRIX <strong>ONLINE</strong></span></div>
          <div className="active-form-label" aria-live="polite"><span className="micro-label">ACTIVE SKILL / 0{preview + 1}</span><strong key={previewForm.id}>{previewForm.name}</strong><span>{previewForm.discipline}</span></div>
          <div className="dial-controls"><button className="icon-button" aria-label="Previous skill" title="Previous skill" onClick={previousForm} disabled={busy}><ArrowLeft size={19} /></button><span role="status"><span className="status-dot" /> {status}</span><button className="icon-button" aria-label="Next skill" title="Next skill" onClick={nextForm} disabled={busy}><ArrowRight size={19} /></button></div>
          <div className="hero-bottom-note"><span>HUMAN BY NATURE. ADAPTABLE BY DESIGN.</span><span>SCROLL TO DISCOVER <ArrowDown size={12} /></span></div>
        </section>
        <section className="form-selector" aria-label="Choose a skill">
          <div className="selector-intro"><Crosshair size={18} /><span>SELECT YOUR<br /><strong>SKILL</strong></span></div>
          <div className="form-buttons">{forms.map((item, index) => {
            return <button key={item.id} className={`form-button ${preview === index ? 'selected' : ''}`} aria-pressed={preview === index} disabled={busy} onClick={() => browse(index)}><span className="form-number">0{index + 1}</span><span className="framework-logo"><img src={item.logo} alt="" width={27} height={27} /></span><span className="form-button-text"><strong>{item.name}</strong><span>{item.shortLabel}</span></span><span className="selection-indicator">{preview === index ? <Zap size={12} fill="currentColor" /> : '+'}</span></button>
          })}</div>
        </section>
        <section id="arsenal" className="arsenal section-container" aria-labelledby="arsenal-title">
          <div className="section-heading"><div><div className="eyebrow"><span className="section-number">01</span> THE ARSENAL</div><h2 id="arsenal-title">Experience earned.<br /><span className="highlight">AI amplified.</span></h2></div><p>Engineering judgment built through real projects.<br />Accelerated by AI agents and GitHub Copilot.</p></div>
          <div className="power-detail" key={form.id} aria-live="polite">
            <div className="power-overview"><div className="power-heading"><span className="power-icon"><img src={form.logo} alt={`${form.name} logo`} width={31} height={31} /></span><span className="micro-label">SKILL 0{selected + 1} / {form.discipline.toUpperCase()}</span></div><h3>{form.headline}</h3><p>{form.description}</p><div className="skill-tags">{form.skills.map(skill => <span key={skill}>{skill}</span>)}</div></div>
            <div className="power-impact"><div className="micro-label"><Zap size={14} /> REAL-WORLD IMPACT</div><div className="impact-number">{form.metric}<span>{form.metricSuffix}</span></div><strong>{form.result}</strong><p>{form.evidence}</p><span className="impact-source">THOUGHTWORKS <ArrowUpRight size={16} /></span></div>
          </div>
          <div className="capability-footer"><span><Sparkles size={16} /> Human judgment. AI-assisted execution.</span><span>GitHub Copilot <span className="footer-separator">/</span> Claude <span className="footer-separator">/</span> Figma MCP</span></div>
        </section>
        <section id="journey" className="journey section-container" aria-labelledby="journey-title">
          <div className="section-heading"><div><div className="eyebrow"><span className="section-number">02</span> THE ORIGIN STORY</div><h2 id="journey-title">Built through experience.<br />Still <span className="highlight">evolving.</span></h2></div><span className="journey-badge"><span className="status-dot" /> 2021 - PRESENT</span></div>
          <div className="timeline">{experience.map((role, index) => <article key={role.title} className="timeline-item"><div className="timeline-date"><span>{role.dates}</span>{index === 0 && <span className="current-tag">CURRENT CHAPTER</span>}</div><div className="timeline-marker"><span /></div><div className="timeline-content"><div className="role-company">Thoughtworks <span>0{3 - index}</span></div><h3>{role.title}</h3><ul>{role.achievements.map(achievement => <li key={achievement}>{achievement}</li>)}</ul></div></article>)}</div>
          <div className="education"><span className="education-icon"><Atom size={27} /></span><div><span className="micro-label">WHERE IT STARTED / 2021</span><h3>B.E. Electronics & Communication Engineering</h3><p>Thiagarajar College of Engineering, Madurai</p></div><span className="gpa">8.12<span>/ 10 GPA</span></span></div>
        </section>
        <section id="contact" className="contact section-container" aria-labelledby="contact-title"><div className="contact-top"><div className="eyebrow"><span className="section-number">03</span> NEXT MISSION</div><span><MapPin size={14} /> BANGALORE, INDIA</span></div><div className="contact-main"><div><h2 id="contact-title">Great things start<br />with a <span>hello.</span></h2><p>Have a complex challenge or an ambitious idea?<br />Let's build something that makes a difference.</p></div><a className="contact-arrow" href="mailto:avalanarasan@gmail.com" aria-label="Email Valan Arasan"><ArrowUpRight size={68} strokeWidth={1.2} /></a></div><div className="contact-bottom"><a className="email-link" href="mailto:avalanarasan@gmail.com">avalanarasan@gmail.com</a><div className="contact-links"><button className="text-link" onClick={copyEmail}>{copied ? <Check size={16} /> : <Mail size={16} />}{copied ? 'Email copied' : 'Copy email'}</button><a href="https://www.linkedin.com/in/valan-arasan" target="_blank" rel="noreferrer"><Linkedin size={16} /> LinkedIn <ArrowUpRight size={14} /></a><a href="tel:+918760518029">Say hello <ArrowUpRight size={14} /></a></div></div></section>
      </main>
      <footer className="site-footer"><a className="brand" href="#"><span className="brand-symbol"><Atom size={19} /></span> VALAN.</a><span>Not all superpowers are fictional.</span><span>DESIGNED TO EVOLVE <Sparkles size={13} /></span></footer>
    </div>
  )
}

export default App
