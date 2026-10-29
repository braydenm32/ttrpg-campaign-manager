import { useEffect, useSyncExternalStore } from 'react'
import { exampleDrawing, finishExampleWorld } from './load'

/**
 * While a new example world's pictures and maps are still being drawn, says how far it's got.
 * Also picks the drawing up again if the tab was closed before it finished.
 */
export function ExampleDrawingNote({ worldId }: { worldId: string }) {
  const d = useSyncExternalStore(exampleDrawing.subscribe, exampleDrawing.get)
  useEffect(() => {
    void finishExampleWorld(worldId)
  }, [worldId])
  if (d?.worldId !== worldId) return null
  return (
    <div className="player-banner" role="status">
      Drawing this world’s maps and pictures… {d.done} of {d.total}. Look around meanwhile: each one appears as soon as it’s ready.
    </div>
  )
}
