import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
  return neon(process.env.DATABASE_URL)
}

// Tagged-template wrapper for simple static queries
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  return getDb()(strings, ...values)
}

// Dynamic parameterized queries using the .query() method
export function query<T = Record<string, unknown>>(
  queryFn: NeonQueryFunction<false, false>,
  queryString: string,
  params: unknown[] = []
): Promise<T[]> {
  return queryFn.query(queryString, params) as Promise<T[]>
}