import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Navigation, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRealtimeTracking } from '@/hooks/useRealtimeTracking'

declare global {
  interface Window {
    google: typeof google
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

interface TrackingData {
  driver: {
    id: string
    full_name: string
    status: string
    current_latitude?: number
    current_longitude?: number
    phone_no: string
    rating?: number
  }
  booking?: {
    id: string
    pickup_address?: string
    dropoff_address?: string
    pickup_latitude?: number
    pickup_longitude?: number
    dropoff_latitude?: number
    dropoff_longitude?: number
    status: string
    fare_amount?: number
    distance_km?: number
    vehicle_type?: string
    customer?: {
      full_name?: string
      phone_no?: string
    }
  }
  vehicle?: {
    make?: string
    model?: string
    type?: string
    license_plate?: string
  } 
}

interface LiveMapViewProps {
  selectedDriver?: string
}

export const LiveMapView: React.FC<LiveMapViewProps> = ({ selectedDriver: propSelectedDriver }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)

  const { trackingData, loading, error, lastUpdate, refreshData } = useRealtimeTracking()

  const [internalSelectedDriver, setInternalSelectedDriver] = useState<string>('all')

  const selectedDriver = propSelectedDriver || internalSelectedDriver
  const [mapLoaded, setMapLoaded] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  console.log('[DEBUG] LiveMapView: Component rendered, API key starts with:', GOOGLE_MAPS_API_KEY.substring(0, 10) + '...')

  const initializeMap = useCallback(async () => {
    if (!mapRef.current || mapLoaded) return

    console.log('[DEBUG] initializeMap: Starting map initialization')
    console.log('[DEBUG] initializeMap: mapRef.current exists:', !!mapRef.current)

    try {
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key is missing. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.')
      }

      console.log('[DEBUG] initializeMap: API key present, loading Google Maps API')

      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places', 'geometry'],
      })

      console.log('[DEBUG] initializeMap: Calling loader.load()')
      await loader.load()
      console.log('[DEBUG] initializeMap: Google Maps API loaded successfully')
      console.log('[DEBUG] initializeMap: window.google available:', !!window.google)
      console.log('[DEBUG] initializeMap: window.google.maps available:', !!window.google?.maps)

      if (!mapRef.current) {
        console.log('[DEBUG] initializeMap: mapRef.current is null after load')
        return
      }

      console.log('[DEBUG] initializeMap: Creating map instance')
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 28.6139, lng: 77.2090 },
        zoom: 11,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
        zoomControl: true,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      })

      mapInstanceRef.current = map
      directionsServiceRef.current = new window.google.maps.DirectionsService()
      directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#3B82F6',
          strokeWeight: 4,
          strokeOpacity: 0.8
        }
      })
      directionsRendererRef.current.setMap(map)

      setMapLoaded(true)
      setMapError(null)
      console.log('[DEBUG] initializeMap: Map initialized successfully')

    } catch (error) {
      console.error('[DEBUG] initializeMap: Error occurred:', error)
      let errorMessage = 'Failed to load Google Maps'
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          errorMessage = 'Invalid Google Maps API key.'
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error loading Google Maps.'
        } else {
          errorMessage = error.message
        }
      }
      setMapError(errorMessage)
    }
  }, [mapLoaded])


  const getMarkerIcon = (type: string, status: string) => {
    const baseUrl = 'https://maps.google.com/mapfiles/ms/icons/'
    
    switch (type) {
      case 'driver':
        return status === 'active' 
          ? `${baseUrl}green-dot.png`
          : `${baseUrl}blue-dot.png`
      case 'pickup':
        return `${baseUrl}yellow-dot.png`
      case 'dropoff':
        return `${baseUrl}red-dot.png`
      default:
        return `${baseUrl}purple-dot.png`
    }
  }

  const updateMapMarkers = useCallback(() => {
    console.log('[DEBUG] updateMapMarkers: Function called')
    if (!mapInstanceRef.current || !window.google) {
      console.log('[DEBUG] updateMapMarkers: Map instance or Google API not available')
      return
    }

    console.log('[DEBUG] updateMapMarkers: Starting marker update, trackingData length =', trackingData.length)

    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current.clear()

    const bounds = new window.google.maps.LatLngBounds()
    let hasValidLocations = false

    const filteredData = selectedDriver === 'all'
      ? trackingData
      : trackingData.filter(data => data.driver.id === selectedDriver)

    console.log('[DEBUG] updateMapMarkers: selectedDriver =', selectedDriver, 'filteredData length =', filteredData.length)

    if (filteredData.length === 0) {
      console.log('[DEBUG] updateMapMarkers: No data to display on map')
    }

    filteredData.forEach(data => {
      const { driver, booking } = data

      // Driver marker
      if (driver.current_latitude && driver.current_longitude) {
        console.log('[DEBUG] updateMapMarkers: Creating driver marker for', driver.full_name)
        const driverMarker = new window.google.maps.Marker({
          position: {
            lat: Number(driver.current_latitude),
            lng: Number(driver.current_longitude)
          },
          map: mapInstanceRef.current,
          icon: {
            url: getMarkerIcon('driver', driver.status),
            scaledSize: new window.google.maps.Size(32, 32),
          },
          title: `${driver.full_name} - ${driver.status}`,
          zIndex: 1000
        })

        const driverInfoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 12px; min-width: 250px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1e293b; font-size: 16px;">${driver.full_name}</h3>
              <div style="margin-bottom: 6px;">
                <span style="color: #64748b; font-size: 13px;">Status:</span>
                <span style="color: #10B981; font-weight: bold; margin-left: 4px;">${driver.status}</span>
              </div>
              <div style="margin-bottom: 6px;">
                <span style="color: #64748b; font-size: 13px;">Phone:</span>
                <span style="color: #2563eb; margin-left: 4px;">${driver.phone_no}</span>
              </div>
              ${driver.rating ? `<div style="margin-bottom: 8px;"><span style="color: #64748b; font-size: 13px;">Rating: ⭐ ${driver.rating}/5</span></div>` : ''}
              
              ${booking ? `
                <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
                  <div style="margin-bottom: 6px;"><span style="color: #64748b; font-size: 12px; font-weight: bold;">ACTIVE RIDE</span></div>
                  <div style="margin-bottom: 4px;"><span style="color: #64748b; font-size: 12px;">Customer:</span> <span style="color: #1e293b; font-weight: 500;">${booking.customer?.full_name || 'N/A'}</span></div>
                  <div style="margin-bottom: 4px;"><span style="color: #64748b; font-size: 12px;">From:</span> <span style="color: #1e293b;">${booking.pickup_address || 'N/A'}</span></div>
                  <div style="margin-bottom: 4px;"><span style="color: #64748b; font-size: 12px;">To:</span> <span style="color: #1e293b;">${booking.dropoff_address || 'N/A'}</span></div>
                  ${booking.fare_amount ? `<div style="margin-bottom: 4px;"><span style="color: #64748b; font-size: 12px;">Fare:</span> <span style="color: #10B981; font-weight: bold;">₹${booking.fare_amount}</span></div>` : ''}
                </div>
              ` : `
                <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px;">
                  <div style="color: #64748b; font-size: 12px;">Available for rides</div>
                </div>
              `}
            </div>
          `
        })

        driverMarker.addListener('click', () => {
          driverInfoWindow.open(mapInstanceRef.current, driverMarker)
        })

        markersRef.current.set(`driver-${driver.id}`, driverMarker)
        bounds.extend(driverMarker.getPosition()!)
        hasValidLocations = true
      }

      // Pickup marker
      if (booking?.pickup_latitude && booking?.pickup_longitude) {
        console.log('[DEBUG] updateMapMarkers: Creating pickup marker for booking', booking.id)
        const pickupMarker = new window.google.maps.Marker({
          position: {
            lat: Number(booking.pickup_latitude),
            lng: Number(booking.pickup_longitude)
          },
          map: mapInstanceRef.current,
          icon: {
            url: getMarkerIcon('pickup', 'active'),
            scaledSize: new window.google.maps.Size(24, 24),
          },
          title: `Pickup: ${booking.pickup_address}`,
          zIndex: 500
        })

        markersRef.current.set(`pickup-${booking.id}`, pickupMarker)
        bounds.extend(pickupMarker.getPosition()!)
        hasValidLocations = true
      }

      // Dropoff marker
      if (booking?.dropoff_latitude && booking?.dropoff_longitude) {
        console.log('[DEBUG] updateMapMarkers: Creating dropoff marker for booking', booking.id)
        const dropoffMarker = new window.google.maps.Marker({
          position: {
            lat: Number(booking.dropoff_latitude),
            lng: Number(booking.dropoff_longitude)
          },
          map: mapInstanceRef.current,
          icon: {
            url: getMarkerIcon('dropoff', 'active'),
            scaledSize: new window.google.maps.Size(24, 24),
          },
          title: `Dropoff: ${booking.dropoff_address}`,
          zIndex: 500
        })

        markersRef.current.set(`dropoff-${booking.id}`, dropoffMarker)
        bounds.extend(dropoffMarker.getPosition()!)
        hasValidLocations = true
      }
    })

    if (hasValidLocations && !bounds.isEmpty()) {
      mapInstanceRef.current.fitBounds(bounds)
      console.log('[DEBUG] updateMapMarkers: Fitted bounds to markers')
    } else if (trackingData.length === 0) {
      mapInstanceRef.current.setCenter({ lat: 28.6139, lng: 77.2090 })
      mapInstanceRef.current.setZoom(11)
      console.log('[DEBUG] updateMapMarkers: No valid locations, set default center')
    } else {
      console.log('[DEBUG] updateMapMarkers: No valid locations found')
    }
  }, [trackingData, selectedDriver])

  useEffect(() => {
    console.log('[DEBUG] useEffect: Initializing map and refreshing data')
    initializeMap()
    refreshData()
  }, [initializeMap, refreshData])

  useEffect(() => {
    console.log('[DEBUG] useEffect: mapLoaded =', mapLoaded, 'trackingData length =', trackingData.length, 'selectedDriver =', selectedDriver)
    if (mapLoaded && trackingData.length > 0) {
      console.log('[DEBUG] LiveMapView: selectedDriver changed to:', selectedDriver)
      updateMapMarkers()
    }
  }, [mapLoaded, trackingData, selectedDriver, updateMapMarkers])

  const handleRefresh = () => {
    refreshData()
  }

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  if (loading) {
    return (
      <Card className="h-96">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading live tracking...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="h-96">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-red-500">Error: {error}</p>
            <Button onClick={handleRefresh}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectedDriverData = selectedDriver === 'all'
    ? null
    : trackingData.find(data => data.driver.id === selectedDriver)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Navigation className="h-5 w-5 mr-2" />
            Live Map Tracking
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Select value={selectedDriver} onValueChange={setInternalSelectedDriver}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                {trackingData.map(data => (
                  <SelectItem key={data.driver.id} value={data.driver.id}>
                    {data.driver.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAutoRefresh}
              className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
            >
              <RotateCcw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
              Auto
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Tracking {trackingData.length} active rides</span>
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </CardHeader>

      {selectedDriverData && selectedDriverData.booking && (
        <div className="px-6 pb-4 border-b">
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">Active Ride Details</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <p className="text-xs text-blue-700 mb-1">Customer</p>
                <p className="font-medium text-blue-900">{selectedDriverData.booking.customer?.full_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-blue-700 mb-1">Status</p>
                <p className="font-medium text-blue-900 capitalize">{selectedDriverData.booking.status}</p>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-start space-x-2">
                <span className="text-yellow-600 mt-0.5">📍</span>
                <div>
                  <p className="text-xs text-blue-700">Pickup</p>
                  <p className="text-sm text-blue-900">{selectedDriverData.booking.pickup_address}</p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-red-600 mt-0.5">🎯</span>
                <div>
                  <p className="text-xs text-blue-700">Dropoff</p>
                  <p className="text-sm text-blue-900">{selectedDriverData.booking.dropoff_address}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              {selectedDriverData.booking.fare_amount && (
                <div>
                  <p className="text-blue-700">Fare</p>
                  <p className="font-medium text-blue-900">₹{selectedDriverData.booking.fare_amount}</p>
                </div>
              )}
              {selectedDriverData.booking.distance_km && (
                <div>
                  <p className="text-blue-700">Distance</p>
                  <p className="font-medium text-blue-900">{selectedDriverData.booking.distance_km} km</p>
                </div>
              )}
              <div>
                <p className="text-blue-700">Vehicle</p>
                <p className="font-medium text-blue-900">{selectedDriverData.vehicle?.type || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <CardContent className="p-0">
        <div
          ref={mapRef}
          className="w-full h-96 rounded-b-lg"
          style={{ minHeight: '400px', position: 'relative' }}
        >
          {!mapLoaded && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading Google Maps...</p>
              </div>
            </div>
          )}
          
          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50">
              <div className="text-center p-6 bg-white rounded-lg shadow-lg max-w-md">
                <div className="text-red-500 text-lg mb-2">⚠️</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Loading Error</h3>
                <p className="text-sm text-gray-600 mb-4">{mapError}</p>
                <button
                  onClick={() => {
                    setMapError(null)
                    setMapLoaded(false)
                    initializeMap()
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                >
                  Retry Loading Map
                </button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}