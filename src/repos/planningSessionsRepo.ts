import { db } from '../db'
import type { PlanningSessionDTO, PlanningBrainstormItem, PlanningWorkstream, PlanningNextAction, PlanningSuccessCriterion } from '../types'

// Get or create a planning session for a project
export async function getOrCreateSession(projectId: string, projectName: string): Promise<PlanningSessionDTO> {
  // Check for existing session
  const existing = await db.planningSessions
    .where('projectId')
    .equals(projectId)
    .first()
  
  if (existing) {
    return existing
  }
  
  // Create new session
  const session: PlanningSessionDTO = {
    id: crypto.randomUUID(),
    projectId,
    projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    currentStage: 1,
    completedStages: [],
    purposeStatement: '',
    principles: [],
    visionDescription: '',
    successCriteria: [],
    brainstormItems: [],
    workstreams: [],
    unorganizedItemIds: [],
    nextActions: [],
    syncedToNotion: false              // Initialize as not synced
  }
  
  await db.planningSessions.add(session)
  return session
}

// Update session (generic update)
export async function updateSession(sessionId: string, updates: Partial<PlanningSessionDTO>): Promise<void> {
  await db.planningSessions.update(sessionId, {
    ...updates,
    updatedAt: new Date().toISOString()
  })
}

// Get session by ID
export async function getSession(sessionId: string): Promise<PlanningSessionDTO | undefined> {
  return db.planningSessions.get(sessionId)
}

// Get session by project ID
export async function getSessionByProject(projectId: string): Promise<PlanningSessionDTO | undefined> {
  return db.planningSessions
    .where('projectId')
    .equals(projectId)
    .first()
}

// Delete session
export async function deleteSession(sessionId: string): Promise<void> {
  await db.planningSessions.delete(sessionId)
}

// Stage-specific helpers

// Stage 1: Purpose
export async function updatePurpose(sessionId: string, statement: string, principles: string[]): Promise<void> {
  await updateSession(sessionId, { purposeStatement: statement, principles })
}

// Stage 2: Vision
export async function updateVision(sessionId: string, description: string, criteria: PlanningSuccessCriterion[]): Promise<void> {
  await updateSession(sessionId, { visionDescription: description, successCriteria: criteria })
}

// Stage 3: Brainstorm
export async function addBrainstormItem(sessionId: string, text: string, position: { x: number; y: number }): Promise<PlanningBrainstormItem> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  const item: PlanningBrainstormItem = {
    id: crypto.randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    organized: false,
    position
  }
  
  const updatedItems = [...session.brainstormItems, item]
  const updatedUnorganized = [...session.unorganizedItemIds, item.id]
  
  await updateSession(sessionId, { 
    brainstormItems: updatedItems,
    unorganizedItemIds: updatedUnorganized
  })
  
  return item
}

export async function updateBrainstormPosition(sessionId: string, itemId: string, position: { x: number; y: number }): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  const updatedItems = session.brainstormItems.map(item =>
    item.id === itemId ? { ...item, position } : item
  )
  
  await updateSession(sessionId, { brainstormItems: updatedItems })
}

export async function removeBrainstormItem(sessionId: string, itemId: string): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  const updatedItems = session.brainstormItems.filter(item => item.id !== itemId)
  const updatedUnorganized = session.unorganizedItemIds.filter(id => id !== itemId)
  const updatedWorkstreams = session.workstreams.map(ws => ({
    ...ws,
    itemIds: ws.itemIds.filter(id => id !== itemId)
  }))
  
  await updateSession(sessionId, { 
    brainstormItems: updatedItems,
    unorganizedItemIds: updatedUnorganized,
    workstreams: updatedWorkstreams
  })
}

// Stage 4: Organize
export async function addWorkstream(sessionId: string, name: string): Promise<PlanningWorkstream> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  const workstream: PlanningWorkstream = {
    id: crypto.randomUUID(),
    name,
    itemIds: [],
    order: session.workstreams.length
  }
  
  await updateSession(sessionId, { 
    workstreams: [...session.workstreams, workstream]
  })
  
  return workstream
}

export async function moveItemToWorkstream(sessionId: string, itemId: string, workstreamId: string): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  // Remove from unorganized
  const updatedUnorganized = session.unorganizedItemIds.filter(id => id !== itemId)
  
  // Remove from all workstreams first
  let updatedWorkstreams = session.workstreams.map(ws => ({
    ...ws,
    itemIds: ws.itemIds.filter(id => id !== itemId)
  }))
  
  // Add to target workstream
  updatedWorkstreams = updatedWorkstreams.map(ws =>
    ws.id === workstreamId
      ? { ...ws, itemIds: [...ws.itemIds, itemId] }
      : ws
  )
  
  // Mark item as organized
  const updatedItems = session.brainstormItems.map(item =>
    item.id === itemId ? { ...item, organized: true } : item
  )
  
  await updateSession(sessionId, {
    unorganizedItemIds: updatedUnorganized,
    workstreams: updatedWorkstreams,
    brainstormItems: updatedItems
  })
}

export async function moveItemToUnorganized(sessionId: string, itemId: string): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  // Remove from all workstreams
  const updatedWorkstreams = session.workstreams.map(ws => ({
    ...ws,
    itemIds: ws.itemIds.filter(id => id !== itemId)
  }))
  
  // Add to unorganized if not already there
  const updatedUnorganized = session.unorganizedItemIds.includes(itemId)
    ? session.unorganizedItemIds
    : [...session.unorganizedItemIds, itemId]
  
  // Mark item as not organized
  const updatedItems = session.brainstormItems.map(item =>
    item.id === itemId ? { ...item, organized: false } : item
  )
  
  await updateSession(sessionId, {
    unorganizedItemIds: updatedUnorganized,
    workstreams: updatedWorkstreams,
    brainstormItems: updatedItems
  })
}

// Stage 5: Next Actions
export async function addNextAction(sessionId: string, text: string, workstreamId: string | null, context: string | null): Promise<PlanningNextAction> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  const action: PlanningNextAction = {
    id: crypto.randomUUID(),
    text,
    workstreamId,
    context,
    completed: false,
    exportedToOmniFocus: false
  }
  
  await updateSession(sessionId, {
    nextActions: [...session.nextActions, action]
  })
  
  return action
}

export async function updateNextAction(sessionId: string, actionId: string, updates: Partial<PlanningNextAction>): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  const updatedActions = session.nextActions.map(action =>
    action.id === actionId ? { ...action, ...updates } : action
  )
  
  await updateSession(sessionId, { nextActions: updatedActions })
}

// Stage navigation
export async function advanceToStage(sessionId: string, stage: 1 | 2 | 3 | 4 | 5): Promise<void> {
  const session = await getSession(sessionId)
  if (!session) throw new Error('Session not found')
  
  const completedStages = session.currentStage < stage
    ? [...new Set([...session.completedStages, session.currentStage])]
    : session.completedStages
  
  await updateSession(sessionId, {
    currentStage: stage,
    completedStages
  })
}
