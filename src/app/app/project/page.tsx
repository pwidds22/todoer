'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ProjectPageClient from './[id]/ProjectPageClient'

function ProjectFromQuery() {
  const id = useSearchParams().get('id')?.trim()

  if (!id || id === '_') {
    return <p className="max-w-3xl mx-auto p-6 text-sm text-muted-foreground">Choose a project from the sidebar.</p>
  }

  // Reset project-local forms and drafts when selecting a different project.
  return <ProjectPageClient key={id} id={id} />
}

export default function ProjectPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground" role="status">Loading project…</p>}>
      <ProjectFromQuery />
    </Suspense>
  )
}
