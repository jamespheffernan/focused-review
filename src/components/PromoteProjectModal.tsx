import { useState, useEffect } from 'react'
import { X, Sparkles, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { omnifocusBridge } from '../services/omnifocus-bridge'
import { parseNaturalDate, describeNaturalDate } from '../utils/date-parser'

interface SomedayItem {
  pageId: string
  name: string
  ofId: string | null
  note: string
  createdAt: string
  lastEditedAt: string
}

interface PromoteProjectModalProps {
  item: SomedayItem
  onComplete: () => void
  onCancel: () => void
}

export default function PromoteProjectModal({ item, onComplete, onCancel }: PromoteProjectModalProps) {
  const [projectName, setProjectName] = useState(item.name)
  const [nextAction, setNextAction] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Context/Tags state
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [availableTags, setAvailableTags] = useState<Array<{id: string; name: string}>>([])
  const [loadingTags, setLoadingTags] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [filteredTags, setFilteredTags] = useState<Array<{id: string; name: string}>>([])

  // Date state
  const [naturalDueDate, setNaturalDueDate] = useState('')
  const [naturalDeferDate, setNaturalDeferDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [deferDate, setDeferDate] = useState('')
  const [dueDatePreview, setDueDatePreview] = useState<string | null>(null)
  const [deferDatePreview, setDeferDatePreview] = useState<string | null>(null)
  const [showDueDatePicker, setShowDueDatePicker] = useState(false)
  const [showDeferDatePicker, setShowDeferDatePicker] = useState(false)

  // Fetch tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      setLoadingTags(true)
      try {
        const tags = await omnifocusBridge.getTags()
        setAvailableTags(tags)
        setFilteredTags(tags)
      } catch (error) {
        console.error('Failed to fetch tags:', error)
      } finally {
        setLoadingTags(false)
      }
    }
    fetchTags()
  }, [])

  // Focus the next action input when modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      const input = document.getElementById('next-action-input')
      if (input) {
        input.focus()
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Filter tags as user types
  useEffect(() => {
    const baseList = availableTags.filter(tag => 
      !selectedTags.some(selected => selected.toLowerCase() === tag.name.toLowerCase())
    )
    if (tagInput.trim() === '') {
      setFilteredTags(baseList)
    } else {
      const filtered = baseList.filter(tag =>
        tag.name.toLowerCase().includes(tagInput.toLowerCase())
      )
      setFilteredTags(filtered)
    }
  }, [tagInput, availableTags, selectedTags])

  // Handle natural language due date
  useEffect(() => {
    const trimmedText = naturalDueDate.trim()
    if (!trimmedText) {
      setDueDatePreview(null)
      return
    }
    setDueDatePreview(describeNaturalDate(trimmedText))
    const parsed = parseNaturalDate(trimmedText)
    if (parsed) {
      setDueDate(parsed)
    }
  }, [naturalDueDate])

  // Handle natural language defer date
  useEffect(() => {
    const trimmedText = naturalDeferDate.trim()
    if (!trimmedText) {
      setDeferDatePreview(null)
      return
    }
    setDeferDatePreview(describeNaturalDate(trimmedText))
    const parsed = parseNaturalDate(trimmedText)
    if (parsed) {
      setDeferDate(parsed)
    }
  }, [naturalDeferDate])

  const normalizeTagInput = (value: string): string => {
    return value.trim().replace(/[\s,]+$/g, '')
  }

  const addTagFromInput = (rawInput: string): boolean => {
    const normalized = normalizeTagInput(rawInput)
    if (!normalized) return false
    
    const lower = normalized.toLowerCase()
    const matchingTag = availableTags.find(tag => tag.name.toLowerCase() === lower)
    
    if (matchingTag) {
      const exists = selectedTags.some(tag => tag.toLowerCase() === matchingTag.name.toLowerCase())
      if (exists) {
        setError(`Tag "${matchingTag.name}" already added`)
        return false
      }
      setSelectedTags(prev => [...prev, matchingTag.name])
      setTagInput('')
      setShowTagDropdown(false)
      setError(null)
      return true
    }
    
    setError('Tag not found. Start typing to see suggestions.')
    setShowTagDropdown(true)
    return false
  }

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove))
    setError(null)
  }

  const createDueDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setHours(21, 0, 0, 0) // End of working day
    return date.toISOString()
  }

  const createDeferDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    date.setHours(7, 0, 0, 0) // Start of working day
    return date.toISOString()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!projectName.trim()) {
      setError('Project name is required')
      return
    }
    
    if (!nextAction.trim()) {
      setError('Next action is required')
      return
    }

    // Try to add pending tag input
    if (tagInput.trim()) {
      const added = addTagFromInput(tagInput)
      if (!added) {
        return
      }
    }

    setCreating(true)
    setError(null)

    try {
      if (!window.electronAPI?.omnifocus) {
        throw new Error('OmniFocus API not available')
      }

      // Build task updates object
      const taskUpdates: any = {}
      if (selectedTags.length > 0) {
        taskUpdates.tags = selectedTags
      }
      if (dueDate) {
        taskUpdates.dueDate = createDueDate(dueDate)
      }
      if (deferDate) {
        taskUpdates.deferDate = createDeferDate(deferDate)
      }

      const result = await window.electronAPI.omnifocus.createProjectWithTask(
        projectName.trim(),
        nextAction.trim(),
        taskUpdates
      )

      if (!result.success) {
        throw new Error(result.error || 'Failed to create project')
      }

      console.log('✅ Project created successfully:', result)
      
      // Remove from Notion
      if (window.electronAPI?.notion) {
        try {
          await window.electronAPI.notion.deleteSomedayItem(item.pageId)
        } catch (notionErr) {
          console.warn('Failed to remove item from Notion:', notionErr)
          // Don't fail the whole operation if Notion deletion fails
        }
      }
      
      // Show success state briefly
      setSuccess(true)
      
      // Wait a moment to show success, then call onComplete
      setTimeout(() => {
        onComplete()
      }, 1500)
    } catch (err) {
      console.error('Error creating project:', err)
      setError(err instanceof Error ? err.message : 'Unknown error creating project')
      setCreating(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !creating && !success) {
      onCancel()
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
    >
      <div
        style={{
          background: 'rgba(30, 30, 40, 0.95)',
          borderRadius: '16px',
          padding: '32px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          disabled={creating || success}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            padding: '8px',
            cursor: (creating || success) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: (creating || success) ? 0.5 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          <X size={20} />
        </button>

        {success ? (
          <div style={{
            padding: '20px 0'
          }}>
            <CheckCircle2 size={64} style={{ color: '#4CAF50', marginBottom: '16px' }} />
            <h2 style={{
              fontSize: '1.5em',
              fontWeight: '600',
              marginBottom: '8px',
              textAlign: 'left'
            }}>
              Project Created!
            </h2>
            <p style={{
              opacity: 0.8,
              fontSize: '0.95em',
              textAlign: 'left'
            }}>
              "{projectName}" has been promoted to an active project with your next action.
            </p>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <Sparkles size={32} style={{ color: '#FFC107' }} />
              <h2 style={{
                fontSize: '1.8em',
                fontWeight: '700',
                margin: 0,
                textAlign: 'left'
              }}>
                Promote to Active Project
              </h2>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  opacity: 0.9,
                  textAlign: 'left'
                }}>
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  disabled={creating}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '1em',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    opacity: creating ? 0.6 : 1,
                    cursor: creating ? 'not-allowed' : 'text',
                    textAlign: 'left'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(76, 175, 80, 0.5)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  opacity: 0.9,
                  textAlign: 'left'
                }}>
                  Next Action <span style={{ color: '#ff4444' }}>*</span>
                </label>
                <input
                  id="next-action-input"
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  disabled={creating}
                  placeholder="What's the first step?"
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '1em',
                    outline: 'none',
                    transition: 'all 0.2s ease',
                    opacity: creating ? 0.6 : 1,
                    cursor: creating ? 'not-allowed' : 'text',
                    textAlign: 'left'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'rgba(76, 175, 80, 0.5)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                  }}
                />
              </div>

              {/* Context/Tags Field */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  opacity: 0.9,
                  textAlign: 'left'
                }}>
                  Context / Tags
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value)
                      setShowTagDropdown(true)
                    }}
                    onFocus={() => setShowTagDropdown(true)}
                    disabled={creating || loadingTags}
                    placeholder={loadingTags ? "Loading tags..." : "Type to search tags..."}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '1em',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      opacity: (creating || loadingTags) ? 0.6 : 1,
                      textAlign: 'left'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTagFromInput(tagInput)
                      } else if (e.key === 'Escape') {
                        setShowTagDropdown(false)
                      }
                    }}
                  />
                  {showTagDropdown && filteredTags.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'rgba(30, 30, 40, 0.98)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      marginTop: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                    }}>
                      {filteredTags.slice(0, 10).map((tag) => (
                        <div
                          key={tag.id}
                          onClick={() => {
                            if (!selectedTags.some(t => t.toLowerCase() === tag.name.toLowerCase())) {
                              setSelectedTags(prev => [...prev, tag.name])
                            }
                            setTagInput('')
                            setShowTagDropdown(false)
                          }}
                          style={{
                            padding: '10px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          {tag.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedTags.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '8px'
                  }}>
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          background: 'rgba(76, 175, 80, 0.2)',
                          border: '1px solid rgba(76, 175, 80, 0.4)',
                          borderRadius: '12px',
                          fontSize: '0.85em',
                          color: '#4CAF50'
                        }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          disabled={creating}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#4CAF50',
                            cursor: creating ? 'not-allowed' : 'pointer',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center'
                          }}
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Defer Date Field */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  opacity: 0.9,
                  textAlign: 'left'
                }}>
                  Defer Date
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={naturalDeferDate}
                    onChange={(e) => setNaturalDeferDate(e.target.value)}
                    disabled={creating}
                    placeholder="tomorrow, next Friday, in 2 weeks..."
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '1em',
                      outline: 'none',
                      textAlign: 'left'
                    }}
                  />
                  <input
                    type="date"
                    value={deferDate}
                    onChange={(e) => setDeferDate(e.target.value)}
                    disabled={creating}
                    style={{
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '1em',
                      outline: 'none'
                    }}
                  />
                </div>
                {deferDatePreview && (
                  <div style={{ fontSize: '0.8em', color: '#4CAF50', marginTop: '4px', textAlign: 'left' }}>
                    ✓ {deferDatePreview}
                  </div>
                )}
              </div>

              {/* Due Date Field */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  opacity: 0.9,
                  textAlign: 'left'
                }}>
                  Due Date
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={naturalDueDate}
                    onChange={(e) => setNaturalDueDate(e.target.value)}
                    disabled={creating}
                    placeholder="tomorrow, next Friday, in 2 weeks..."
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '1em',
                      outline: 'none',
                      textAlign: 'left'
                    }}
                  />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={creating}
                    style={{
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '1em',
                      outline: 'none'
                    }}
                  />
                </div>
                {dueDatePreview && (
                  <div style={{ fontSize: '0.8em', color: '#4CAF50', marginTop: '4px', textAlign: 'left' }}>
                    ✓ {dueDatePreview}
                  </div>
                )}
              </div>

              {error && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(255, 68, 68, 0.2)',
                  border: '1px solid rgba(255, 68, 68, 0.4)',
                  borderRadius: '8px',
                  color: '#ff4444',
                  fontSize: '0.9em',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  textAlign: 'left'
                }}>
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={creating}
                  style={{
                    padding: '12px 24px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.95em',
                    fontWeight: '500',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    opacity: creating ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !projectName.trim() || !nextAction.trim()}
                  style={{
                    padding: '12px 24px',
                    background: creating || !projectName.trim() || !nextAction.trim() 
                      ? 'rgba(76, 175, 80, 0.2)' 
                      : 'rgba(76, 175, 80, 0.4)',
                    border: '1px solid rgba(76, 175, 80, 0.5)',
                    borderRadius: '8px',
                    color: '#4CAF50',
                    fontSize: '0.95em',
                    fontWeight: '500',
                    cursor: (creating || !projectName.trim() || !nextAction.trim()) 
                      ? 'not-allowed' 
                      : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    opacity: (creating || !projectName.trim() || !nextAction.trim()) ? 0.5 : 1
                  }}
                >
                  {creating ? (
                    <>
                      <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Create Project
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
