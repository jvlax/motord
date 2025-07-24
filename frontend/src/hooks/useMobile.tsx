import { useState, useEffect } from 'react'

interface MobileInfo {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  screenWidth: number
  screenHeight: number
  isTouchDevice: boolean
  orientation: 'portrait' | 'landscape'
}

export const useMobile = (): MobileInfo => {
  const [mobileInfo, setMobileInfo] = useState<MobileInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    screenWidth: 0,
    screenHeight: 0,
    isTouchDevice: false,
    orientation: 'portrait'
  })

  useEffect(() => {
    const updateMobileInfo = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      
      // Mobile: < 768px (Tailwind's md breakpoint)
      // Tablet: 768px - 1024px (Tailwind's md to lg)
      // Desktop: > 1024px (Tailwind's lg breakpoint)
      const isMobile = width < 768
      const isTablet = width >= 768 && width < 1024
      const isDesktop = width >= 1024
      
      // Touch device detection
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
      
      // Orientation detection
      const orientation = height > width ? 'portrait' : 'landscape'

      setMobileInfo({
        isMobile,
        isTablet,
        isDesktop,
        screenWidth: width,
        screenHeight: height,
        isTouchDevice,
        orientation
      })
    }

    // Initial check
    updateMobileInfo()

    // Listen for resize and orientation changes
    window.addEventListener('resize', updateMobileInfo)
    window.addEventListener('orientationchange', () => {
      // Small delay to ensure dimensions are updated after orientation change
      setTimeout(updateMobileInfo, 100)
    })

    return () => {
      window.removeEventListener('resize', updateMobileInfo)
      window.removeEventListener('orientationchange', updateMobileInfo)
    }
  }, [])

  return mobileInfo
} 