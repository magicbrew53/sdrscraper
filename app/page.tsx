import UploadForm from '@/components/UploadForm'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">MQS Lead Verifier</h1>
          <p className="text-xs text-gray-500">myQuest Skills · SDR Lead Classification</p>
        </div>
        <Link href="/results" className="text-sm text-purple-400 hover:text-purple-300">
          View Results →
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold">Upload Apollo CSV</h2>
            <p className="text-gray-400 text-sm">
              Upload a contact export from Apollo.io. Claude will classify each contact
              against MQS target niches.
            </p>
          </div>
          <UploadForm />
        </div>
      </div>
    </main>
  )
}