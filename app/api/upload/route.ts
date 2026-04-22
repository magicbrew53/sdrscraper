import { NextRequest, NextResponse, after } from 'next/server'
import { sql, getDb, query } from '@/lib/db'
import { parseApolloCSVDetailed, type ParsedContact } from '@/lib/csv-parser'
import { classifyUpload } from '@/lib/classify'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const text = await file.text()
    const { contacts, mappedColumns, skippedRows } = parseApolloCSVDetailed(text)
    console.log(`[upload] ${contacts.length} contacts, ${skippedRows} skipped, mapped:`, mappedColumns)

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No valid contacts found in CSV' }, { status: 400 })
    }

    const [upload] = await sql`
      INSERT INTO uploads (filename, total_contacts, status)
      VALUES (${file.name}, ${contacts.length}, 'processing')
      RETURNING id
    `
    const uploadId = upload.id as string

    // Batch insert — 50 rows × 22 fields
    const FIELDS = 22
    const BATCH = 50
    const db = getDb()

    for (let i = 0; i < contacts.length; i += BATCH) {
      const chunk = contacts.slice(i, i + BATCH)
      const params: unknown[] = []
      const valueClauses: string[] = []

      chunk.forEach((c: ParsedContact, idx: number) => {
        const base = idx * FIELDS + 1
        valueClauses.push(
          `($${base},$${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11},$${base+12},$${base+13},$${base+14},$${base+15},$${base+16},$${base+17},$${base+18},$${base+19},$${base+20},$${base+21}::jsonb)`
        )
        params.push(
          uploadId, c.first_name, c.last_name, c.title, c.company_name,
          c.industry, c.keywords, c.email, c.email_status, c.work_phone,
          c.mobile_phone, c.corporate_phone, c.linkedin_url, c.website,
          c.company_linkedin_url, c.city, c.state, c.country,
          c.employee_count, c.seniority, c.departments,
          JSON.stringify(c.raw_apollo_data)
        )
      })

      await query(db,
        `INSERT INTO contacts (
          upload_id, first_name, last_name, title, company_name, industry, keywords,
          email, email_status, work_phone, mobile_phone, corporate_phone,
          linkedin_url, website, company_linkedin_url, city, state, country,
          employee_count, seniority, departments, raw_apollo_data
        ) VALUES ${valueClauses.join(',')}`,
        params
      )
    }

    // Duplicate detection — find new contacts whose email matches a prior upload
    const dupeRows = await query<{
      new_id: string
      existing_id: string
      existing_filename: string
    }>(db,
      `SELECT c_new.id AS new_id, c_old.id AS existing_id, u_old.filename AS existing_filename
       FROM contacts c_new
       JOIN contacts c_old ON c_new.email = c_old.email
         AND c_old.upload_id != $1
         AND c_new.email IS NOT NULL
       JOIN uploads u_old ON c_old.upload_id = u_old.id
       WHERE c_new.upload_id = $1`,
      [uploadId]
    )

    const duplicateCount = dupeRows.length

    if (duplicateCount > 0) {
      // Mark each duplicate individually
      for (const dupe of dupeRows) {
        await query(db,
          `UPDATE contacts SET
            is_duplicate = true,
            duplicate_of_id = $1,
            duplicate_upload_filename = $2
           WHERE id = $3`,
          [dupe.existing_id, dupe.existing_filename, dupe.new_id]
        )
      }
    }

    after(async () => {
      try {
        await classifyUpload(uploadId)
      } catch (err) {
        console.error('[upload] Classification error:', err)
        sql`UPDATE uploads SET status = 'failed' WHERE id = ${uploadId}`.catch(() => {})
      }
    })

    return NextResponse.json({
      uploadId,
      totalContacts: contacts.length,
      duplicateCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[upload] Error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}