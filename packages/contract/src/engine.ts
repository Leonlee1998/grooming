import type { ContractData } from './types.js'

type LoopItem = Record<string, unknown>

function renderLoop(template: string, tag: string, items: LoopItem[]): string {
  const re = new RegExp(
    `\\{\\{#${tag}\\}\\}([\\s\\S]*?)\\{\\{\\/${tag}\\}\\}`,
    'g',
  )
  return template.replace(re, (_, inner: string) =>
    items
      .map((item) =>
        inner.replace(/\{\{(\w+)\}\}/g, (__, key: string) =>
          String(item[key] ?? ''),
        ),
      )
      .join(''),
  )
}

function renderScalars(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = data[key]
    if (Array.isArray(value) || (value !== null && typeof value === 'object')) {
      return match
    }
    return String(value ?? '')
  })
}

export function fillTemplate(templateHtml: string, data: ContractData): string {
  let html = templateHtml

  html = renderLoop(html, 'services', data.services as unknown as LoopItem[])
  html = renderLoop(
    html,
    'customFields',
    data.customFields as unknown as LoopItem[],
  )
  html = renderScalars(html, data as unknown as Record<string, unknown>)

  return html
}
