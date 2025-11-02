import { useState } from 'react'
import type { TaskDTO } from '../types'

interface TaskFilters {
  status?: string
  context?: string
  flagged?: boolean
  dueDate?: 'overdue' | 'today' | 'thisWeek' | 'all'
}

interface TaskFilterProps {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  tasks: TaskDTO[]
}

export default function TaskFilter({ filters, onFiltersChange, tasks }: TaskFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Get unique contexts from tasks
  const contexts = Array.from(new Set(tasks.map(t => t.context).filter(Boolean)))

  const handleFilterChange = (key: keyof TaskFilters, value: string | boolean | undefined) => {
    const newFilters = { ...filters }
    
    if (value === '' || value === undefined || value === 'all') {
      delete newFilters[key]
    } else {
      newFilters[key] = value
    }
    
    onFiltersChange(newFilters)
  }

  const clearAllFilters = () => {
    onFiltersChange({})
  }

  const getActiveFilterCount = () => {
    return Object.keys(filters).length
  }

  const getFilteredTaskCount = () => {
    // This would be calculated by the parent component
    // For now, return a placeholder
    return tasks.length
  }

  return (
    <div className="task-filter">
      <div className="filter-header">
        <button
          className="filter-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="filter-icon">🔍</span>
          <span className="filter-label">Filters</span>
          {getActiveFilterCount() > 0 && (
            <span className="filter-count">{getActiveFilterCount()}</span>
          )}
        </button>
        
        {getActiveFilterCount() > 0 && (
          <button
            className="clear-filters"
            onClick={clearAllFilters}
            title="Clear all filters"
          >
            Clear All
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="filter-options">
          <div className="filter-group">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              value={filters.status || ''}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="next">Next Actions</option>
              <option value="available">Available</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="context-filter">Context</label>
            <select
              id="context-filter"
              value={filters.context || ''}
              onChange={(e) => handleFilterChange('context', e.target.value)}
            >
              <option value="">All Contexts</option>
              {contexts.map(context => (
                <option key={context} value={context}>
                  {context}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="due-date-filter">Due Date</label>
            <select
              id="due-date-filter"
              value={filters.dueDate || 'all'}
              onChange={(e) => handleFilterChange('dueDate', e.target.value)}
            >
              <option value="all">All Dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
            </select>
          </div>

          <div className="filter-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.flagged === true}
                onChange={(e) => handleFilterChange('flagged', e.target.checked ? true : undefined)}
              />
              <span className="checkbox-text">Flagged Only</span>
            </label>
          </div>

          <div className="filter-summary">
            <span className="filter-results">
              {getFilteredTaskCount()} tasks
              {getActiveFilterCount() > 0 && ' (filtered)'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
