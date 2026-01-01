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
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const googleRef = useRef<typeof google | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new Map())
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const updateMapMarkersRef = useRef<() => void>(() => {})

  const { trackingData, loading, error, lastUpdate, refreshData } = useRealtimeTracking()

  const [internalSelectedDriver, setInternalSelectedDriver] = useState<string>('all')
  const selectedDriver = propSelectedDriver || internalSelectedDriver
  const [mapLoaded, setMapLoaded] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [initializationAttempted, setInitializationAttempted] = useState(false)

  const selectedDriverData = selectedDriver === 'all'
    ? null
    : trackingData.find(data => data.driver.id === selectedDriver)

  const initializeMap = useCallback(async () => {
    let mounted = true;
    try {
      // Reset states
      setMapError(null)
      setMapLoaded(false)

      // Validate requirements
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('Google Maps API key is missing')
      }

      if (!mapRef.current) {
        throw new Error('Map container not found')
      }

      // Clean up any existing instances
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null
      }

      // Create and configure the loader
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['places', 'geometry']
      })

      // Load Google Maps API
      await loader.load()

      if (!window.google || !window.google.maps) {
        throw new Error('Failed to load Google Maps API')
      }

      // Create map instance
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 13.1986, lng: 77.7066 },
        zoom: 15,
        mapTypeControl: true,
        mapTypeId: google.maps.MapTypeId.HYBRID,
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

      // Store map instance
      mapInstanceRef.current = map

      // Ensure proper rendering
      window.google.maps.event.addListenerOnce(map, 'idle', () => {
        window.google.maps.event.trigger(map, 'resize');
      });

      // Initialize services
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

      // Update state
      setMapLoaded(true)
      setInitializationAttempted(true)

      // Update markers if we have data
      if (mounted) {
        if (updateMapMarkersRef.current) {
          updateMapMarkersRef.current()
        }
      }
    } catch (error) {
      console.error('[Map Error]:', error)
      let message = 'Failed to load map'
      if (error instanceof Error) {
        message = error.message
      }
      if (mounted) {
        setMapError(message)
        setInitializationAttempted(false)
      }
    }

    return () => {
      mounted = false;
    }
  }, [])
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
    if (!mapInstanceRef.current || !window.google || !mapLoaded) {
      return
    }

    // Clear existing markers and polylines
    markersRef.current.forEach(marker => marker.setMap(null))
    markersRef.current.clear()
    polylinesRef.current.forEach(polyline => polyline.setMap(null))
    polylinesRef.current.clear()

    const bounds = new window.google.maps.LatLngBounds()
    let hasValidLocations = false

    const filteredData = selectedDriver === 'all'
      ? trackingData
      : trackingData.filter(data => data.driver.id === selectedDriver)

    filteredData.forEach(data => {
      const { driver, booking } = data

      // Add driver marker
      if (driver.current_latitude && driver.current_longitude) {
        const position = {
          lat: Number(driver.current_latitude),
          lng: Number(driver.current_longitude)
        }

        const marker = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          icon: {
            url: getMarkerIcon('driver', driver.status),
            scaledSize: new window.google.maps.Size(32, 32)
          },
          title: driver.full_name
        })

        markersRef.current.set(`driver-${driver.id}`, marker)
        bounds.extend(position)
        hasValidLocations = true
      }

      // Add booking markers and route if available
      if (booking) {
        if (booking.pickup_latitude && booking.pickup_longitude) {
          const position = {
            lat: Number(booking.pickup_latitude),
            lng: Number(booking.pickup_longitude)
          }

          const marker = new window.google.maps.Marker({
            position,
            map: mapInstanceRef.current,
            icon: {
              url: getMarkerIcon('pickup', 'active'),
              scaledSize: new window.google.maps.Size(24, 24)
            },
            title: 'Pickup'
          })

          markersRef.current.set(`pickup-${booking.id}`, marker)
          bounds.extend(position)
          hasValidLocations = true
        }

        if (booking.dropoff_latitude && booking.dropoff_longitude) {
          const position = {
            lat: Number(booking.dropoff_latitude),
            lng: Number(booking.dropoff_longitude)
          }

          const marker = new window.google.maps.Marker({
            position,
            map: mapInstanceRef.current,
            icon: {
              url: getMarkerIcon('dropoff', 'active'),
              scaledSize: new window.google.maps.Size(24, 24)
            },
            title: 'Dropoff'
          })

          markersRef.current.set(`dropoff-${booking.id}`, marker)
          bounds.extend(position)
          hasValidLocations = true
        }

        // Draw route if we have both pickup and dropoff
        if (booking.pickup_latitude && booking.pickup_longitude &&
            booking.dropoff_latitude && booking.dropoff_longitude) {
          directionsServiceRef.current?.route({
            origin: {
              lat: Number(booking.pickup_latitude),
              lng: Number(booking.pickup_longitude)
            },
            destination: {
              lat: Number(booking.dropoff_latitude),
              lng: Number(booking.dropoff_longitude)
            },
            travelMode: google.maps.TravelMode.DRIVING
          }, (response, status) => {
            if (status === 'OK' && response) {
              const polyline = new google.maps.Polyline({
                path: response.routes[0].overview_path,
                geodesic: true,
                strokeColor: '#3B82F6',
                strokeOpacity: 1.0,
                strokeWeight: 4
              })
              polyline.setMap(mapInstanceRef.current)
              polylinesRef.current.set(`route-${booking.id}`, polyline)
            }
          })
        }
      }
    })

    // Adjust map view
    if (hasValidLocations && !bounds.isEmpty()) {
      mapInstanceRef.current.fitBounds(bounds)
    } else {
      // Default view of Bengaluru Airport
      mapInstanceRef.current.setCenter({ lat: 13.1986, lng: 77.7066 })
      mapInstanceRef.current.setZoom(15)
      mapInstanceRef.current.setMapTypeId(google.maps.MapTypeId.HYBRID)
    }
  }, [trackingData, selectedDriver, mapLoaded])

  // Keep reference to latest updateMapMarkers
  useEffect(() => {
    updateMapMarkersRef.current = updateMapMarkers
  }, [updateMapMarkers])

  // Initialize map on mount
  useEffect(() => {
    initializeMap()
  }, [initializeMap])

  // Update markers when data changes
  useEffect(() => {
    if (mapLoaded && trackingData.length > 0) {
      updateMapMarkers()
    }
  }, [mapLoaded, trackingData, updateMapMarkers])

  // Auto-refresh handling
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshData, 30000) // 30 seconds
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshData])

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
            <Button onClick={refreshData}>Retry</Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-grow flex flex-col">
        <CardHeader className="flex-none pb-3">
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
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? 'bg-green-50 border-green-200' : ''}
              >
                <RotateCcw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto
              </Button>
              <Button variant="outline" size="sm" onClick={refreshData}>
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

        <CardContent className="flex-grow p-0 relative min-h-[600px]">
            <div
              ref={mapContainerRef}
              className="absolute inset-0 bg-gray-50 rounded-b-lg overflow-hidden"
              style={{ display: 'flex', flexDirection: 'column' }}
          >
              <div
                ref={mapRef}
                id="google-map-container"
                className="flex-grow relative"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '600px'
                }}
              />
            {!mapLoaded && !mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 backdrop-blur-sm">
                <div className="text-center p-6 bg-white rounded-lg shadow-sm">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
                  <p className="text-base font-medium text-gray-900 mb-1">Loading Google Maps</p>
                  <p className="text-sm text-gray-600">Please wait while we initialize the map...</p>
                </div>
              </div>
            )}
            
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <div className="text-center p-8 max-w-md">
                  <div className="text-red-500 text-2xl mb-4">⚠️</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">Unable to Load Map</h3>
                  <p className="text-base text-gray-600 mb-6">{mapError}</p>
                  <p className="text-sm text-gray-500 mb-6">Please verify your internet connection and try again.</p>
                  <button
                    onClick={() => {
                      setMapError(null)
                      setInitializationAttempted(false)
                      setMapLoaded(false)
                      setTimeout(initializeMap, 1000)
                    }}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-base font-medium shadow-sm transition-colors"
                  >
                    Retry Loading Map
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}