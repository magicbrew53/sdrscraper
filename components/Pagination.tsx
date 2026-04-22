import Link from 'next/link'

interface Props {
  page: number
  totalPages: number
  searchParams: Record<string, string>
}

export default function Pagination({ page, totalPages, searchParams }: Props) {
  if (totalPages <= 1) return null

  const buildHref = (p: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(p))
    return `/results?${params.toString()}`
  }

  const pages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className="flex items-center gap-1 justify-center py-4">
      {page > 1 && (
        <Link href={buildHref(page - 1)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200">
          ←
        </Link>
      )}
      {start > 1 && (
        <>
          <Link href={buildHref(1)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200">1</Link>
          {start > 2 && <span className="text-gray-500 px-1">…</span>}
        </>
      )}
      {pages.map(p => (
        <Link
          key={p}
          href={buildHref(p)}
          className={`px-3 py-1 rounded text-sm ${
            p === page ? 'bg-purple-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
          }`}
        >
          {p}
        </Link>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-gray-500 px-1">…</span>}
          <Link href={buildHref(totalPages)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200">
            {totalPages}
          </Link>
        </>
      )}
      {page < totalPages && (
        <Link href={buildHref(page + 1)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-200">
          →
        </Link>
      )}
    </div>
  )
}