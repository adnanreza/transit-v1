import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { FrequenciesFile } from '../../scripts/types/frequencies'

interface RouteDetailPanelProps {
  routeId: string | null
  frequencies: FrequenciesFile | null
  onClose: () => void
}

export default function RouteDetailPanel({
  routeId,
  frequencies,
  onClose,
}: RouteDetailPanelProps) {
  // Keep the last-known routeId around during the closing animation so the
  // panel doesn't go blank as it slides out. Use the derive-during-render
  // pattern — no effect needed, since we only need to mirror non-null values.
  const [displayedId, setDisplayedId] = useState<string | null>(routeId)
  if (routeId !== null && routeId !== displayedId) {
    setDisplayedId(routeId)
  }

  const route =
    displayedId && frequencies ? (frequencies[displayedId] ?? null) : null

  return (
    <Sheet
      open={routeId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md"
        aria-describedby="route-detail-description"
      >
        <SheetHeader>
          <SheetTitle>
            {route ? (route.route_id) : 'Route details'}
          </SheetTitle>
          <SheetDescription id="route-detail-description">
            Frequency profile and FTN qualification for this route.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  )
}
