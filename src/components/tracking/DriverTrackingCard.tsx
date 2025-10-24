import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Clock, Phone, Star, Navigation, Car, User } from 'lucide-react'

interface DriverTrackingCardProps {
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
    status: string
  }
  vehicle?: {
    make?: string
    model?: string
    type?: string
    license_plate?: string
  }
  onViewDetails: (driverId: string) => void
  onCallDriver: (phone: string) => void
}

export const DriverTrackingCard: React.FC<DriverTrackingCardProps> = ({
  driver,
  booking,
  vehicle,
  onViewDetails,
  onCallDriver
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'busy':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'offline':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatLastSeen = () => {
    // Calculate based on actual last location update if available
    if (driver.current_latitude && driver.current_longitude) {
      return 'Just now'
    }
    return 'Recently'
  }

  const handleTrackClick = () => {
    // Call the parent component's view details function
    onViewDetails(driver.id)
  }

  const handleCallClick = () => {
    // Call the parent component's call function
    onCallDriver(driver.phone_no)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const isOnline = driver.current_latitude && driver.current_longitude

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary/20">
      <CardContent className="p-4">
        {/* Driver Header - Matching the image design */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* Driver Avatar */}
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
              <User className="h-5 w-5 text-primary" />
            </div>

            {/* Driver Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold text-gray-900 text-sm">{driver.full_name}</h4>
                <span className="text-lg font-bold text-gray-500">0</span>
              </div>
              <div className="flex items-center space-x-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                <span className="text-xs text-gray-600">Last seen: {formatLastSeen()}</span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <Badge className={`${getStatusColor(driver.status)} font-semibold px-2 py-1`}>
            ACTIVE
          </Badge>
        </div>

        {/* Current Ride Status - Only show if there's an active booking */}
        {booking && (
          <div className="mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-blue-900">Current Ride</span>
              <Badge className="bg-blue-100 text-blue-800 text-xs">
                {booking.status}
              </Badge>
            </div>
            {booking.pickup_address && (
              <div className="text-xs text-blue-700 truncate">
                📍 {booking.pickup_address}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons - Matching the image exactly */}
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs font-medium border-gray-300 hover:bg-gray-50 hover:border-primary"
            onClick={handleTrackClick}
          >
            <MapPin className="h-3 w-3 mr-1" />
            Track
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs font-medium border-gray-300 hover:bg-gray-50 hover:border-primary"
            onClick={handleCallClick}
          >
            <Phone className="h-3 w-3 mr-1" />
            Call
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}