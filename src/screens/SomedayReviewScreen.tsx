import { useState, useEffect } from 'react'
import { useApp } from '../store'
import PromoteProjectModal from '../components/PromoteProjectModal'
import { ArrowLeft, Sparkles, Loader2, AlertCircle, Trash2 } from 'lucide-react'

interface SomedayItem {
  pageId: string
  name: string
  ofId: string | null
  note: string
  createdAt: string
  lastEditedAt: string
}

interface SomedayDatabase {
  id: string
  name: string
}

export default function SomedayReviewScreen() {
  const { gotoQueue } = useApp()
  const [items, setItems] = useState<SomedayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [promotingItem, setPromotingItem] = useState<SomedayItem | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [availableDatabases, setAvailableDatabases] = useState<SomedayDatabase[]>([])
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null)

  // Load available databases on mount
  useEffect(() => {
    loadAvailableDatabases()
  }, [])

  // Load items when selected database changes or becomes available
  useEffect(() => {
    if (selectedDatabaseId !== null) {
      loadSomedayItems()
    }
  }, [selectedDatabaseId])

  const loadAvailableDatabases = async () => {
    try {
      if (!window.electronAPI?.notion) {
        return
      }

      const config = await window.electronAPI.notion.isConfigured()
      
      if (config.somedayDatabases && config.somedayDatabases.length > 0) {
        setAvailableDatabases(config.somedayDatabases)
        // Set first database as default (only if not already set)
        if (selectedDatabaseId === null && config.somedayDatabases.length > 0) {
          setSelectedDatabaseId(config.somedayDatabases[0].id)
        }
      } else if (config.somedayDb) {
        // Fallback to legacy single database
        const legacyDb = [{ id: config.somedayDb, name: 'Default' }]
        setAvailableDatabases(legacyDb)
        if (selectedDatabaseId === null) {
          setSelectedDatabaseId(config.somedayDb)
        }
      }
    } catch (err) {
      console.error('Error loading available databases:', err)
    }
  }

  const loadSomedayItems = async () => {
    // Don't load if no database is selected yet
    if (selectedDatabaseId === null && availableDatabases.length === 0) {
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.getSomedayItems(selectedDatabaseId)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load Someday/Maybe items')
      }

      setItems(result.items || [])
      console.log(`✅ Loaded ${result.items?.length || 0} Someday/Maybe items from database`)
    } catch (err) {
      console.error('Error loading Someday/Maybe items:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handlePromote = (item: SomedayItem) => {
    setPromotingItem(item)
  }

  const handlePromoteComplete = () => {
    // Remove the promoted item from the list
    if (promotingItem) {
      setItems(items.filter(item => item.pageId !== promotingItem.pageId))
    }
    setPromotingItem(null)
  }

  const handlePromoteCancel = () => {
    setPromotingItem(null)
  }

  const handleDelete = async (item: SomedayItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}" from your Someday/Maybe list?`)) {
      return
    }

    setDeletingItemId(item.pageId)
    setError(null)

    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.deleteSomedayItem(item.pageId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete item')
      }

      // Remove item from list
      setItems(items.filter(i => i.pageId !== item.pageId))
      console.log(`✅ Deleted Someday/Maybe item: ${item.name}`)
    } catch (err) {
      console.error('Error deleting item:', err)
      setError(err instanceof Error ? err.message : 'Unknown error deleting item')
    } finally {
      setDeletingItemId(null)
    }
  }

  return (
    <div className="page">
      <h1 style={{ 
        fontSize: '3em', 
        fontWeight: '700', 
        textAlign: 'left', 
        marginBottom: '40px',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
      }}>
        Someday/Maybe Review
      </h1>
      
      <div style={{ 
        background: 'rgba(255, 255, 255, 0.1)', 
        borderRadius: '16px', 
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <button
            onClick={gotoQueue}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              padding: '8px 16px',
              fontSize: '0.9em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          
          {availableDatabases.length > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <label style={{
                fontSize: '0.9em',
                opacity: 0.8,
                whiteSpace: 'nowrap'
              }}>
                List:
              </label>
              <select
                value={selectedDatabaseId || ''}
                onChange={(e) => {
                  setSelectedDatabaseId(e.target.value || null)
                }}
                disabled={loading}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '8px 16px',
                  fontSize: '0.9em',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  outline: 'none',
                  minWidth: '150px'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(255, 193, 7, 0.5)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                }}
              >
                {availableDatabases.map(db => (
                  <option key={db.id} value={db.id} style={{ background: '#1e1e28', color: 'white' }}>
                    {db.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <p style={{ 
            fontSize: '0.9em', 
            opacity: 0.8,
            margin: 0,
            textAlign: 'left',
            flex: 1,
            minWidth: '200px'
          }}>
            Review items from your Someday/Maybe list and promote them to active projects
          </p>
        </div>

        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '60px 20px',
            gap: '12px'
          }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ opacity: 0.8 }}>Loading Someday/Maybe items...</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '16px',
            background: 'rgba(255, 68, 68, 0.2)',
            border: '1px solid rgba(255, 68, 68, 0.4)',
            borderRadius: '8px',
            color: '#ff4444',
            fontSize: '0.9em',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            <div>
              <strong>Error:</strong> {error}
              {error.includes('not configured') && (
                <div style={{ marginTop: '8px', fontSize: '0.85em', opacity: 0.9 }}>
                  Make sure NOTION_TOKEN and NOTION_SOMEDAY_DB environment variables are set.
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div style={{
            padding: '60px 20px',
            textAlign: 'left',
            opacity: 0.7
          }}>
            <Sparkles size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ fontSize: '1.1em', margin: 0, textAlign: 'left' }}>
              No items in your Someday/Maybe list.
            </p>
            <p style={{ fontSize: '0.9em', marginTop: '8px', opacity: 0.8, textAlign: 'left' }}>
              Items will appear here when you move projects to Someday/Maybe.
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="list" style={{ margin: 0, padding: 0 }}>
            {items.map(item => (
              <li key={item.pageId} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                marginBottom: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ 
                    fontSize: '1.1em', 
                    fontWeight: '500',
                    marginBottom: '4px',
                    textAlign: 'left'
                  }}>
                    {item.name}
                  </div>
                  {item.note && (
                    <div style={{ 
                      fontSize: '0.85em', 
                      opacity: 0.7,
                      marginTop: '4px',
                      maxHeight: '40px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textAlign: 'left'
                    }}>
                      {item.note}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => handlePromote(item)}
                    style={{
                      background: 'rgba(76, 175, 80, 0.3)',
                      border: '1px solid rgba(76, 175, 80, 0.5)',
                      borderRadius: '8px',
                      color: '#4CAF50',
                      padding: '10px 20px',
                      fontSize: '0.95em',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(76, 175, 80, 0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(76, 175, 80, 0.3)'
                    }}
                  >
                    <Sparkles size={16} />
                    Promote
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deletingItemId === item.pageId}
                    style={{
                      background: 'rgba(255, 68, 68, 0.2)',
                      border: '1px solid rgba(255, 68, 68, 0.4)',
                      borderRadius: '8px',
                      color: '#ff4444',
                      padding: '10px 20px',
                      fontSize: '0.95em',
                      fontWeight: '500',
                      cursor: deletingItemId === item.pageId ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      whiteSpace: 'nowrap',
                      opacity: deletingItemId === item.pageId ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (deletingItemId !== item.pageId) {
                        e.currentTarget.style.background = 'rgba(255, 68, 68, 0.3)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)'
                    }}
                  >
                    <Trash2 size={16} />
                    {deletingItemId === item.pageId ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {promotingItem && (
        <PromoteProjectModal
          item={promotingItem}
          onComplete={handlePromoteComplete}
          onCancel={handlePromoteCancel}
        />
      )}
    </div>
  )
}

