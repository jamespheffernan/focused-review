// DataSourceBanner Component
// Displays a notification when JXA fallback is active (slower sync method)

interface DataSourceBannerProps {
  dataSource: 'sqlite' | 'jxa'
  fallbackReason?: string
}

export function DataSourceBanner({ dataSource, fallbackReason }: DataSourceBannerProps) {
  // Only show banner when using JXA fallback
  if (dataSource === 'sqlite') return null
  
  return (
    <div
      style={{
        backgroundColor: '#fffbeb',
        borderLeft: '4px solid #f59e0b',
        padding: '1rem',
        marginBottom: '1rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, marginRight: '0.75rem' }}>
          <svg
            style={{ width: '1.25rem', height: '1.25rem', color: '#f59e0b' }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
            <strong>Using slower sync method.</strong> This may take a few minutes.
          </p>
          {fallbackReason && (
            <p style={{ fontSize: '0.75rem', color: '#78350f', margin: '0.25rem 0 0 0' }}>
              Reason: {fallbackReason}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

