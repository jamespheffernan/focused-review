import { useEffect } from 'react'
import { useApp } from './store'
import QueueScreen from './screens/QueueScreen'
import FocusScreen from './screens/FocusScreen'
import SummaryScreen from './screens/SummaryScreen'
import './App.css'

export default function App() {
  const { route, loadQueue } = useApp()
  useEffect(() => { loadQueue() }, [])
  if (route.name === 'queue') return <QueueScreen />
  if (route.name === 'focus') return <FocusScreen projectIndex={route.idx} />
  return <SummaryScreen />
}
