import { useState, useEffect } from 'react'
import { getAllPackages, addPackage, updatePackage, deletePackage, reorderPackages, restoreDefaults } from '../repos/questionPackagesRepo'
import type { QuestionPackageDTO, QuestionType, FollowupLogic } from '../types'
import './QuestionsScreen.css'

export default function QuestionsScreen() {
  const [packages, setPackages] = useState<QuestionPackageDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPackage, setEditingPackage] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Load packages on mount
  useEffect(() => {
    loadPackages()
  }, [])

  const loadPackages = async () => {
    try {
      const allPackages = await getAllPackages()
      setPackages(allPackages)
    } catch (error) {
      console.error('Error loading packages:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPackage = async () => {
    const newPackage: QuestionPackageDTO = {
      id: `pkg-${Date.now()}`,
      order: packages.length + 1,
      initialQuestion: 'New question',
      initialQuestionType: 'text',
      subsequentQuestion: 'New subsequent question',
      subsequentQuestionType: 'text'
    }

    try {
      await addPackage(newPackage)
      await loadPackages()
      setEditingPackage(newPackage.id)
      setShowAddForm(false)
    } catch (error) {
      console.error('Error adding package:', error)
    }
  }

  const handleUpdatePackage = async (id: string, updates: Partial<QuestionPackageDTO>) => {
    try {
      await updatePackage(id, updates)
      await loadPackages()
    } catch (error) {
      console.error('Error updating package:', error)
    }
  }

  const handleDeletePackage = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this question package?')) {
      try {
        await deletePackage(id)
        await loadPackages()
      } catch (error) {
        console.error('Error deleting package:', error)
      }
    }
  }

  const handleRestoreDefaults = async () => {
    if (window.confirm('This will replace all current question packages with the defaults. Are you sure?')) {
      try {
        await restoreDefaults()
        await loadPackages()
      } catch (error) {
        console.error('Error restoring defaults:', error)
      }
    }
  }

  const handleMoveUp = async (index: number) => {
    if (index === 0) return
    
    const newOrder = [...packages]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index - 1]
    newOrder[index - 1] = temp
    
    // Update order values
    newOrder.forEach((pkg, i) => {
      pkg.order = i + 1
    })
    
    try {
      await reorderPackages(newOrder.map(p => p.id))
      await loadPackages()
    } catch (error) {
      console.error('Error reordering packages:', error)
    }
  }

  const handleMoveDown = async (index: number) => {
    if (index === packages.length - 1) return
    
    const newOrder = [...packages]
    const temp = newOrder[index]
    newOrder[index] = newOrder[index + 1]
    newOrder[index + 1] = temp
    
    // Update order values
    newOrder.forEach((pkg, i) => {
      pkg.order = i + 1
    })
    
    try {
      await reorderPackages(newOrder.map(p => p.id))
      await loadPackages()
    } catch (error) {
      console.error('Error reordering packages:', error)
    }
  }

  if (loading) {
    return (
      <div className="questions-screen">
        <div className="loading">Loading question packages...</div>
      </div>
    )
  }

  return (
    <div className="questions-screen">
      <div className="questions-header">
        <h1>Question Packages</h1>
        <div className="questions-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
          >
            Add Package
          </button>
          <button 
            className="btn btn-secondary"
            onClick={handleRestoreDefaults}
          >
            Restore to Defaults
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="add-package-form">
          <h3>Add New Question Package</h3>
          <button 
            className="btn btn-primary"
            onClick={handleAddPackage}
          >
            Create Package
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowAddForm(false)}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="packages-list">
        {packages.map((pkg, index) => (
          <PackageEditor
            key={pkg.id}
            pkg={pkg}
            index={index}
            total={packages.length}
            isEditing={editingPackage === pkg.id}
            onEdit={() => setEditingPackage(pkg.id)}
            onSave={(updates) => {
              handleUpdatePackage(pkg.id, updates)
              setEditingPackage(null)
            }}
            onCancel={() => setEditingPackage(null)}
            onDelete={() => handleDeletePackage(pkg.id)}
            onMoveUp={() => handleMoveUp(index)}
            onMoveDown={() => handleMoveDown(index)}
          />
        ))}
      </div>
    </div>
  )
}

