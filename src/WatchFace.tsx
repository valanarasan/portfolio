import { useEffect, useRef } from 'react'
import { forms } from './content'
import './WatchFace.css'

export type WatchPhase = 'idle' | 'opening' | 'selecting' | 'transforming' | 'active'

interface WatchFaceProps {
  selected: number
  phase: WatchPhase
  onActivate: () => void
}

function drawSkill(context: CanvasRenderingContext2D, selected: number, logo?: HTMLImageElement) {
  context.save()
  if (logo?.complete && logo.naturalWidth > 0) {
    const scale = 320 / Math.max(logo.naturalWidth, logo.naturalHeight)
    const width = logo.naturalWidth * scale
    const height = logo.naturalHeight * scale
    context.drawImage(logo, -width / 2, -height / 2 - 45, width, height)
  }
  context.fillStyle = '#172329'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '700 52px "DM Sans", sans-serif'
  context.fillText(forms[selected].name, 0, 195, 440)
  context.restore()
}

function circle(context: CanvasRenderingContext2D, radius: number, color: string) {
  context.fillStyle = color
  context.beginPath()
  context.arc(0, 0, radius, 0, Math.PI * 2)
  context.fill()
}

function emblem(context: CanvasRenderingContext2D, color: string, scale = 1) {
  context.save()
  context.scale(scale, scale)
  context.fillStyle = color
  context.fill(new Path2D('M-185 -191 L185 -191 L57 0 L185 191 L-185 191 L-57 0 Z'))
  context.restore()
}

function drawFace(context: CanvasRenderingContext2D, phase: WatchPhase, selected: number, progress: number, logo?: HTMLImageElement) {
  const green = forms[selected].color
  const easing = 1 - (1 - progress) ** 3
  context.clearRect(0, 0, 900, 900)
  context.save()
  context.translate(450, 450)
  const bezel = context.createLinearGradient(-400, -400, 400, 400)
  bezel.addColorStop(0, '#777e79')
  bezel.addColorStop(0.2, '#171b18')
  bezel.addColorStop(0.5, '#3c423d')
  bezel.addColorStop(0.8, '#090c09')
  bezel.addColorStop(1, '#5b625c')
  circle(context, 429, '#121712')
  context.fillStyle = bezel
  context.beginPath()
  context.arc(0, 0, 420, 0, Math.PI * 2)
  context.fill()
  circle(context, 392, '#080b08')
  for (let tick = 0; tick < 60; tick++) {
    context.save()
    context.rotate(tick * Math.PI / 30)
    context.fillStyle = tick % 5 === 0 ? '#b2bab1' : '#545c53'
    context.fillRect(-1.5, -410, 3, tick % 5 === 0 ? 13 : 6)
    context.restore()
  }
  circle(context, 376, green)
  circle(context, 368, '#10180b')
  context.save()
  context.beginPath()
  context.arc(0, 0, 356, 0, Math.PI * 2)
  context.clip()
  circle(context, 356, '#fafbfc')
  const reveal = phase === 'opening' ? easing : phase === 'idle' ? 0 : 1
  if (phase === 'selecting' || phase === 'opening' || phase === 'active') {
    context.save()
    context.translate(phase === 'selecting' ? (1 - easing) * 310 : 0, 12)
    context.globalAlpha = phase === 'opening' ? easing : Math.max(0.15, easing)
    drawSkill(context, selected, logo)
    context.restore()
  }
  if (reveal < 1) {
    context.save()
    context.rotate(easing * (phase === 'opening' ? Math.PI / 2 : 0))
    for (let blade = 0; blade < 4; blade++) {
      context.save()
      context.rotate(blade * Math.PI / 2)
      context.translate(reveal * 400, -reveal * 250)
      context.fillStyle = blade % 2 === 0 ? '#c3c8bd' : '#969e8f'
      context.fill(new Path2D('M0 0 L-370 -370 L370 -370 Z'))
      context.strokeStyle = '#080d06'
      context.lineWidth = 12
      context.stroke(new Path2D('M-370 -370 L0 0 L370 -370'))
      context.restore()
    }
    context.globalAlpha = 1 - reveal
    circle(context, 258, '#090e06')
    emblem(context, phase === 'active' ? forms[selected].color : green)
    context.restore()
  }
  if (phase === 'transforming') {
    circle(context, 356, '#080e05')
    context.save()
    context.rotate(easing * Math.PI * 2)
    emblem(context, green, 1 + Math.sin(progress * Math.PI) * 0.45)
    context.restore()
    const bloom = Math.max(0, Math.sin(Math.PI * progress))
    context.globalAlpha = bloom * 0.88
    circle(context, 356, forms[selected].soft)
    context.globalAlpha = 1
    context.strokeStyle = green
    context.lineWidth = 16 * (1 - progress)
    context.beginPath()
    context.arc(0, 0, 80 + easing * 340, 0, Math.PI * 2)
    context.stroke()
  }
  context.restore()
  for (let marker = 0; marker < 4; marker++) {
    context.save()
    context.rotate(marker * Math.PI / 2)
    context.fillStyle = green
    context.beginPath()
    context.arc(0, -380, 8, 0, Math.PI * 2)
    context.fill()
    context.restore()
  }
  context.restore()
}

export default function WatchFace({ selected, phase, onActivate }: WatchFaceProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const duration = phase === 'opening' ? 650 : phase === 'transforming' ? 1000 : 260
    const started = performance.now()
    let frame = 0
    let disposed = false
    const logo = new Image()
    const render = (now: number) => {
      if (disposed) return
      const progress = preference.matches ? 1 : Math.min(1, (now - started) / duration)
      drawFace(context, phase, selected, progress, logo)
      if (progress < 1) frame = requestAnimationFrame(render)
    }
    logo.onload = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(render)
    }
    logo.src = `${import.meta.env.BASE_URL}${forms[selected].logo.slice(1)}`
    frame = requestAnimationFrame(render)
    return () => { disposed = true; logo.onload = null; cancelAnimationFrame(frame) }
  }, [phase, selected])

  const busy = phase === 'opening' || phase === 'transforming'
  const label = phase === 'idle' ? 'Activate watch' : phase === 'selecting' ? `Activate ${forms[selected].name}` : phase === 'active' ? 'Choose another skill' : phase === 'opening' ? 'Opening watch' : 'Transformation in progress'
  return <div className="watch-stage" data-phase={phase}>
    <button className="watch-face-button" onClick={onActivate} disabled={busy} aria-label={label} title={label}>
      <canvas ref={canvas} width={900} height={900} aria-hidden="true" />
    </button>
  </div>
}