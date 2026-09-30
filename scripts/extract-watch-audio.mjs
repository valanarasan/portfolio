import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import wavefile from 'wavefile'

const source = process.argv[2]
if (!source) throw new Error('Pass the path to the reference video.')

const temporary = mkdtempSync(join(tmpdir(), 'valan-watch-audio-'))
const output = fileURLToPath(new URL('../public/audio/', import.meta.url))
const cues = [
  { name: 'activate', start: 2.05, duration: 0.65 },
  { name: 'select', start: 3.44, duration: 0.32 },
  { name: 'transform', start: 9.24, duration: 1 },
]

try {
  const decoded = join(temporary, 'reference.wav')
  execFileSync('afconvert', ['-f', 'WAVE', '-d', 'LEI16', source, decoded])
  const input = new wavefile.WaveFile(readFileSync(decoded))
  const { numChannels, sampleRate } = input.fmt
  const samples = input.getSamples(true, Int16Array)
  mkdirSync(output, { recursive: true })
  for (const cue of cues) {
    const start = Math.floor(cue.start * sampleRate)
    const frames = Math.floor(cue.duration * sampleRate)
    if ((start + frames) * numChannels > samples.length) throw new Error(`${cue.name} exceeds source duration`)
    const mono = new Int16Array(frames)
    const fade = Math.floor(sampleRate * 0.008)
    for (let frame = 0; frame < frames; frame++) {
      let total = 0
      for (let channel = 0; channel < numChannels; channel++) total += samples[(start + frame) * numChannels + channel]
      const envelope = Math.min(1, frame / fade, (frames - 1 - frame) / fade)
      mono[frame] = Math.round(total / numChannels * envelope)
    }
    const wav = new wavefile.WaveFile()
    wav.fromScratch(1, sampleRate, '16', mono)
    writeFileSync(join(output, `${cue.name}.wav`), wav.toBuffer())
    console.log(`${cue.name}.wav: ${cue.duration}s, ${sampleRate}Hz, mono`)
  }
} finally {
  rmSync(temporary, { recursive: true, force: true })
}