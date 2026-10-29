import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { formatTime } from './recorder'
import { addBookmark, endRecording, useLiveRecording, type LiveRecording } from './recordingStore'
import { Ico } from './icons'
import { BookmarkSimple } from '@phosphor-icons/react'
import { worldPath } from './paths'

/** While a session is being recorded, a slim bar on every other screen: how long, a bookmark, and Stop. */
export function RecordingBar() {
  const live = useLiveRecording()
  const { pathname } = useLocation()
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [live])
  const sessionPath = live && `${worldPath(live.worldId)}/s/${live.sessionId}`
  if (error)
    return (
      <div className="recording-bar" role="alert">
        <span className="error small">{error}</span>
        <button className="small" onClick={() => setError('')}>
          OK
        </button>
      </div>
    )
  if (!live || pathname === sessionPath) return null
  return (
    <div className="recording-bar" role="status">
      <span className="rec-dot" /> Recording <Link to={sessionPath!}>session #{live.sessionNumber}</Link> · {formatTime((now - live.rec.startedAt) / 1000)}
      <button className="small" onClick={() => {
          const text = prompt('Bookmark this moment:')
          if (text !== null) addBookmark(text)
        }}>
        <Ico as={BookmarkSimple} /> Bookmark
      </button>
      <button className="small danger" onClick={() => endRecording().catch((e) => setError((e as Error).message))}>
        ■ Stop & save
      </button>
      <RecordingSaveWarning live={live} />
    </div>
  )
}

/** Shown while pieces of the recording can't be saved as it goes, so the GM knows a crash would lose them. */
export function RecordingSaveWarning({ live }: { live: LiveRecording }) {
  if (!live.unsaved) return null
  return (
    <span className="error small">
      Not saving as it goes: this device is nearly full, so a crash now would lose the recording. Free up some space, or stop and save soon.
    </span>
  )
}
