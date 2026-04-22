export interface ParsedContact {
  first_name: string | null
  last_name: string | null
  title: string | null
  company_name: string | null
  industry: string | null
  keywords: string | null
  email: string | null
  email_status: string | null
  work_phone: string | null
  mobile_phone: string | null
  corporate_phone: string | null
  linkedin_url: string | null
  website: string | null
  company_linkedin_url: string | null
  city: string | null
  state: string | null
  country: string | null
  employee_count: string | null
  seniority: string | null
  departments: string | null
  raw_apollo_data: Record<string, string>
}

// All candidates lowercase — matched case-insensitively
const COLUMN_MAP: Record<string, string[]> = {
  first_name: ['first name'],
  last_name: ['last name'],
  title: ['title', 'job title'],
  company_name: ['company name', 'company', 'account name'],
  industry: ['industry'],
  keywords: ['keywords', 'person keywords'],
  email: ['email', 'email address'],
  email_status: ['email status'],
  work_phone: ['work direct phone', 'work phone', 'direct phone'],
  mobile_phone: ['mobile phone', 'mobile'],
  corporate_phone: ['corporate phone', 'company phone'],
  linkedin_url: ['person linkedin url', 'linkedin url', 'person linkedin', 'linkedin'],
  website: ['website', 'company website'],
  company_linkedin_url: ['company linkedin url', 'company linkedin'],
  city: ['city'],
  state: ['state', 'province'],
  country: ['country'],
  employee_count: ['# employees', 'employees', 'number of employees', 'employee count'],
  seniority: ['seniority'],
  departments: ['departments', 'department'],
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const lower = headers.map(h => h.toLowerCase().trim())
  for (const candidate of candidates) {
    const idx = lower.findIndex(h => h === candidate)
    if (idx !== -1) return headers[idx]
  }
  return null
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export interface ParseResult {
  contacts: ParsedContact[]
  mappedColumns: Record<string, string>
  unmappedColumns: string[]
  skippedRows: number
}

export function parseApolloCSV(csvText: string): ParsedContact[] {
  return parseApolloCSVDetailed(csvText).contacts
}

export function parseApolloCSVDetailed(csvText: string): ParseResult {
  // Strip BOM
  const text = csvText.replace(/^\uFEFF/, '')
  // Split lines, keep lines that have at least one non-comma character
  const allLines = text.split(/\r?\n/)
  const lines = allLines.filter(l => l.replace(/,/g, '').trim().length > 0)

  if (lines.length < 2) return { contacts: [], mappedColumns: {}, unmappedColumns: [], skippedRows: 0 }

  const headers = parseCSVLine(lines[0])

  // Log actual headers for debugging
  console.log('[csv-parser] Headers found:', headers.slice(0, 30))

  // Build field → actual column header mapping
  const fieldMap: Record<string, string | null> = {}
  const mappedColumns: Record<string, string> = {}
  for (const [field, candidates] of Object.entries(COLUMN_MAP)) {
    const col = findColumn(headers, candidates)
    fieldMap[field] = col
    if (col) {
      mappedColumns[field] = col
    } else {
      console.warn(`[csv-parser] No column matched for field "${field}". Tried: ${candidates.join(', ')}`)
    }
  }

  const unmappedColumns = headers.filter(
    h => !Object.values(mappedColumns).includes(h)
  )

  const contacts: ParsedContact[] = []
  let skippedRows = 0

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])

    // Skip rows that are entirely empty values
    if (values.every(v => !v.trim())) {
      skippedRows++
      continue
    }

    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim()
    })

    const get = (field: string): string | null => {
      const col = fieldMap[field]
      if (!col) return null
      const val = row[col]?.trim()
      return val || null
    }

    const firstName = get('first_name')
    const lastName = get('last_name')

    // Skip rows with no name at all
    if (!firstName && !lastName) {
      skippedRows++
      continue
    }

    contacts.push({
      first_name: firstName,
      last_name: lastName,
      title: get('title'),
      company_name: get('company_name'),
      industry: get('industry'),
      keywords: get('keywords'),
      email: get('email'),
      email_status: get('email_status'),
      work_phone: get('work_phone'),
      mobile_phone: get('mobile_phone'),
      corporate_phone: get('corporate_phone'),
      linkedin_url: get('linkedin_url'),
      website: get('website'),
      company_linkedin_url: get('company_linkedin_url'),
      city: get('city'),
      state: get('state'),
      country: get('country'),
      employee_count: get('employee_count'),
      seniority: get('seniority'),
      departments: get('departments'),
      raw_apollo_data: row,
    })
  }

  console.log(`[csv-parser] Parsed ${contacts.length} contacts, skipped ${skippedRows} rows`)
  console.log('[csv-parser] Mapped fields:', Object.keys(mappedColumns).join(', '))

  return { contacts, mappedColumns, unmappedColumns, skippedRows }
}