import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { MapPin, AlertCircle, CheckCircle, XCircle, HelpCircle } from 'lucide-react'

interface LocationPermissionManagerProps {
  onPermissionChange?: (granted: boolean) => void
  className?: string
}

export const LocationPermissionManager: React.FC<LocationPermissionManagerProps> = ({
  onPermissionChange,
  className = ''
}) => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkPermissionStatus()
  }, [])

  useEffect(() => {
    if (permissionStatus && onPermissionChange) {
      onPermissionChange(permissionStatus === 'granted')
    }
  }, [permissionStatus, onPermissionChange])

  // Manual permission status refresh
  const refreshPermissionStatus = () => {
    checkPermissionStatus()
  }

  const checkPermissionStatus = async () => {
    try {
      setError(null)

      if (!navigator.geolocation) {
        setError('Geolocation is not supported by this browser')
        return
      }

      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' })
        setPermissionStatus(permission.state)

        permission.addEventListener('change', () => {
          setPermissionStatus(permission.state)
        })
      } else {
        // Fallback for browsers that don't support permissions API
        setPermissionStatus('prompt')
      }
    } catch (err) {
      console.error('Error checking permission status:', err)
      setError('Failed to check location permission status')
    }
  }

  const requestPermission = async () => {
    try {
      setError(null)

      if (!navigator.geolocation) {
        setError('Geolocation is not supported by this browser')
        setPermissionStatus('denied')
        return
      }

      // First check current permission status
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' })
          if (permission.state === 'denied') {
            setError('Location permission is blocked. Please enable location access in your browser settings and click "Request Permission Again".')
            setPermissionStatus('denied')
            return
          }
        } catch (permErr) {
          console.warn('Could not query permissions:', permErr)
        }
      }

      // Request permission by attempting to get current position
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        })
      })

      // If successful, permission was granted
      setPermissionStatus('granted')
    } catch (err) {
      console.error('Error requesting permission:', err)

      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setPermissionStatus('denied')
            setError('Location permission is blocked. Please enable location access in your browser settings (address bar → location icon → Allow) and try again.')
            break
          case err.POSITION_UNAVAILABLE:
            setError('Location information is unavailable. Please check your device GPS/WiFi settings.')
            break
          case err.TIMEOUT:
            setError('Location request timed out. Please try again.')
            break
          default:
            setError('An unknown error occurred while requesting location')
        }
      } else {
        setError('Failed to request location permission')
      }
    }
  }

  const getPermissionIcon = () => {
    switch (permissionStatus) {
      case 'granted':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'denied':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'prompt':
        return <HelpCircle className="h-5 w-5 text-yellow-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />
    }
  }

  const getPermissionBadge = () => {
    switch (permissionStatus) {
      case 'granted':
        return <Badge className="bg-green-100 text-green-800">Allowed</Badge>
      case 'denied':
        return <Badge variant="destructive">Blocked</Badge>
      case 'prompt':
        return <Badge className="bg-yellow-100 text-yellow-800">Needs Permission</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getStatusMessage = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'Location access is enabled. You can now start location tracking.'
      case 'denied':
        return 'Location access is blocked. Please enable location permissions in your browser settings to use location tracking.'
      case 'prompt':
        return 'Location permission is required to use location tracking features.'
      default:
        return 'Unable to determine location permission status.'
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center">
          <MapPin className="h-5 w-5 mr-2" />
          Location Permissions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Permission Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center space-x-2">
            {getPermissionIcon()}
            <span className="text-sm font-medium">Permission Status</span>
          </div>
          {getPermissionBadge()}
        </div>

        {/* Status Message */}
        <div className="text-sm text-muted-foreground">
          {getStatusMessage()}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        {permissionStatus !== 'granted' && (
          <div className="space-y-2">
            <Button
              onClick={requestPermission}
              className="w-full"
              variant={permissionStatus === 'denied' ? 'outline' : 'default'}
            >
              {permissionStatus === 'denied' ? 'Request Permission Again' : 'Grant Location Access'}
            </Button>
            {permissionStatus === 'denied' && (
              <Button
                onClick={refreshPermissionStatus}
                variant="ghost"
                size="sm"
                className="w-full text-xs"
              >
                Check Permission Status
              </Button>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>How to enable location permissions:</strong></p>
          {permissionStatus === 'denied' ? (
            <>
              <p>• Click the location icon 🔒 in your browser's address bar</p>
              <p>• Select "Allow" or "Always Allow" for location access</p>
              <p>• Refresh the page and click "Request Permission Again"</p>
              <p>• Or go to browser settings → Privacy → Location → Allow</p>
            </>
          ) : (
            <>
              <p>• Location tracking requires browser permission</p>
              <p>• Click "Grant Location Access" to enable tracking</p>
              <p>• Allow location access when prompted by browser</p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}