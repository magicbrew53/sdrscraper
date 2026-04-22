export interface SerperResult {
  title: string
  snippet: string
  link: string
}

export interface SerperResponse {
  organic: SerperResult[]
}

export async function serperSearch(query: string, num = 5): Promise<SerperResult[]> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) throw new Error('SERPER_API_KEY is not set')

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ q: query, num }),
  })

  if (!res.ok) {
    throw new Error(`Serper API error: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as SerperResponse
  return data.organic ?? []
}

export function formatResultsForPrompt(results: SerperResult[]): string {
  if (results.length === 0) return '(no results found)'
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.link}`)
    .join('\n\n')
}