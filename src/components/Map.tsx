import { useEffect, useRef } from 'react'
import maplibregl, { type ExpressionSpecification } from 'maplibre-gl'
import { Protocol } from 'pmtiles'
import { buildMapStyle, getPmtilesUrl } from '@/lib/map-style'
import 'maplibre-gl/dist/maplibre-gl.css'

const INITIAL_CENTER: [number, number] = [-123.05, 49.25]
const INITIAL_ZOOM = 10
const ROUTES_URL = '/data/routes.geojson'
const FALLBACK_ROUTE_COLOR = '#888888'

export function Map() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(getPmtilesUrl()),
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    })

    map.on('load', () => {
      map.addSource('routes', {
        type: 'geojson',
        data: ROUTES_URL,
      })

      // GTFS route_type: '3' = bus, '1' = subway/SkyTrain, '2' = rail/WCE,
      // '4' = ferry/SeaBus. Rapid transit is painted thicker and on top.
      const isBus: ExpressionSpecification = ['==', ['get', 'route_type'], '3']
      map.addLayer({
        id: 'routes-lines',
        type: 'line',
        source: 'routes',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          'line-sort-key': ['case', isBus, 0, 1],
        },
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'route_color'], ''],
            FALLBACK_ROUTE_COLOR,
            ['concat', '#', ['get', 'route_color']],
          ],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9, ['case', isBus, 0.75, 2],
            13, ['case', isBus, 2, 4.5],
            16, ['case', isBus, 3.5, 7],
          ],
        },
      })
    })

    return () => {
      map.remove()
      maplibregl.removeProtocol('pmtiles')
    }
  }, [])

  return <div ref={containerRef} className="h-full w-full" />
}
