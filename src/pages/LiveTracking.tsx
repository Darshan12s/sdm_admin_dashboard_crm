
import React, { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Users, Car, MapPin, Activity, Phone, Settings, RotateCcw, Navigation } from 'lucide-react'
import { LiveMapView } from '@/components/tracking/LiveMapView'
import { DriverTrackingCard } from '@/components/tracking/DriverTrackingCard'
import { DriverLocationTracker } from '@/components/tracking/DriverLocationTracker'
import { useRealtimeTracking } from '@/hooks/useRealtimeTracking'
import { toast } from 'sonner'

export const LiveTracking: React.FC = () => {
  const {
    trackingData,
    loading,
    error,
    lastUpdate,
    refreshData,
    getActiveDriversCount,
    getOnRideDriversCount
  } = useRealtimeTracking()

  const [selectedDriver, setSelectedDriver] = useState<string>('all')

  // Debug log for selectedDriver changes
  useEffect(() => {
    console.log('[DEBUG] LiveTracking: selectedDriver changed to:', selectedDriver)
  }, [selectedDriver])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showOnlyActive, setShowOnlyActive] = useState(false)

  const handleViewDetails = useCallback((driverId: string) => {
    console.log('[DEBUG] handleViewDetails called with driverId:', driverId)
    const driver = trackingData.find(data => data.driver.id === driverId)
    if (driver) {
      console.log('[DEBUG] Setting selectedDriver to:', driverId)
      setSelectedDriver(driverId)
      toast.info(`Tracking ${driver.driver.full_name}`)
    } else {
      console.log('[DEBUG] Driver not found for id:', driverId)
    }
  }, [trackingData])

  const handleCallDriver = useCallback((phone: string) => {
    // Open phone dialer
    window.open(`tel:${phone}`)
  }, [])

  const handleRefresh = useCallback(() => {
    refreshData()
    toast.success('Tracking data refreshed')
  }, [refreshData])

  const filteredTrackingData = trackingData.filter(data => {
    if (showOnlyActive) {
      return data.booking && ['accepted', 'started'].includes(data.booking.status)
    }
    return true
  })

  const activeDriversCount = getActiveDriversCount()
  const onRideDriversCount = getOnRideDriversCount()
  const totalDriversCount = trackingData.length
  const trackingDriversCount = trackingData.filter(data => data.driver.current_latitude && data.driver.current_longitude).length

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse"></div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 h-96 bg-muted rounded-lg animate-pulse"></div>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Live Tracking</h1>
          <p className="text-muted-foreground">Real-time location of active drivers</p>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-destructive mb-4">Error loading tracking data</div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={handleRefresh}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Tracking</h1>
          <p className="text-muted-foreground">Real-time location of active drivers and vehicles</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">Auto refresh</Label>
          </div>
          <Button variant="outline" onClick={handleRefresh}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover-scale">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-green-100 rounded-lg mr-4">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Available Drivers</p>
              <p className="text-2xl font-bold">{activeDriversCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-blue-100 rounded-lg mr-4">
              <Car className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">On Ride</p>
              <p className="text-2xl font-bold">{onRideDriversCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-purple-100 rounded-lg mr-4">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Active</p>
              <p className="text-2xl font-bold">{totalDriversCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-orange-100 rounded-lg mr-4">
              <MapPin className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Live Updates</p>
              <p className="text-2xl font-bold">{autoRefresh ? 'ON' : 'OFF'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-scale">
          <CardContent className="flex items-center p-6">
            <div className="p-2 bg-green-100 rounded-lg mr-4">
              <Navigation className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Location Tracking</p>
              <p className="text-2xl font-bold text-green-600">{trackingDriversCount}</p>
              <p className="text-xs text-muted-foreground">of {totalDriversCount} drivers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Live Map */}
        <div className="lg:col-span-3">
          <LiveMapView selectedDriver={selectedDriver} />
        </div>

        {/* Driver List Sidebar */}
        <div className="space-y-4">
          {/* Location Tracking Controls */}
          <DriverLocationTracker driverId={selectedDriver} driverName={selectedDriver === 'all' ? 'All Drivers' : trackingData.find(d => d.driver.id === selectedDriver)?.driver.full_name || 'Selected Driver'} />

          {/* Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Driver Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="flex items-center space-x-2">
                <Switch
                  id="show-active"
                  checked={showOnlyActive}
                  onCheckedChange={setShowOnlyActive}
                />
                <Label htmlFor="show-active" className="text-sm">Only active rides</Label>
              </div>

              <div className="text-xs text-muted-foreground">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
            </CardContent>
          </Card>

          {/* Driver Cards */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredTrackingData.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No active drivers found</p>
                </CardContent>
              </Card>
            ) : (
              filteredTrackingData.map((data) => (
                <DriverTrackingCard
                  key={data.driver.id}
                  driver={data.driver}
                  booking={data.booking}
                  vehicle={data.vehicle}
                  onViewDetails={handleViewDetails}
                  onCallDriver={handleCallDriver}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
