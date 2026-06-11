export async function generatePdf(html: string): Promise<Buffer> {
  const chromium = (await import('@sparticuz/chromium')).default
  const puppeteer = (await import('puppeteer-core')).default

  const customPath = process.env.PUPPETEER_EXECUTABLE_PATH

  const browser = await puppeteer.launch({
    args: customPath
      ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      : chromium.args,
    executablePath: customPath ?? (await chromium.executablePath()),
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'domcontentloaded' })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    })

    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
