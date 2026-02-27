import ProjectPageClient from './ProjectPageClient'

export async function generateStaticParams() {
  // Placeholder for static export — a single shell page is generated
  // and client-side routing handles actual project IDs at runtime
  return [{ id: '_' }]
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectPageClient params={params} />
}
