// components/CalendarGanttChart.tsx
import type { TimelineCommitmentDTO } from '../types'
import {
  getCalendarDateRange,
  getTimelineColor,
  isPastDue,
  formatDisplayDate,
  calculatePositionPercent,
  truncateProjectName,
  generateMonthMarkers
} from '../utils/calendar-utils'

interface CalendarGanttChartProps {
  commitments: TimelineCommitmentDTO[]
}

export default function CalendarGanttChart({ commitments }: CalendarGanttChartProps) {
  const { startDate, endDate } = getCalendarDateRange()
  const monthMarkers = generateMonthMarkers(startDate, endDate)
  
  // Sort commitments by committed date
  const sortedCommitments = [...commitments].sort((a, b) => 
    a.committedDate.localeCompare(b.committedDate)
  )

  if (commitments.length === 0) {
    return (
      <div style={{
        padding: '60px 20px',
        textAlign: 'center',
        fontSize: '1.2em',
        opacity: 0.6
      }}>
        No timeline commitments yet.
        <div style={{ fontSize: '0.9em', marginTop: '12px', opacity: 0.8 }}>
          Answer timeline questions during your review to see projects here.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', minHeight: '400px' }}>
      {/* Timeline axis with month markers */}
      <div style={{
        position: 'relative',
        height: '40px',
        marginBottom: '20px',
        borderBottom: '2px solid rgba(255, 255, 255, 0.2)'
      }}>
        {/* Today marker */}
        <div style={{
          position: 'absolute',
          left: '0%',
          top: 0,
          bottom: -4,
          width: '2px',
          background: '#2196F3',
          zIndex: 2
        }}>
          <div style={{
            position: 'absolute',
            top: '-24px',
            left: '-20px',
            fontSize: '0.75em',
            fontWeight: '600',
            color: '#2196F3',
            whiteSpace: 'nowrap'
          }}>
            Today
          </div>
        </div>

        {/* Month markers */}
        {monthMarkers.map((marker, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${marker.position}%`,
              top: '8px',
              fontSize: '0.75em',
              opacity: 0.7,
              whiteSpace: 'nowrap',
              transform: 'translateX(-50%)'
            }}
          >
            {marker.label}
          </div>
        ))}
      </div>

      {/* Project rows with timeline bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {sortedCommitments.map((commitment, index) => {
          const color = getTimelineColor(commitment.committedDate)
          const pastDue = isPastDue(commitment.committedDate)
          const endPosition = calculatePositionPercent(
            commitment.committedDate,
            startDate,
            endDate
          )

          return (
            <div
              key={commitment.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '8px',
                background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                borderRadius: '4px'
              }}
            >
              {/* Project name */}
              <div style={{
                minWidth: '200px',
                maxWidth: '200px',
                fontSize: '0.9em',
                fontWeight: '500',
                opacity: pastDue ? 0.6 : 1,
                textDecoration: pastDue ? 'line-through' : 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {truncateProjectName(commitment.projectName, 25)}
              </div>

              {/* Timeline bar container */}
              <div style={{
                flex: 1,
                position: 'relative',
                height: '32px',
                display: 'flex',
                alignItems: 'center'
              }}>
                {/* Timeline bar from today to committed date */}
                <div style={{
                  position: 'absolute',
                  left: '0%',
                  right: `${100 - endPosition}%`,
                  height: '4px',
                  background: `linear-gradient(to right, ${color}40, ${color})`,
                  borderRadius: '2px',
                  opacity: pastDue ? 0.4 : 0.8
                }} />

                {/* End marker (dot) */}
                <div style={{
                  position: 'absolute',
                  left: `${endPosition}%`,
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: color,
                  border: '2px solid rgba(255, 255, 255, 0.9)',
                  transform: 'translateX(-50%)',
                  boxShadow: `0 0 8px ${color}80`,
                  zIndex: 1
                }} />

                {/* Date label */}
                <div style={{
                  position: 'absolute',
                  left: `${endPosition}%`,
                  top: '18px',
                  fontSize: '0.7em',
                  fontWeight: '500',
                  color: color,
                  whiteSpace: 'nowrap',
                  transform: 'translateX(-50%)',
                  opacity: 0.9
                }}>
                  {formatDisplayDate(commitment.committedDate)}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap',
        fontSize: '0.75em',
        opacity: 0.7
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '16px', height: '4px', background: '#FF5722', borderRadius: '2px' }} />
          <span>&lt; 2 weeks</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '16px', height: '4px', background: '#FFC107', borderRadius: '2px' }} />
          <span>2-8 weeks</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '16px', height: '4px', background: '#4CAF50', borderRadius: '2px' }} />
          <span>&gt; 8 weeks</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '16px', height: '4px', background: '#9E9E9E', borderRadius: '2px' }} />
          <span>Past due</span>
        </div>
      </div>
    </div>
  )
}

