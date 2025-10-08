import { useState, useRef } from 'react'
import { omnifocusService } from '../services/omnifocus'
import type { OmniFocusProject } from '../services/omnifocus'

interface OmniFocusImporterProps {
  onProjectsImported: (projects: OmniFocusProject[]) => void
  onClose: () => void
}

export default function OmniFocusImporter({ onProjectsImported, onClose }: OmniFocusImporterProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const integrationStatus = omnifocusService.getIntegrationStatus()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      const projects = await omnifocusService.parseOmniFocusDatabase(file)

      clearInterval(progressInterval)
      setUploadProgress(100)

      setTimeout(() => {
        onProjectsImported(projects)
        onClose()
      }, 500)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import OmniFocus projects.')
      setIsUploading(false)
      setUploadProgress(0)
    } finally {
      // Reset file input to allow re-uploading the same file
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleConnectToOmniFocus = async () => {
    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 20, 90))
      }, 200)

      // Always sync active projects from OmniFocus
      const projects = await omnifocusService.getProjectsDueForReview()

      clearInterval(progressInterval)
      setUploadProgress(100)

      setTimeout(() => {
        onProjectsImported(projects)
        onClose()
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to OmniFocus')
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
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
      backdropFilter: 'blur(5px)'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05))',
        borderRadius: '20px',
        padding: '30px',
        width: '90%',
        maxWidth: '600px',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        color: 'white',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '1.5em',
            cursor: 'pointer',
            opacity: 0.7
          }}
        >
          &times;
        </button>

        <h2 style={{ margin: '0 0 20px 0', fontSize: '1.8em', textAlign: 'center', color: '#ff6b9d' }}>
          Import OmniFocus Projects
        </h2>

        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1em', opacity: 0.8 }}>Current Integration Status:</h3>
          <p style={{ margin: '0', opacity: 0.8 }}>
            <strong>Method:</strong> {integrationStatus.method === 'file-upload' ? 'File Upload' : integrationStatus.method === 'applescript' ? 'AppleScript' : integrationStatus.method === 'electron' ? 'Electron' : 'None'}
          </p>
          <p style={{ margin: '0', opacity: 0.8 }}>
            <strong>Status:</strong> {integrationStatus.message}
          </p>
        </div>

        {/* Always show file upload option prominently */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1em' }}>Upload OmniFocus Database:</h3>
          <p style={{ margin: '0 0 16px 0', opacity: 0.8, fontSize: '0.9em' }}>
            Upload your OmniFocus database file to import your projects. 
            Supported formats: <strong>.xml</strong>, <strong>.ofocus</strong>, or <strong>.sqlite</strong>
          </p>
          <p style={{ margin: '0 0 16px 0', opacity: 0.7, fontSize: '0.8em' }}>
            Typical locations:
            <br />• <code>~/Library/Group Containers/34W5Z2JT3V.omnigroup/OmniFocus/OmniFocus.ofocus/OmniFocusDatabase.xml</code>
            <br />• <code>~/Library/Application Support/OmniFocus/OmniFocus.ofocus/OmniFocusDatabase.xml</code>
          </p>
            
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml,.ofocus,.sqlite"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            style={{
              background: isUploading ? 'rgba(255, 255, 255, 0.2)' : '#ff6b9d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              width: '100%',
              fontSize: '1em',
              transition: 'all 0.2s ease'
            }}
          >
            {isUploading ? 'Processing...' : '📁 Choose OmniFocus Database File'}
          </button>

          {isUploading && (
            <div style={{ marginTop: '16px' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                height: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  background: '#ff6b9d',
                  height: '100%',
                  width: `${uploadProgress}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <p style={{ margin: '8px 0 0 0', fontSize: '0.8em', opacity: 0.7 }}>
                {uploadProgress}% complete
              </p>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(255, 68, 68, 0.2)',
              border: '1px solid rgba(255, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ff4444'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>

        {/* Alternative Methods */}
        {integrationStatus.method !== 'file-upload' && (
          <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1em', opacity: 0.8 }}>Alternative Methods:</h3>
            
            {integrationStatus.method === 'applescript' && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>🍎 AppleScript Integration:</h4>
                <p style={{ margin: '0 0 12px 0', opacity: 0.7, fontSize: '0.8em' }}>
                  Sync active projects directly from your running OmniFocus instance.
                </p>
                <button
                  onClick={handleConnectToOmniFocus}
                  disabled={isUploading}
                  style={{
                    background: isUploading ? 'rgba(255, 255, 255, 0.2)' : '#ff6b9d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    width: '100%',
                    fontSize: '1em',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isUploading ? 'Syncing from OmniFocus...' : 'Sync Active Projects from OmniFocus'}
                </button>
              </div>
            )}

            {integrationStatus.method === 'electron' && (
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>⚡ Electron Integration:</h4>
                <p style={{ margin: '0 0 12px 0', opacity: 0.7, fontSize: '0.8em' }}>
                  Direct integration available when running as a desktop application.
                </p>
                <button
                  onClick={handleConnectToOmniFocus}
                  disabled={isUploading}
                  style={{
                    background: isUploading ? 'rgba(255, 255, 255, 0.2)' : '#ff6b9d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    width: '100%',
                    fontSize: '1em',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isUploading ? 'Syncing from OmniFocus...' : 'Sync Active Projects from OmniFocus'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}