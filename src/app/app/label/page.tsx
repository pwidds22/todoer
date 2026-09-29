'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import LabelPageClient from './[id]/LabelPageClient'

function LabelFromQuery() {
  const id = useSearchParams().get('id')?.trim()

  if (!id || id === '_') {
    return <p className="max-w-3xl mx-auto p-6 text-sm text-muted-foreground">Choose a label from the sidebar.</p>
  }

  return <LabelPageClient key={id} id={id} />
}

export default function LabelPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground" role="status">Loading label…</p>}>
      <LabelFromQuery />
    </Suspense>
  )
}
