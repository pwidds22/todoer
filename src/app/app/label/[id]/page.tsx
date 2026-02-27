import LabelPageClient from './LabelPageClient'

export async function generateStaticParams() {
  // Placeholder for static export — a single shell page is generated
  // and client-side routing handles actual label IDs at runtime
  return [{ id: '_' }]
}

export default function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  return <LabelPageClient params={params} />
}
