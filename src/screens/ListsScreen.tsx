import { useState, useEffect } from 'react'
import { useApp } from '../store'
import { ArrowLeft, Loader2, AlertCircle, Plus, Trash2, Edit2, X, Check, List, FileText } from 'lucide-react'

interface ListItem {
  pageId: string
  name: string
  notes: string
  created: string
  lastEdited: string
}

interface ListInfo {
  databaseId: string
  name: string
  createdTime: string
  lastEditedTime: string
}

export default function ListsScreen() {
  const { gotoQueue } = useApp()
  const [lists, setLists] = useState<ListInfo[]>([])
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hubConfigured, setHubConfigured] = useState<boolean | null>(null)
  
  // Create list modal state
  const [showCreateList, setShowCreateList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  
  // Add item modal state
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  
  // Edit item state
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemName, setEditItemName] = useState('')
  const [editItemNotes, setEditItemNotes] = useState('')
  const [updatingItem, setUpdatingItem] = useState(false)
  
  // Delete states
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [deletingListId, setDeletingListId] = useState<string | null>(null)

  // Check hub status on mount
  useEffect(() => {
    checkHubStatus()
  }, [])

  // Load lists when hub is configured
  useEffect(() => {
    if (hubConfigured === true) {
      loadLists()
    }
  }, [hubConfigured])

  // Load items when list is selected
  useEffect(() => {
    if (selectedListId) {
      loadListItems(selectedListId)
    } else {
      setItems([])
    }
  }, [selectedListId])

  const checkHubStatus = async () => {
    try {
      if (!window.electronAPI?.notion) {
        setHubConfigured(false)
        setError('Notion API not available')
        return
      }

      const result = await window.electronAPI.notion.getListsHubStatus()
      setHubConfigured(result.configured)
      
      if (!result.configured) {
        setError(result.error || 'Lists Hub not configured')
      }
    } catch (err) {
      console.error('Error checking Lists Hub status:', err)
      setHubConfigured(false)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const loadLists = async () => {
    setLoading(true)
    setError(null)
    
    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.getAllLists()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load lists')
      }

      setLists(result.lists || [])
      
      // Auto-select first list if none selected
      if (selectedListId === null && result.lists && result.lists.length > 0) {
        setSelectedListId(result.lists[0].databaseId)
      }
      
      console.log(`✅ Loaded ${result.lists?.length || 0} lists`)
    } catch (err) {
      console.error('Error loading lists:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const loadListItems = async (databaseId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.getListItems(databaseId)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load list items')
      }

      setItems(result.items || [])
      console.log(`✅ Loaded ${result.items?.length || 0} items from list`)
    } catch (err) {
      console.error('Error loading list items:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      return
    }

    setCreatingList(true)
    setError(null)

    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.createList(newListName.trim())
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create list')
      }

      // Refresh lists
      await loadLists()
      
      // Select the new list
      if (result.databaseId) {
        setSelectedListId(result.databaseId)
      }
      
      // Reset form
      setShowCreateList(false)
      setNewListName('')
      
      console.log(`✅ Created list "${newListName}"`)
    } catch (err) {
      console.error('Error creating list:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreatingList(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemName.trim() || !selectedListId) {
      return
    }

    setAddingItem(true)
    setError(null)

    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.addListItem(
        selectedListId,
        newItemName.trim(),
        newItemNotes.trim() || undefined
      )
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to add item')
      }

      // Reload items
      await loadListItems(selectedListId)
      
      // Reset form
      setShowAddItem(false)
      setNewItemName('')
      setNewItemNotes('')
      
      console.log(`✅ Added item "${newItemName}"`)
    } catch (err) {
      console.error('Error adding item:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setAddingItem(false)
    }
  }

  const handleStartEdit = (item: ListItem) => {
    setEditingItemId(item.pageId)
    setEditItemName(item.name)
    setEditItemNotes(item.notes)
  }

  const handleCancelEdit = () => {
    setEditingItemId(null)
    setEditItemName('')
    setEditItemNotes('')
  }

  const handleUpdateItem = async () => {
    if (!editingItemId || !editItemName.trim()) {
      return
    }

    setUpdatingItem(true)
    setError(null)

    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.updateListItem(editingItemId, {
        name: editItemName.trim(),
        notes: editItemNotes.trim()
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update item')
      }

      // Reload items
      if (selectedListId) {
        await loadListItems(selectedListId)
      }
      
      // Reset edit state
      setEditingItemId(null)
      setEditItemName('')
      setEditItemNotes('')
      
      console.log(`✅ Updated item`)
    } catch (err) {
      console.error('Error updating item:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setUpdatingItem(false)
    }
  }

  const handleDeleteItem = async (item: ListItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return
    }

    setDeletingItemId(item.pageId)
    setError(null)

    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.deleteListItem(item.pageId)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete item')
      }

      // Remove from local state
      setItems(items.filter(i => i.pageId !== item.pageId))
      
      console.log(`✅ Deleted item "${item.name}"`)
    } catch (err) {
      console.error('Error deleting item:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeletingItemId(null)
    }
  }

  const handleDeleteList = async (list: ListInfo) => {
    if (!confirm(`Are you sure you want to delete the list "${list.name}"? This will delete all items in the list.`)) {
      return
    }

    setDeletingListId(list.databaseId)
    setError(null)

    try {
      if (!window.electronAPI?.notion) {
        throw new Error('Notion API not available')
      }

      const result = await window.electronAPI.notion.deleteList(list.databaseId)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete list')
      }

      // Remove from local state
      setLists(lists.filter(l => l.databaseId !== list.databaseId))
      
      // Clear selection if deleted list was selected
      if (selectedListId === list.databaseId) {
        setSelectedListId(null)
        setItems([])
      }
      
      console.log(`✅ Deleted list "${list.name}"`)
    } catch (err) {
      console.error('Error deleting list:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeletingListId(null)
    }
  }

  return (
    <div className="page" style={{ display: 'flex', gap: '24px', height: '100%' }}>
      {/* Sidebar */}
      <div style={{
        width: '280px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        padding: '24px',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ 
            fontSize: '1.5em', 
            fontWeight: '700', 
            margin: 0,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}>
            Lists
          </h2>
          <button
            onClick={() => setShowCreateList(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '8px',
              color: 'white',
              padding: '6px 12px',
              fontSize: '0.85em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'
            }}
          >
            <Plus size={16} />
            New
          </button>
        </div>

        {loading && lists.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : lists.length === 0 ? (
          <div style={{ opacity: 0.7, textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: '0.9em', margin: 0 }}>No lists yet</p>
            <p style={{ fontSize: '0.75em', marginTop: '8px', opacity: 0.8 }}>
              Click "New" to create your first list
            </p>
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            overflowY: 'auto',
            flex: 1
          }}>
            {lists.map(list => (
              <div
                key={list.databaseId}
                onClick={() => setSelectedListId(list.databaseId)}
                style={{
                  padding: '12px',
                  background: selectedListId === list.databaseId 
                    ? 'rgba(255, 255, 255, 0.2)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  border: selectedListId === list.databaseId
                    ? '1px solid rgba(255, 255, 255, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (selectedListId !== list.databaseId) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedListId !== list.databaseId) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                  <List size={16} style={{ opacity: 0.7, flexShrink: 0 }} />
                  <span style={{ 
                    fontSize: '0.95em', 
                    fontWeight: selectedListId === list.databaseId ? '600' : '400',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {list.name}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteList(list)
                  }}
                  disabled={deletingListId === list.databaseId}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 68, 68, 0.7)',
                    cursor: deletingListId === list.databaseId ? 'not-allowed' : 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: deletingListId === list.databaseId ? 0.5 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (deletingListId !== list.databaseId) {
                      e.currentTarget.style.color = '#ff4444'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255, 68, 68, 0.7)'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ 
            fontSize: '3em', 
            fontWeight: '700', 
            margin: 0,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
          }}>
            {selectedListId ? lists.find(l => l.databaseId === selectedListId)?.name || 'List' : 'List of Lists'}
          </h1>
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
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            padding: '16px',
            background: 'rgba(255, 68, 68, 0.2)',
            border: '1px solid rgba(255, 68, 68, 0.4)',
            borderRadius: '8px',
            color: '#ff4444',
            fontSize: '0.9em',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            <div style={{ flex: 1 }}>
              <strong>Error:</strong> {error}
              {error.includes('not configured') && (
                <div style={{ marginTop: '8px', fontSize: '0.85em', opacity: 0.9 }}>
                  Make sure NOTION_TOKEN and NOTION_LISTS_HUB environment variables are set.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        {hubConfigured === false ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '60px 40px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
            opacity: 0.8
          }}>
            <AlertCircle size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ fontSize: '1.1em', margin: 0 }}>
              Lists Hub not configured
            </p>
            <p style={{ fontSize: '0.9em', marginTop: '8px', opacity: 0.8 }}>
              Set NOTION_LISTS_HUB environment variable to enable lists.
            </p>
          </div>
        ) : !selectedListId ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '60px 40px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            textAlign: 'center',
            opacity: 0.8
          }}>
            <List size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ fontSize: '1.1em', margin: 0 }}>
              Select a list to view items
            </p>
            <p style={{ fontSize: '0.9em', marginTop: '8px', opacity: 0.8 }}>
              Or create a new list to get started
            </p>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flex: 1,
            minHeight: 0
          }}>
            {/* Add item button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddItem(true)}
                style={{
                  background: 'rgba(76, 175, 80, 0.3)',
                  border: '1px solid rgba(76, 175, 80, 0.5)',
                  borderRadius: '8px',
                  color: '#4CAF50',
                  padding: '10px 20px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(76, 175, 80, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(76, 175, 80, 0.3)'
                }}
              >
                <Plus size={16} />
                Add Item
              </button>
            </div>

            {/* Items list */}
            {loading && items.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 20px', gap: '12px' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ opacity: 0.8 }}>Loading items...</span>
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', opacity: 0.7 }}>
                <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <p style={{ fontSize: '1.1em', margin: 0 }}>No items in this list</p>
                <p style={{ fontSize: '0.9em', marginTop: '8px', opacity: 0.8 }}>
                  Click "Add Item" to add your first item
                </p>
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px',
                overflowY: 'auto',
                flex: 1
              }}>
                {items.map(item => (
                  <div
                    key={item.pageId}
                    style={{
                      padding: '16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    {editingItemId === item.pageId ? (
                      <>
                        <input
                          type="text"
                          value={editItemName}
                          onChange={(e) => setEditItemName(e.target.value)}
                          placeholder="Item name"
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                            color: 'white',
                            padding: '10px',
                            fontSize: '1em',
                            outline: 'none',
                            width: '100%'
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateItem()
                            } else if (e.key === 'Escape') {
                              handleCancelEdit()
                            }
                          }}
                          autoFocus
                        />
                        <textarea
                          value={editItemNotes}
                          onChange={(e) => setEditItemNotes(e.target.value)}
                          placeholder="Notes (optional)"
                          rows={3}
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                            color: 'white',
                            padding: '10px',
                            fontSize: '0.9em',
                            outline: 'none',
                            width: '100%',
                            resize: 'vertical',
                            fontFamily: 'inherit'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={handleCancelEdit}
                            disabled={updatingItem}
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: '8px',
                              color: 'white',
                              padding: '8px 16px',
                              fontSize: '0.9em',
                              cursor: 'pointer'
                            }}
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={handleUpdateItem}
                            disabled={updatingItem || !editItemName.trim()}
                            style={{
                              background: 'rgba(76, 175, 80, 0.3)',
                              border: '1px solid rgba(76, 175, 80, 0.5)',
                              borderRadius: '8px',
                              color: '#4CAF50',
                              padding: '8px 16px',
                              fontSize: '0.9em',
                              cursor: updatingItem || !editItemName.trim() ? 'not-allowed' : 'pointer',
                              opacity: updatingItem || !editItemName.trim() ? 0.5 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            {updatingItem ? (
                              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : (
                              <Check size={14} />
                            )}
                            Save
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: '1.1em', 
                              fontWeight: '500',
                              marginBottom: '4px'
                            }}>
                              {item.name}
                            </div>
                            {item.notes && (
                              <div style={{ 
                                fontSize: '0.85em', 
                                opacity: 0.7,
                                marginTop: '4px',
                                whiteSpace: 'pre-wrap'
                              }}>
                                {item.notes}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              onClick={() => handleStartEdit(item)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '8px',
                                color: 'white',
                                padding: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              disabled={deletingItemId === item.pageId}
                              style={{
                                background: 'rgba(255, 68, 68, 0.2)',
                                border: '1px solid rgba(255, 68, 68, 0.4)',
                                borderRadius: '8px',
                                color: '#ff4444',
                                padding: '8px',
                                cursor: deletingItemId === item.pageId ? 'not-allowed' : 'pointer',
                                opacity: deletingItemId === item.pageId ? 0.5 : 1,
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              {deletingItemId === item.pageId ? (
                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create List Modal */}
      {showCreateList && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}
        onClick={() => !creatingList && setShowCreateList(false)}
        >
          <div style={{
            background: 'rgba(30, 30, 40, 0.95)',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: '500px',
            width: '90%',
            backdropFilter: 'blur(10px)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5em', fontWeight: '700', marginBottom: '20px' }}>
              Create New List
            </h2>
            <input
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="List name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateList()
                } else if (e.key === 'Escape') {
                  setShowCreateList(false)
                  setNewListName('')
                }
              }}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                color: 'white',
                padding: '12px',
                fontSize: '1em',
                outline: 'none',
                marginBottom: '20px'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowCreateList(false)
                  setNewListName('')
                }}
                disabled={creatingList}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '10px 20px',
                  fontSize: '0.95em',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                disabled={creatingList || !newListName.trim()}
                style={{
                  background: 'rgba(76, 175, 80, 0.3)',
                  border: '1px solid rgba(76, 175, 80, 0.5)',
                  borderRadius: '8px',
                  color: '#4CAF50',
                  padding: '10px 20px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  cursor: creatingList || !newListName.trim() ? 'not-allowed' : 'pointer',
                  opacity: creatingList || !newListName.trim() ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {creatingList ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}
        onClick={() => !addingItem && setShowAddItem(false)}
        >
          <div style={{
            background: 'rgba(30, 30, 40, 0.95)',
            borderRadius: '16px',
            padding: '32px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            maxWidth: '500px',
            width: '90%',
            backdropFilter: 'blur(10px)'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '1.5em', fontWeight: '700', marginBottom: '20px' }}>
              Add Item
            </h2>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Item name"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAddItem()
                } else if (e.key === 'Escape') {
                  setShowAddItem(false)
                  setNewItemName('')
                  setNewItemNotes('')
                }
              }}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                color: 'white',
                padding: '12px',
                fontSize: '1em',
                outline: 'none',
                marginBottom: '12px'
              }}
              autoFocus
            />
            <textarea
              value={newItemNotes}
              onChange={(e) => setNewItemNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setShowAddItem(false)
                  setNewItemName('')
                  setNewItemNotes('')
                }
              }}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                color: 'white',
                padding: '12px',
                fontSize: '0.9em',
                outline: 'none',
                marginBottom: '20px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddItem(false)
                  setNewItemName('')
                  setNewItemNotes('')
                }}
                disabled={addingItem}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  padding: '10px 20px',
                  fontSize: '0.95em',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                disabled={addingItem || !newItemName.trim()}
                style={{
                  background: 'rgba(76, 175, 80, 0.3)',
                  border: '1px solid rgba(76, 175, 80, 0.5)',
                  borderRadius: '8px',
                  color: '#4CAF50',
                  padding: '10px 20px',
                  fontSize: '0.95em',
                  fontWeight: '500',
                  cursor: addingItem || !newItemName.trim() ? 'not-allowed' : 'pointer',
                  opacity: addingItem || !newItemName.trim() ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {addingItem ? (
                  <>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Add
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

