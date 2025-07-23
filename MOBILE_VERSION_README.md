# Motord Mobile Version

## Overview

The mobile version of Motord provides a touch-optimized interface for mobile devices while maintaining full compatibility with the existing game backend and desktop version.

## Features

### Mobile-Optimized UI
- **Responsive Design**: Automatically detects mobile devices and switches to mobile-friendly layouts
- **Touch-Friendly Controls**: Larger buttons, improved spacing, and optimized input areas
- **Orientation Support**: Adapts to both portrait and landscape orientations

### Game Screen Improvements
- **Horizontal Scoreboard**: Scrollable leaderboard at the top of the screen
- **Optimized Word Display**: Appropriately sized text based on screen size and orientation
- **Mobile Input**: Enhanced input field with submit button for better mobile keyboard support
- **Touch Interactions**: Disabled autocorrect/autocomplete for translation input

### Lobby Screen Enhancements
- **Tabbed Interface**: Separate tabs for Players, Chat, and Settings
- **Full-Screen Layout**: Maximizes screen real estate for mobile devices
- **Fixed Action Bar**: Bottom-anchored controls for easy thumb access

### Progressive Web App (PWA) Support
- **Installable**: Can be installed on mobile home screens
- **App-like Experience**: Runs in standalone mode without browser UI
- **Offline-Ready Structure**: Foundation for offline capabilities

## Architecture

### Components
- `useMobile()` hook: Device detection and screen size monitoring
- `MobileGameScreen`: Mobile-optimized game interface
- `MobileLobbyScreen`: Mobile-optimized lobby with tabbed layout

### Device Detection
- Mobile: < 768px width
- Tablet: 768px - 1024px width  
- Desktop: > 1024px width
- Touch detection for enhanced UX

## Testing Instructions

### Local Development
```bash
# Start the application (uses Docker)
docker compose up -d

# Access the application
# Desktop: http://localhost:3000
# Mobile: Use Chrome DevTools device simulation or access from mobile device on local network
```

### Mobile Testing
1. **Chrome DevTools**: 
   - Open DevTools → Toggle device toolbar
   - Select mobile device (iPhone, Android)
   - Test touch interactions and responsive layout

2. **Real Device Testing**:
   - Connect mobile device to same network
   - Access via local IP: `http://[YOUR_IP]:3000`
   - Test actual touch interactions and mobile keyboard

3. **PWA Installation**:
   - Open in mobile browser
   - Use "Add to Home Screen" option
   - Test standalone app experience

## Game Flow (Mobile)

### Lobby (Mobile)
1. **Players Tab**: View all players with ready status and language flags
2. **Chat Tab**: Full-screen chat with fixed input at bottom
3. **Settings Tab**: Host controls for difficulty and max score
4. **Action Bar**: Ready toggle, Start Game, and Invite buttons

### Game (Mobile)  
1. **Scoreboard**: Horizontal scrolling leaderboard at top
2. **Word Display**: Centered word with appropriate sizing
3. **Fuse Timer**: Visual countdown bar below word
4. **Input Area**: Fixed at bottom with optional submit button
5. **Touch Optimizations**: Disabled autocorrect, enhanced focus handling

## Technical Details

### Mobile Detection Logic
```typescript
const isMobile = width < 768
const isTablet = width >= 768 && width < 1024
const isDesktop = width >= 1024
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
```

### Responsive Breakpoints
- Uses Tailwind CSS breakpoints (md: 768px, lg: 1024px)
- Dynamic text sizing based on device and orientation
- Adaptive layouts for different screen aspects

### PWA Configuration
- Manifest file with app metadata
- Apple-specific meta tags for iOS
- Theme colors and orientation preferences
- Icon definitions for various sizes

## Development Notes

### Backward Compatibility
- Desktop version remains unchanged
- Mobile components are additive, not replacing existing functionality  
- Same backend API and WebSocket infrastructure

### Performance Considerations
- Lazy loading of mobile components when needed
- Efficient re-rendering on orientation changes
- Optimized touch event handling

### Future Enhancements
- Gesture support (swipe actions)
- Offline mode capabilities
- Push notifications for game invites
- Native app builds (Capacitor/PhoneGap)

## Testing Checklist

### Mobile Functionality
- [ ] Device detection works correctly
- [ ] Mobile UI renders properly on various screen sizes
- [ ] Touch interactions are responsive
- [ ] Keyboard input works without autocorrect interference
- [ ] Orientation changes are handled smoothly

### Game Features
- [ ] All game mechanics work on mobile
- [ ] Real-time updates function correctly
- [ ] Chat system works in mobile interface
- [ ] Lobby controls are accessible and functional
- [ ] Game animations work on mobile devices

### Cross-Platform
- [ ] Desktop version still works as expected
- [ ] Mobile and desktop can play together
- [ ] No functionality regressions on any platform
- [ ] WebSocket communication works across devices

## Known Issues
- Icon files need to be created (currently using placeholders)
- PWA service worker not yet implemented
- Some animations may need mobile-specific optimizations 