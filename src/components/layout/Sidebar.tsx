'use client'

import { useProjects } from '@/hooks/useProjects'
import { useLabels } from '@/hooks/useLabels'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/stores/ui-store'
import { useTodayTasks } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Inbox, Sun, Calendar, CalendarDays, Target,
  Hash, Tag, BarChart3, Timer, Settings,
  Plus, ChevronDown, ChevronRight, LogOut,
  CircleDot, X, CheckSquare
} from 'lucide-react'
import { useState } from 'react'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { LabelForm } from '@/components/projects/LabelForm'

interface SidebarLinkProps {
  href: string
  icon: React.ReactNode
  label: string
  count?: number
  color?: string
  active?: boolean
}

function SidebarLink({ href, icon, label, count, active }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors group',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground'
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate flex-1">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: projects } = useProjects()
  const { data: labels } = useLabels()
  const { data: todayTasks } = useTodayTasks()
  const { signOut } = useAuth()
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
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-border flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-0 md:overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link href="/app/today" className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Todoer</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-sidebar-hover rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Main views */}
          <SidebarLink href="/app/inbox" icon={<Inbox className="h-4 w-4" />} label="Inbox" active={pathname === '/app/inbox'} />
          <SidebarLink href="/app/today" icon={<Sun className="h-4 w-4" />} label="Today" count={todayCount} active={pathname === '/app/today'} />
          <SidebarLink href="/app/upcoming" icon={<Calendar className="h-4 w-4" />} label="Upcoming" active={pathname === '/app/upcoming'} />
          <SidebarLink href="/app/calendar" icon={<CalendarDays className="h-4 w-4" />} label="Calendar" active={pathname === '/app/calendar'} />
          <SidebarLink href="/app/matrix" icon={<Target className="h-4 w-4" />} label="Matrix" active={pathname === '/app/matrix'} />

          <div className="h-px bg-border my-3" />

          {/* Projects */}
          <div>
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <span>Projects</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowProjectForm(true) }}
                  className="p-0.5 hover:bg-sidebar-hover rounded"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                {projectsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </div>
            </button>
            {projectsExpanded && (
              <div className="space-y-0.5 mt-1">
                {projects?.map((project) => (
                  <SidebarLink
                    key={project.id}
                    href={`/app/project/${project.id}`}
                    icon={
                      project.icon ? (
                        <span className="text-sm">{project.icon}</span>
                      ) : (
                        <Hash className="h-4 w-4" style={{ color: project.color || undefined }} />
                      )
                    }
                    label={project.name}
                    active={pathname === `/app/project/${project.id}`}
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
            <button
              onClick={() => setLabelsExpanded(!labelsExpanded)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <span>Labels</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowLabelForm(true) }}
                  className="p-0.5 hover:bg-sidebar-hover rounded"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                {labelsExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </div>
            </button>
            {labelsExpanded && (
              <div className="space-y-0.5 mt-1">
                {labels?.map((label) => (
                  <SidebarLink
                    key={label.id}
                    href={`/app/label/${label.id}`}
                    icon={<CircleDot className="h-4 w-4" style={{ color: label.color || undefined }} />}
                    label={label.name}
                    active={pathname === `/app/label/${label.id}`}
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
