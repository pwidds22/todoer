'use client'

import { useProjects } from '@/hooks/useProjects'
import { useLabels } from '@/hooks/useLabels'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui-store'
import { useTodayTasks } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Inbox, Sun, Calendar, CalendarDays, Target,
  Hash, Tag, BarChart3, Timer, Settings,
  Plus, ChevronDown, ChevronRight, LogOut,
  CircleDot, X, CheckSquare, Users, Search
} from 'lucide-react'
import { Suspense, useId, useState } from 'react'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { LabelForm } from '@/components/projects/LabelForm'

interface SidebarLinkProps {
  href: string
  icon: React.ReactNode
  label: string
  count?: number
  color?: string
  active?: boolean
  badge?: React.ReactNode
}

function closeMobileSidebar(event: React.MouseEvent<HTMLAnchorElement>) {
  if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
    window.matchMedia('(max-width: 767px)').matches) {
    useUIStore.getState().setSidebarOpen(false)
  }
}

function SidebarLink({ href, icon, label, count, active, badge }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      onClick={closeMobileSidebar}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors group',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground'
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {badge}
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </Link>
  )
}

export function Sidebar() {
  return <Suspense fallback={null}><SidebarContent /></Suspense>
}

function SidebarContent() {
  const pathname = usePathname()
  const selectedId = useSearchParams().get('id')
  const navigationId = useId()
  const { data: projects } = useProjects()
  const { data: labels } = useLabels()
  const { data: todayTasks } = useTodayTasks()
  const { signOut, user } = useAuth()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [labelsExpanded, setLabelsExpanded] = useState(true)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showLabelForm, setShowLabelForm] = useState(false)

  const todayCount = todayTasks?.length || 0

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        aria-label="Sidebar"
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-border flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : 'invisible -translate-x-full md:visible md:translate-x-0'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link href="/app/today" onClick={closeMobileSidebar} className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Todoer</span>
          </Link>
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-sidebar-hover rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Main views */}
          <SidebarLink href="/app/inbox" icon={<Inbox className="h-4 w-4" />} label="Inbox" active={pathname === '/app/inbox'} />
          <SidebarLink href="/app/today" icon={<Sun className="h-4 w-4" />} label="Today" count={todayCount} active={pathname === '/app/today'} />
          <SidebarLink href="/app/upcoming" icon={<Calendar className="h-4 w-4" />} label="Upcoming" active={pathname === '/app/upcoming'} />
          <SidebarLink href="/app/calendar" icon={<CalendarDays className="h-4 w-4" />} label="Calendar" active={pathname === '/app/calendar'} />
          <SidebarLink href="/app/matrix" icon={<Target className="h-4 w-4" />} label="Matrix" active={pathname === '/app/matrix'} />
          <SidebarLink href="/app/search" icon={<Search className="h-4 w-4" />} label="Search" active={pathname === '/app/search'} />

          <div className="h-px bg-border my-3" />

          {/* Projects */}
          <div>
            <div className="flex items-center gap-1 px-3 py-1.5">
              <button
                type="button"
                onClick={() => setProjectsExpanded(!projectsExpanded)}
                aria-expanded={projectsExpanded}
                aria-controls={`${navigationId}-projects`}
                className="flex flex-1 items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <span>Projects</span>
                {projectsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                aria-label="Add project"
                onClick={() => { setProjectsExpanded(true); setShowProjectForm(true) }}
                className="p-1 text-muted-foreground hover:bg-sidebar-hover hover:text-foreground rounded"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {projectsExpanded && (
              <div id={`${navigationId}-projects`} className="space-y-0.5 mt-1">
                {projects?.map((project) => (
                  <SidebarLink
                    key={project.id}
                    href={`/app/project?id=${encodeURIComponent(project.id)}`}
                    icon={
                      project.icon ? (
                        <span className="text-sm">{project.icon}</span>
                      ) : (
                        <Hash className="h-4 w-4" style={{ color: project.color || undefined }} />
                      )
                    }
                    label={project.name}
                    active={(pathname === '/app/project' || pathname === '/app/project/_') && selectedId === project.id}
                    badge={project.user_id !== user?.id ? (
                      <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                    ) : undefined}
                  />
                ))}
                {showProjectForm && (
                  <ProjectForm onClose={() => setShowProjectForm(false)} />
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-border my-3" />

          {/* Labels */}
          <div>
            <div className="flex items-center gap-1 px-3 py-1.5">
              <button
                type="button"
                onClick={() => setLabelsExpanded(!labelsExpanded)}
                aria-expanded={labelsExpanded}
                aria-controls={`${navigationId}-labels`}
                className="flex flex-1 items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
              >
                <span>Labels</span>
                {labelsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                aria-label="Add label"
                onClick={() => { setLabelsExpanded(true); setShowLabelForm(true) }}
                className="p-1 text-muted-foreground hover:bg-sidebar-hover hover:text-foreground rounded"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {labelsExpanded && (
              <div id={`${navigationId}-labels`} className="space-y-0.5 mt-1">
                {labels?.map((label) => (
                  <SidebarLink
                    key={label.id}
                    href={`/app/label?id=${encodeURIComponent(label.id)}`}
                    icon={<CircleDot className="h-4 w-4" style={{ color: label.color || undefined }} />}
                    label={label.name}
                    active={(pathname === '/app/label' || pathname === '/app/label/_') && selectedId === label.id}
                  />
                ))}
                {showLabelForm && (
                  <LabelForm onClose={() => setShowLabelForm(false)} />
                )}
              </div>
            )}
          </div>

          <div className="h-px bg-border my-3" />

          {/* Extras */}
          <SidebarLink href="/app/habits" icon={<Tag className="h-4 w-4" />} label="Habits" active={pathname === '/app/habits'} />
          <SidebarLink href="/app/focus" icon={<Timer className="h-4 w-4" />} label="Focus" active={pathname === '/app/focus'} />
          <SidebarLink href="/app/stats" icon={<BarChart3 className="h-4 w-4" />} label="Stats" active={pathname === '/app/stats'} />
          <SidebarLink href="/app/settings" icon={<Settings className="h-4 w-4" />} label="Settings" active={pathname === '/app/settings'} />
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-border">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-1.5 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
