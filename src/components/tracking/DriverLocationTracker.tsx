import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MapPin, Navigation, Play, Square, AlertCircle, CheckCircle } from 'lucide-react'
import { useLocationTracking } from '@/hooks/useLocationTracking'
import { LocationPermissionManager } from './LocationPermissionManager'
import { toast } from 'sonner'

interface DriverLocationTrackerProps {
  driverId: string
  driverName?: string
  className?: string
}

export const DriverLocationTracker: React.FC<DriverLocationTrackerProps> = ({
  driverId,
  driverName = 'Driver',
  className = ''
}) => {
  const { currentLocation, isTracking, error, startTracking, stopTracking } = useLocationTracking(driverId)

  // Only track if a specific driver is selected (not 'all')
  const canTrack = driverId && driverId !== 'all'
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null)
  const [hasPermission, setHasPermission] = useState(false)

  // Handle permission changes
  const handlePermissionChange = (granted: boolean) => {
    setHasPermission(granted)
  }

  // Check geolocation permission status
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (!navigator.geolocation) {
          setPermissionStatus('denied')
          setHasPermission(false)
          return
        }

        if ('permissions' in navigator) {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          setPermissionStatus(permission.state)
          setHasPermission(permission.state === 'granted')

          permission.addEventListener('change', () => {
            setPermissionStatus(permission.state)
            setHasPermission(permission.state === 'granted')
          })
        } else {
          // Fallback for browsers that don't support permissions API
          setPermissionStatus('prompt')
          setHasPermission(false)
        }
      } catch (err) {
        console.error('Error checking geolocation permission:', err)
        setPermissionStatus('denied')
        setHasPermission(false)
      }
    }

    checkPermission()
  }, [])

  // Show toast notifications for tracking status changes
  useEffect(() => {
    if (isTracking) {
      toast.success('Location tracking started', {
        description: 'Your location is now being shared with the system'
      })
    }
  }, [isTracking])

  useEffect(() => {
    if (error) {
      toast.error('Location tracking error', {
        description: error
      })
    }
  }, [error])

  const handleStartTracking = async () => {
    try {
      await startTracking()
    } catch (err) {
      console.error('Failed to start tracking:', err)
    }
  }

  const handleStopTracking = () => {
    stopTracking()
    toast.info('Location tracking stopped', {
      description: 'Your location is no longer being shared'
    })
  }

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Allowed</Badge>
      case 'denied':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Blocked</Badge>
      case 'prompt':
        return <Badge variant="secondary">Asking Permission</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  // Debug function to help troubleshoot issues
  const logDebugInfo = () => {
    console.log('🔍 DEBUG: Location Permission Status:', {
      permissionStatus,
      hasPermission,
      isTracking,
      error,
      geolocationSupported: !!navigator.geolocation,
      permissionsAPI: 'permissions' in navigator
    })
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Navigation className="h-5 w-5 mr-2" />
            Location Tracking
          </div>
          {getPermissionBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Tracking Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="text-sm font-medium">
              {isTracking ? 'Tracking Active' : 'Tracking Inactive'}
            </span>
          </div>
          <Badge variant={isTracking ? 'default' : 'secondary'}>
            {isTracking ? 'LIVE' : 'OFF'}
          </Badge>
        </div>

        {/* Current Location Info */}
        {currentLocation && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Current Location</span>
            </div>
            <div className="text-xs text-blue-700 space-y-1">
              <div>Lat: {currentLocation.lat.toFixed(6)}</div>
              <div>Lng: {currentLocation.lng.toFixed(6)}</div>
              {currentLocation.timestamp && (
                <div>
                  Updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Permission Manager (show if permission not granted) */}
        {permissionStatus !== 'granted' && (
          <LocationPermissionManager onPermissionChange={handlePermissionChange} />
        )}

        {/* Action Buttons */}
        {canTrack && (
          <div className="flex space-x-2">
            {!isTracking ? (
              <Button
                onClick={handleStartTracking}
                className="flex-1"
                disabled={!hasPermission || permissionStatus === 'denied'}
              >
                <Play className="h-4 w-4 mr-2" />
                Start Tracking
              </Button>
            ) : (
              <Button
                onClick={handleStopTracking}
                variant="destructive"
                className="flex-1"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Tracking
              </Button>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Location updates every 5-10 seconds</p>
          <p>• High accuracy mode enabled</p>
          <p>• Works only with location permission granted</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={logDebugInfo}
            className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
          >
            Debug Info (Check Console)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}