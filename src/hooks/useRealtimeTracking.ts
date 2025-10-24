import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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

interface VehicleData {
  make?: string
  model?: string
  type?: string
  license_plate?: string
}

export const useRealtimeTracking = () => {
  const [trackingData, setTrackingData] = useState<TrackingData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchTrackingData = useCallback(async () => {
    try {
      setError(null)

      // Fetch drivers with user data from unified view
      const { data: driversData, error: driversError } = await supabase
        .from('drivers_with_user_info')
        .select(`
          id,
          status,
          current_latitude,
          current_longitude,
          rating,
          full_name,
          phone_no,
          profile_picture_url
        `)
        .eq('status', 'active')

      if (driversError) throw driversError

      // Fetch active bookings with vehicle details and customer info
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          driver_id,
          pickup_address,
          dropoff_address,
          pickup_latitude,
          pickup_longitude,
          dropoff_latitude,
          dropoff_longitude,
          status,
          vehicle_id,
          fare_amount,
          distance_km,
          vehicles (
            make,
            model,
            type,
            license_plate
          ),
          users (
            full_name,
            phone_no
          )
        `)
        .in('status', ['accepted', 'started'])

      if (bookingsError) throw bookingsError

      // Combine driver and booking data
      const combinedData: TrackingData[] = driversData.map(driver => {
        const driverBooking = bookingsData.find(booking => booking.driver_id === driver.id)

        return {
          driver: {
            id: driver.id,
            full_name: driver.full_name || 'Unknown Driver',
            status: driver.status,
            current_latitude: driver.current_latitude,
            current_longitude: driver.current_longitude,
            phone_no: driver.phone_no || '',
            rating: driver.rating
          },
          booking: driverBooking ? {
            id: driverBooking.id,
            pickup_address: driverBooking.pickup_address,
            dropoff_address: driverBooking.dropoff_address,
            pickup_latitude: driverBooking.pickup_latitude,
            pickup_longitude: driverBooking.pickup_longitude,
            dropoff_latitude: driverBooking.dropoff_latitude,
            dropoff_longitude: driverBooking.dropoff_longitude,
            status: driverBooking.status,
            fare_amount: driverBooking.fare_amount,
            distance_km: driverBooking.distance_km,
            customer: driverBooking.users && Array.isArray(driverBooking.users) && driverBooking.users.length > 0 ? {
              full_name: driverBooking.users[0].full_name,
              phone_no: driverBooking.users[0].phone_no
            } : undefined
          } : undefined,
          vehicle: driverBooking?.vehicles ? {
            make: (driverBooking.vehicles as VehicleData)?.make,
            model: (driverBooking.vehicles as VehicleData)?.model,
            type: (driverBooking.vehicles as VehicleData)?.type,
            license_plate: (driverBooking.vehicles as VehicleData)?.license_plate
          } : undefined
        }
      })

      setTrackingData(combinedData)
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error fetching tracking data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch tracking data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Set up real-time subscriptions
  useEffect(() => {
    fetchTrackingData()

    // Set up periodic refresh every 10 seconds to ensure updates
    const intervalId = setInterval(() => {
      fetchTrackingData()
    }, 10000)

    // Subscribe to driver location updates
    const driversChannel = supabase
      .channel('drivers-tracking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drivers',
          filter: 'status=eq.active'
        },
        (payload) => {
          fetchTrackingData()
        }
      )
      .subscribe()

    // Subscribe to booking updates
    const bookingsChannel = supabase
      .channel('bookings-tracking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          fetchTrackingData()
        }
      )
      .subscribe()

    // Subscribe to user updates (for driver profile changes)
    const usersChannel = supabase
      .channel('users-tracking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          fetchTrackingData()
        }
      )
      .subscribe()

    return () => {
      clearInterval(intervalId)
      supabase.removeChannel(driversChannel)
      supabase.removeChannel(bookingsChannel)
      supabase.removeChannel(usersChannel)
    }
  }, [fetchTrackingData])

  const refreshData = useCallback(() => {
    setLoading(true)
    fetchTrackingData()
  }, [fetchTrackingData])

  const updateDriverLocation = useCallback(async (driverId: string, latitude: number, longitude: number) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          last_location_update: new Date().toISOString()
        })
        .eq('id', driverId)

      if (error) throw error

      // Refresh tracking data to reflect the location update
      fetchTrackingData()
    } catch (err) {
      console.error('Error updating driver location:', err)
      setError(err instanceof Error ? err.message : 'Failed to update location')
    }
  }, [fetchTrackingData])

  const getDriverById = useCallback((driverId: string) => {
    return trackingData.find(data => data.driver.id === driverId)
  }, [trackingData])

  const getActiveDriversCount = useCallback(() => {
    return trackingData.filter(data => data.driver.status === 'active').length
  }, [trackingData])

  const getOnRideDriversCount = useCallback(() => {
    return trackingData.filter(data => data.booking?.status === 'started').length
  }, [trackingData])

  return {
    trackingData,
    loading,
    error,
    lastUpdate,
    refreshData,
    updateDriverLocation,
    getDriverById,
    getActiveDriversCount,
    getOnRideDriversCount
  }
}