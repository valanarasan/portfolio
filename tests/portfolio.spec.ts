import { expect, test, type Page } from '@playwright/test'
import { forms } from '../src/content'

for (const firstAction of ['Next skill', 'AWS skill button']) {
  test(`initial sound precedes transformation when starting with ${firstAction}`, async ({ page }) => {
    await page.goto('/')
    const audio = page.locator('audio[data-watch-audio]')
    await audio.evaluate(element => {
      element.dataset.played = '[]'
      element.addEventListener('playing', () => {
        const played: string[] = JSON.parse(element.dataset.played ?? '[]')
        element.dataset.played = JSON.stringify([...played, element.currentSrc.split('/').pop()])
      })
    })
    const control = firstAction === 'Next skill' ? page.getByRole('button', { name: firstAction, exact: true }) : page.locator('.form-buttons').getByRole('button', { name: /AWS/ })
    await control.click()
    await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'opening')
    await expect(page.locator('.portfolio')).toHaveAttribute('data-form', firstAction === 'Next skill' ? 'graphql' : 'aws')
    await expect.poll(() => audio.getAttribute('data-played')).toBe('["activate.wav"]')
    await expect.poll(() => audio.getAttribute('data-played')).toBe('["activate.wav","transform.wav"]')
    await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
  })
}

test('muting the initial sound cancels the queued transformation cue', async ({ page }) => {
  await page.goto('/')
  const audio = page.locator('audio[data-watch-audio]')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect(audio).toHaveAttribute('src', '/audio/activate.wav')
  await page.getByRole('button', { name: 'Mute watch sounds' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
  await expect(audio).toHaveAttribute('src', '/audio/activate.wav')
  expect(await audio.evaluate(element => element.paused)).toBe(true)
})

test('browsing immediately updates the skill content and theme without confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'transforming')
  await expect(page.locator('.transformation-wash')).toBeAttached()
  await expect(page.locator('audio[data-watch-audio]')).toHaveAttribute('src', '/audio/transform.wav')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', forms[1].id)
  await expect(page.locator('.power-overview h3')).toHaveText(forms[1].headline)
  expect(await page.locator('.portfolio').evaluate(element => getComputedStyle(element).getPropertyValue('--accent'))).toBe(forms[1].color)
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'transforming')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', forms[2].id)
  await page.getByRole('button', { name: 'Previous skill' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'transforming')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', forms[1].id)
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
})

async function canvasPixelCount(page: Page) {
  return page.locator('canvas').evaluate(canvas => {
    const context = canvas.getContext('2d')
    if (!context) return 0
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let visible = 0
    for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] > 0) visible++
    return visible
  })
}

test('all skills synchronize palette, selection, skills, and evidence', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.form-button-text strong')).toHaveText(['React.js', 'GraphQL', 'AWS', 'Python', '.NET'])
  for (const form of forms) {
    const control = page.locator('.form-buttons').getByRole('button', { name: new RegExp(form.name) })
    await control.click()
    await expect(control).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'transforming')
    await expect(page.locator('audio[data-watch-audio]')).toHaveAttribute('src', '/audio/transform.wav')
    await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
    await expect(page.locator('.portfolio')).toHaveAttribute('data-form', form.id)
    await expect(page.locator('.power-overview h3')).toHaveText(form.headline)
    await expect(page.locator('.power-impact > strong')).toHaveText(form.result)
    await expect(page.locator('.skill-tags')).toContainText(form.skills[0])
    expect(await page.locator('.portfolio').evaluate(element => getComputedStyle(element).getPropertyValue('--accent'))).toBe(form.color)
    const logo = page.getByRole('img', { name: `${form.name} logo`, exact: true })
    await expect(logo).toHaveAttribute('src', form.logo)
    await expect.poll(() => logo.evaluate(image => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0)).toBe(true)
    await expect.poll(() => page.locator('canvas').evaluate(canvas => {
      const pixels = canvas.getContext('2d')?.getImageData(300, 220, 300, 350).data
      if (!pixels) return 0
      let colored = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) - Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) > 40) colored++
      }
      return colored
    })).toBeGreaterThan(100)
    await page.locator('.watch-stage').screenshot({ path: testInfo.outputPath(`skill-${form.id}.png`) })
  }
  expect(errors).toEqual([])
})

test('arrow controls wrap and form selection works with a keyboard', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Previous skill' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', 'dotnet')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', 'react')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
  await page.locator('.form-buttons').getByRole('button', { name: /Python/ }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', 'python')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'transforming')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
  await page.locator('.form-buttons').getByRole('button', { name: /AWS/ }).focus()
  await page.keyboard.press('Space')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', 'aws')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'transforming')
})

test('watch automatically transforms when browsing skills', async ({ page }) => {
  await page.goto('/')
  await expect.poll(() => canvasPixelCount(page)).toBeGreaterThan(1000)
  const initial = await page.locator('canvas').evaluate(canvas => canvas.toDataURL())
  await page.getByRole('button', { name: 'Activate watch', exact: true }).click()
  await expect.poll(() => page.locator('canvas').evaluate(canvas => canvas.toDataURL())).not.toBe(initial)
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'selecting')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect(page.locator('.active-form-label strong')).toHaveText('GraphQL')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', 'graphql')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'transforming')
  await expect(page.getByRole('button', { name: 'Next skill' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /AWS/ })).toBeDisabled()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', 'graphql')
  await expect(page.getByRole('button', { name: 'Choose another skill' })).toBeEnabled()
})

