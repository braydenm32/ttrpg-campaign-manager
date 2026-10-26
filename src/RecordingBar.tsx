import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { formatTime } from './recorder'
import { addBookmark, endRecording, useLiveRecording } from './recordingStore'
import { Ico } from './icons'
import { BookmarkSimple } from '@phosphor-icons/react'

/** While a session is being recorded, a slim bar on every other screen: how long, a bookmark, and Stop. */
export function RecordingBar() {
  const live = useLiveRecording()
  const { pathname } = useLocation()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [live])
  const sessionPath = live && `/w/${live.worldId}/s/${live.sessionId}`
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
      <button className="small danger" onClick={() => endRecording()}>
        ■ Stop & save
      </button>
    </div>
  )
}
