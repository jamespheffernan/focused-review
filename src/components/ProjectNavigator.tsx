import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import type { ProjectDTO } from '../types'

interface ProjectNavigatorProps {
  currentIndex: number
  queue: ProjectDTO[]
  onNavigate: (newIndex: number) => void
}

export default function ProjectNavigator({ currentIndex, queue, onNavigate }: ProjectNavigatorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handlePrevious = () => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < queue.length - 1) {
      onNavigate(currentIndex + 1)
    }
  }

  const handleProjectSelect = (index: number) => {
    onNavigate(index)
    setIsDropdownOpen(false)
  }

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  if (queue.length === 0) {
    return null
  }

  return (
    <div className="project-navigator">
      {/* Previous Arrow */}
      <button
        className="nav-arrow"
        onClick={handlePrevious}
        disabled={currentIndex === 0}
        title="Previous project"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Project Counter Dropdown */}
      <div className="project-dropdown" ref={dropdownRef}>
        <button
          className="project-count"
          onClick={toggleDropdown}
          title="Select project"
        >
          {currentIndex + 1} of {queue.length}
          <ChevronDown size={14} style={{ marginLeft: '4px' }} />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="project-menu">
            {queue.map((project, index) => (
              <div
                key={project.id}
                className={`project-menu-item ${index === currentIndex ? 'current' : ''}`}
                onClick={() => handleProjectSelect(index)}
              >
                <div style={{ fontWeight: index === currentIndex ? '600' : '400' }}>
                  {index + 1}. {project.name}
                </div>
                {index === currentIndex && (
                  <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '2px' }}>
                    Current
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next Arrow */}
      <button
        className="nav-arrow"
        onClick={handleNext}
        disabled={currentIndex === queue.length - 1}
        title="Next project"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