interface PackageEditorProps {
  pkg: QuestionPackageDTO
  index: number
  total: number
  isEditing: boolean
  onEdit: () => void
  onSave: (updates: Partial<QuestionPackageDTO>) => void
  onCancel: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function PackageEditor({ 
  pkg, 
  index, 
  total, 
  isEditing, 
  onEdit, 
  onSave, 
  onCancel, 
  onDelete, 
  onMoveUp, 
  onMoveDown 
}: PackageEditorProps) {
  const [formData, setFormData] = useState<Partial<QuestionPackageDTO>>(pkg)

  useEffect(() => {
    setFormData(pkg)
  }, [pkg])

  const handleSave = () => {
    onSave(formData)
  }

  const handleChange = (field: keyof QuestionPackageDTO, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (!isEditing) {
    return (
      <div className="package-card">
        <div className="package-header">
          <h3>Package {index + 1}: {pkg.initialQuestion}</h3>
          <div className="package-actions">
            <button onClick={onMoveUp} disabled={index === 0}>↑</button>
            <button onClick={onMoveDown} disabled={index === total - 1}>↓</button>
            <button onClick={onEdit}>Edit</button>
            <button onClick={onDelete} className="btn-danger">Delete</button>
          </div>
        </div>
        <div className="package-content">
          <div className="question-section">
            <h4>Initial Question</h4>
            <p><strong>Question:</strong> {pkg.initialQuestion}</p>
            <p><strong>Type:</strong> {pkg.initialQuestionType}</p>
            {pkg.initialFollowup && (
              <p><strong>Followup:</strong> {pkg.initialFollowup} (if {pkg.initialFollowupLogic})</p>
            )}
          </div>
          {pkg.subsequentQuestion && (
            <div className="question-section">
              <h4>Subsequent Question</h4>
              <p><strong>Question:</strong> {pkg.subsequentQuestion}</p>
              <p><strong>Type:</strong> {pkg.subsequentQuestionType}</p>
              {pkg.subsequentFollowup && (
                <p><strong>Followup:</strong> {pkg.subsequentFollowup} (if {pkg.subsequentFollowupLogic})</p>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="package-editor">
      <div className="editor-header">
        <h3>Edit Package {index + 1}</h3>
        <div className="editor-actions">
          <button onClick={handleSave} className="btn btn-primary">Save</button>
          <button onClick={onCancel} className="btn btn-secondary">Cancel</button>
        </div>
      </div>

      <div className="editor-content">
        <div className="question-section">
          <h4>Initial Question</h4>
          <div className="form-group">
            <label>Question:</label>
            <textarea
              value={formData.initialQuestion || ''}
              onChange={(e) => handleChange('initialQuestion', e.target.value)}
              rows={2}
            />
          </div>
          <div className="form-group">
            <label>Type:</label>
            <select
              value={formData.initialQuestionType || 'text'}
              onChange={(e) => handleChange('initialQuestionType', e.target.value as QuestionType)}
            >
              <option value="text">Text</option>
              <option value="slider">Slider</option>
              <option value="yes-no">Yes/No</option>
              <option value="text-parsed">Text (Date Parsed)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Followup Question:</label>
            <textarea
              value={formData.initialFollowup || ''}
              onChange={(e) => handleChange('initialFollowup', e.target.value)}
              rows={2}
              placeholder="Optional followup question"
            />
          </div>
          {formData.initialFollowup && (
            <>
              <div className="form-group">
                <label>Followup Type:</label>
                <select
                  value={formData.initialFollowupType || 'text'}
                  onChange={(e) => handleChange('initialFollowupType', e.target.value as QuestionType)}
                >
                  <option value="text">Text</option>
                  <option value="slider">Slider</option>
                  <option value="yes-no">Yes/No</option>
                  <option value="text-parsed">Text (Date Parsed)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Followup Logic:</label>
                <select
                  value={formData.initialFollowupLogic || 'always'}
                  onChange={(e) => handleChange('initialFollowupLogic', e.target.value as FollowupLogic)}
                >
                  <option value="always">Always</option>
                  <option value="never">Never</option>
                  <option value="if_yes">If Yes</option>
                  <option value="if_no">If No</option>
                  <option value="if_score_lte">If Score ≤</option>
                  <option value="if_score_gte">If Score ≥</option>
                  <option value="if_text_equals">If Text Equals</option>
                  <option value="if_text_contains">If Text Contains</option>
                </select>
              </div>
              {(formData.initialFollowupLogic === 'if_score_lte' || formData.initialFollowupLogic === 'if_score_gte') && (
                <div className="form-group">
                  <label>Score Threshold:</label>
                  <input
                    type="number"
                    value={formData.initialFollowupConditionValue || 1}
                    onChange={(e) => handleChange('initialFollowupConditionValue', parseInt(e.target.value))}
                    min="0"
                    max="3"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="question-section">
          <h4>Subsequent Question</h4>
          <div className="form-group">
            <label>Question:</label>
            <textarea
              value={formData.subsequentQuestion || ''}
              onChange={(e) => handleChange('subsequentQuestion', e.target.value)}
              rows={2}
              placeholder="Leave empty to skip in subsequent reviews"
            />
          </div>
          {formData.subsequentQuestion && (
            <>
              <div className="form-group">
                <label>Type:</label>
                <select
                  value={formData.subsequentQuestionType || 'text'}
                  onChange={(e) => handleChange('subsequentQuestionType', e.target.value as QuestionType)}
                >
                  <option value="text">Text</option>
                  <option value="slider">Slider</option>
                  <option value="yes-no">Yes/No</option>
                  <option value="text-parsed">Text (Date Parsed)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Followup Question:</label>
                <textarea
                  value={formData.subsequentFollowup || ''}
                  onChange={(e) => handleChange('subsequentFollowup', e.target.value)}
                  rows={2}
                  placeholder="Optional followup question"
                />
              </div>
              {formData.subsequentFollowup && (
                <>
                  <div className="form-group">
                    <label>Followup Type:</label>
                    <select
                      value={formData.subsequentFollowupType || 'text'}
                      onChange={(e) => handleChange('subsequentFollowupType', e.target.value as QuestionType)}
                    >
                      <option value="text">Text</option>
                      <option value="slider">Slider</option>
                      <option value="yes-no">Yes/No</option>
                      <option value="text-parsed">Text (Date Parsed)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Followup Logic:</label>
                    <select
                      value={formData.subsequentFollowupLogic || 'always'}
                      onChange={(e) => handleChange('subsequentFollowupLogic', e.target.value as FollowupLogic)}
                    >
                      <option value="always">Always</option>
                      <option value="never">Never</option>
                      <option value="if_yes">If Yes</option>
                      <option value="if_no">If No</option>
                      <option value="if_score_lte">If Score ≤</option>
                      <option value="if_score_gte">If Score ≥</option>
                      <option value="if_text_equals">If Text Equals</option>
                      <option value="if_text_contains">If Text Contains</option>
                    </select>
                  </div>
                  {(formData.subsequentFollowupLogic === 'if_score_lte' || formData.subsequentFollowupLogic === 'if_score_gte') && (
                    <div className="form-group">
                      <label>Score Threshold:</label>
                      <input
                        type="number"
                        value={formData.subsequentFollowupConditionValue || 1}
                        onChange={(e) => handleChange('subsequentFollowupConditionValue', parseInt(e.target.value))}
                        min="0"
                        max="3"
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