for (const viewport of [{ width: 1440, height: 1000 }, { width: 1920, height: 1080 }, { width: 820, height: 1180 }, { width: 390, height: 844 }, { width: 320, height: 667 }]) {
  test(`responsive layout and visible canvas at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    await expect.poll(() => canvasPixelCount(page)).toBeGreaterThan(1000)
    const layout = await page.evaluate(() => {
      const hero = document.querySelector('.hero-content')?.getBoundingClientRect()
      const scene = document.querySelector('.scene-layer')?.getBoundingClientRect()
      const watch = document.querySelector('.watch-face-button')?.getBoundingClientRect()
      const controls = document.querySelector('.dial-controls')?.getBoundingClientRect()
      const label = document.querySelector('.active-form-label')?.getBoundingClientRect()
      const heroElement = document.querySelector('.hero')
      const ring = heroElement ? getComputedStyle(heroElement, '::after') : null
      const ringBottom = heroElement && ring ? heroElement.getBoundingClientRect().top + parseFloat(ring.top) + parseFloat(ring.height) + 21 : 0
      const selector = document.querySelector('.form-selector')?.getBoundingClientRect()
      return {
        centered: !!watch && !!controls && Math.abs(watch.x + watch.width / 2 - controls.x - controls.width / 2) < 2,
        watchFits: !!watch && !!scene && watch.top >= scene.top && watch.bottom <= scene.bottom,
        labelClearsWatch: !!watch && !!label && watch.bottom <= label.top,
        ringGap: label ? label.top - ringBottom : 0,
        labelClearsControls: !!label && !!controls && label.bottom <= controls.top,
        overflow: document.documentElement.scrollWidth > innerWidth,
        contentFits: !hero || !scene || (innerWidth > 760 ? hero.right <= scene.left + 120 : hero.bottom <= scene.top + 5),
        nextSectionVisible: !!selector && selector.top < innerHeight,
        clippedControls: [...document.querySelectorAll('.form-button')].filter(element => element.scrollWidth > element.clientWidth + 1).length,
      }
    })
    expect(layout.overflow).toBe(false)
    expect(layout.centered).toBe(true)
    expect(layout.watchFits).toBe(true)
    expect(layout.labelClearsWatch).toBe(true)
    expect(layout.ringGap).toBeGreaterThanOrEqual(16)
    expect(layout.labelClearsControls).toBe(true)
    expect(layout.contentFits).toBe(true)
    expect(layout.nextSectionVisible).toBe(true)
    expect(layout.clippedControls).toBe(0)
    await page.getByRole('button', { name: 'Next skill' }).click()
    await expect(page.getByRole('img', { name: 'GraphQL logo', exact: true })).toBeAttached()
    await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
    await page.screenshot({ path: testInfo.outputPath(`portfolio-${viewport.width}.png`), fullPage: true })
  })
}

test('mobile menu navigates and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('link', { name: /My journey/ }).click()
  await expect(page).toHaveURL(/#journey$/)
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
})

test('contact links and printable resume contain the supplied details', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: 'Copy email' }).click()
  await expect(page.getByRole('button', { name: 'Email copied' })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('avalanarasan@gmail.com')
  await expect(page.getByRole('link', { name: 'LinkedIn', exact: false })).toHaveAttribute('href', 'https://www.linkedin.com/in/valan-arasan')
  await expect(page.getByRole('link', { name: 'Resume', exact: true })).toHaveAttribute('href', '/resume.html')
  await page.goto('/resume.html')
  await expect(page.getByRole('heading', { name: 'VALAN ARASAN A' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible()
  await expect(page.locator('body')).toContainText('8.12 / 10')
  await expect(page.locator('body')).toContainText('06/2025 - Present')
})

test('reduced-motion preference preserves transformation controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', 'graphql')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
  expect(await page.locator('.active-form-label strong').evaluate(element => getComputedStyle(element).animationName)).toBe('none')
})

test('video sound cues play only after interaction and mute is persistent', async ({ page }) => {
  await page.goto('/')
  const audio = page.locator('audio[data-watch-audio]')
  expect(await audio.evaluate(element => element.paused && !element.getAttribute('src'))).toBe(true)
  await audio.evaluate(element => {
    element.dataset.played = '[]'
    element.addEventListener('playing', () => {
      const played: string[] = JSON.parse(element.dataset.played ?? '[]')
      element.dataset.played = JSON.stringify([...played, element.currentSrc.split('/').pop()])
    })
  })
  await page.getByRole('button', { name: 'Activate watch', exact: true }).click()
  await expect.poll(() => audio.getAttribute('data-played')).toContain('activate.wav')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect.poll(() => audio.getAttribute('data-played')).toContain('transform.wav')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect.poll(async () => {
    const played: string[] = JSON.parse(await audio.getAttribute('data-played') ?? '[]')
    return played.filter(cue => cue === 'transform.wav').length
  }).toBe(2)
  await page.getByRole('button', { name: 'Mute watch sounds' }).click()
  expect(await audio.evaluate(element => element.paused)).toBe(true)
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
  const played = await audio.getAttribute('data-played')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'transforming')
  await expect(page.locator('.portfolio')).toHaveAttribute('data-phase', 'active')
  expect(await audio.getAttribute('data-played')).toBe(played)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Enable watch sounds' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Enable watch sounds' }).click()
  await page.getByRole('button', { name: 'Activate watch', exact: true }).click()
  await expect.poll(() => audio.evaluate(element => !element.paused)).toBe(true)
})

test('an unavailable sound file does not block skill activation', async ({ page }) => {
  await page.route('**/audio/*.wav', route => route.abort())
  await page.goto('/')
  await page.getByRole('button', { name: 'Next skill' }).click()
  await expect(page.locator('.portfolio')).toHaveAttribute('data-form', 'graphql')
  await expect(page.getByRole('button', { name: 'Choose another skill' })).toBeEnabled()
})