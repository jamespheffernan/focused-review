import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../store'
import { getOrCreateSession, updateSession, advanceToStage } from '../repos/planningSessionsRepo'
import type { PlanningSessionDTO, ProjectDTO } from '../types'
import { db } from '../db'
import WizardHeader from '../components/planning-wizard/WizardHeader'
import WizardSidebar from '../components/planning-wizard/WizardSidebar'
import WizardContent from '../components/planning-wizard/WizardContent'

interface Props {
  projectId?: string
}

export default function PlanningWizardScreen({ projectId }: Props) {
  const { gotoQueue, queue } = useApp()
  const [session, setSession] = useState<PlanningSessionDTO | null>(null)
  const [projects, setProjects] = useState<ProjectDTO[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId || null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [collapsedStages, setCollapsedStages] = useState<Set<number>>(new Set())

  // Load projects
  useEffect(() => {
    const loadProjects = async () => {
      const allProjects = await db.projects.where('status').equals('active').toArray()
      setProjects(allProjects)
      
      // If projectId provided, use it; otherwise use queue if available
      if (projectId) {
        setSelectedProjectId(projectId)
      } else if (queue.length > 0 && !selectedProjectId) {
        setSelectedProjectId(queue[0].id)
      }
    }
    loadProjects()
  }, [projectId, queue, selectedProjectId])

  // Load or create session when project is selected
  useEffect(() => {
    const loadSession = async () => {
      if (!selectedProjectId) {
        setSession(null)
        setLoading(false)
        return
      }
      
      setLoading(true)
      const project = projects.find(p => p.id === selectedProjectId)
      if (!project) {
        setLoading(false)
        return
      }
      
      const planningSession = await getOrCreateSession(selectedProjectId, project.name)
      setSession(planningSession)
      
      // Collapse all completed stages by default
      setCollapsedStages(new Set(planningSession.completedStages))
      setLoading(false)
    }
    loadSession()
  }, [selectedProjectId, projects])

  // Auto-save handler
  const handleSessionUpdate = useCallback(async (updates: Partial<PlanningSessionDTO>) => {
    if (!session) return
    setSaving(true)
    await updateSession(session.id, updates)
    setSession(prev => prev ? { ...prev, ...updates, updatedAt: new Date().toISOString() } : null)
    setSaving(false)
  }, [session])

  // Stage navigation
  const handleStageChange = useCallback(async (stage: 1 | 2 | 3 | 4 | 5) => {
    if (!session) return
    await advanceToStage(session.id, stage)
    setSession(prev => prev ? { 
      ...prev, 
      currentStage: stage,
      completedStages: prev.currentStage < stage 
        ? [...new Set([...prev.completedStages, prev.currentStage])]
        : prev.completedStages
    } : null)
    
    // Collapse previous stage when advancing
    if (stage > 1) {
      setCollapsedStages(prev => new Set([...prev, stage - 1]))
    }
  }, [session])

  const toggleStageCollapsed = useCallback((stage: number) => {
    setCollapsedStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) {
        next.delete(stage)
      } else {
        next.add(stage)
      }
      return next
    })
  }, [])

  const scrollToStage = useCallback((stage: number) => {
    const element = document.getElementById(`planning-stage-${stage}`)
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="page" style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <WizardHeader
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectSelect={setSelectedProjectId}
        currentStage={session?.currentStage || 1}
        saving={saving}
        onBack={gotoQueue}
      />
      
      {/* Main content */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        overflow: 'hidden',
        gap: '0'
      }}>
        {/* Sidebar */}
        <WizardSidebar
          currentStage={session?.currentStage || 1}
          completedStages={session?.completedStages || []}
          onStageClick={scrollToStage}
        />
        
        {/* Content area */}
        <WizardContent
          session={session}
          loading={loading}
          collapsedStages={collapsedStages}
          onSessionUpdate={handleSessionUpdate}
          onStageChange={handleStageChange}
          onToggleCollapsed={toggleStageCollapsed}
        />
      </div>
    </div>
  )
}
