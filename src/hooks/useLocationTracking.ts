import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface LocationData {
  lat: number
  lng: number
  address?: string
  timestamp?: number
}

interface UseLocationTrackingReturn {
  currentLocation: LocationData | null
  isTracking: boolean
  error: string | null
  startTracking: () => Promise<void>
  stopTracking: () => void
  updateLocation: (lat: number, lng: number) => Promise<void>
}

export const useLocationTracking = (driverId?: string): UseLocationTrackingReturn => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch current location from backend
  const fetchCurrentLocation = useCallback(async () => {
    if (!driverId) return

    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('current_latitude, current_longitude, last_location_update')
        .eq('id', driverId)
        .single()

      if (error) throw error

      if (data.current_latitude && data.current_longitude) {
        const locationData: LocationData = {
          lat: data.current_latitude,
          lng: data.current_longitude,
          timestamp: data.last_location_update ? new Date(data.last_location_update).getTime() : Date.now()
        }
        setCurrentLocation(locationData)
      }
    } catch (err) {
      console.error('Error fetching current location:', err)
    }
  }, [driverId])

  // Update driver location in database
  const updateDriverLocation = useCallback(async (lat: number, lng: number) => {
    if (!driverId) {
      console.log('[DEBUG] updateDriverLocation: No driverId provided')
      return
    }

    console.log('[DEBUG] updateDriverLocation: Updating location for driverId:', driverId, 'lat:', lat, 'lng:', lng)

    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          current_latitude: lat,
          current_longitude: lng,
          last_location_update: new Date().toISOString()
        })
        .eq('id', driverId)

      if (error) {
        console.error('[DEBUG] updateDriverLocation: Supabase error:', error)
        throw error
      }

      console.log('[DEBUG] updateDriverLocation: Successfully updated location')
    } catch (err) {
      console.error('[DEBUG] updateDriverLocation: Error updating driver location:', err)
      setError(err instanceof Error ? err.message : 'Failed to update location')
    }
  }, [driverId])

  // Get current position once
  const getCurrentPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser. Please use a modern browser with location support.'))
        return
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        (err) => {
          if (err instanceof GeolocationPositionError) {
            switch (err.code) {
              case err.PERMISSION_DENIED:
                reject(new Error('Location permission is blocked. Please enable location access in your browser settings (address bar → location icon → Allow) and try again.'))
                break
              case err.POSITION_UNAVAILABLE:
                reject(new Error('Location information is unavailable. Please check your device GPS/WiFi settings and ensure you are in an area with good signal.'))
                break
              case err.TIMEOUT:
                reject(new Error('Location request timed out. Please try again in an area with better GPS signal.'))
                break
              default:
                reject(new Error('An unknown error occurred while requesting location'))
            }
          } else {
            reject(err)
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      )
    })
  }, [])

  // Start location tracking
  const startTracking = useCallback(async () => {
    console.log('[DEBUG] startTracking: Starting location tracking for driverId:', driverId)

    try {
      setError(null)

      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser. Please use a modern browser with location support.')
      }

      // Check permission status first
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          if (permission.state === 'denied') {
            throw new Error('Location permission is blocked. Please enable location access in your browser settings (address bar → location icon → Allow) and try again.')
          }
        } catch (permErr) {
          console.warn('[DEBUG] startTracking: Could not check permissions:', permErr)
        }
      }

      // Request permission and get initial position
      console.log('[DEBUG] startTracking: Getting current position')
      const position = await getCurrentPosition()
      const locationData: LocationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        timestamp: position.timestamp
      }

      console.log('[DEBUG] startTracking: Got position, updating location')
      setCurrentLocation(locationData)
      await updateDriverLocation(locationData.lat, locationData.lng)

      // Start watching position
      console.log('[DEBUG] startTracking: Starting watchPosition')
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          console.log('[DEBUG] watchPosition: New position received')
          const newLocationData: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: position.timestamp
          }

          setCurrentLocation(newLocationData)
          updateDriverLocation(newLocationData.lat, newLocationData.lng)
        },
        (err) => {
          console.error('[DEBUG] watchPosition: Error watching position:', err)

          let errorMessage = 'Failed to track location'
          if (err instanceof GeolocationPositionError) {
            switch (err.code) {
              case err.PERMISSION_DENIED:
                errorMessage = 'Location permission was revoked. Please re-enable location access to continue tracking.'
                break
              case err.POSITION_UNAVAILABLE:
                errorMessage = 'Location signal lost. Please check your GPS/WiFi connection.'
                break
              case err.TIMEOUT:
                errorMessage = 'Location tracking timed out. Retrying...'
                break
            }
          }

          setError(errorMessage)
          setIsTracking(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000 // Update every 5 seconds minimum
        }
      )

      // Also set up interval updates as backup
      console.log('[DEBUG] startTracking: Setting up interval updates')
      intervalRef.current = setInterval(async () => {
        try {
          console.log('[DEBUG] interval update: Getting position')
          const position = await getCurrentPosition()
          const locationData: LocationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: position.timestamp
          }

          setCurrentLocation(locationData)
          await updateDriverLocation(locationData.lat, locationData.lng)
        } catch (err) {
          console.error('[DEBUG] interval update: Error in interval update:', err)
        }
      }, 10000) // Update every 10 seconds as backup

      setIsTracking(true)
    } catch (err) {
      console.error('Error starting location tracking:', err)
      setError(err instanceof Error ? err.message : 'Failed to start location tracking')
      setIsTracking(false)
    }
  }, [driverId, getCurrentPosition, updateDriverLocation])

  // Stop location tracking
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setIsTracking(false)
    setError(null)
  }, [])

  // Manual location update
  const updateLocation = useCallback(async (lat: number, lng: number) => {
    const locationData: LocationData = {
      lat,
      lng,
      timestamp: Date.now()
    }

    setCurrentLocation(locationData)
    await updateDriverLocation(lat, lng)
  }, [updateDriverLocation])

  // Fetch location from backend on mount
  useEffect(() => {
    if (driverId && driverId !== 'all') {
      fetchCurrentLocation()
    }
  }, [fetchCurrentLocation, driverId])

  // Set up real-time subscription for location updates
  useEffect(() => {
    if (!driverId || driverId === 'all') return

    console.log('[DEBUG] Setting up real-time subscription for driverId:', driverId)

    const channel = supabase
      .channel(`driver-location-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'drivers',
          filter: `id=eq.${driverId}`
        },
        (payload) => {
          console.log('[DEBUG] Real-time update received for driverId:', driverId, payload)
          if (payload.new.current_latitude && payload.new.current_longitude) {
            const locationData: LocationData = {
              lat: payload.new.current_latitude,
              lng: payload.new.current_longitude,
              timestamp: payload.new.last_location_update ? new Date(payload.new.last_location_update).getTime() : Date.now()
            }
            setCurrentLocation(locationData)
          }
        }
      )
      .subscribe()

    return () => {
      console.log('[DEBUG] Removing real-time subscription for driverId:', driverId)
      supabase.removeChannel(channel)
    }
  }, [driverId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking()
    }
  }, [stopTracking])

  return {
    currentLocation,
    isTracking,
    error,
    startTracking,
    stopTracking,
    updateLocation
  }
}