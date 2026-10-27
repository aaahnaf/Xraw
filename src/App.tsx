import { useEffect } from 'react';
import { useCamera } from './hooks/useCamera';
import { CameraScreen } from './components/CameraScreen';
import { DiagnosticsScreen } from './components/DiagnosticsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { AboutScreen } from './components/AboutScreen';

function App() {
  const {
    screen,
    setScreen,
    cameraInfo,
    previewActive,
    nativeAvailable,
    initializing,
    settings,
    recording,
    errors,
    openCamera,
    startRecording,
    stopRecording,
    captureRawStill,
    updateSetting,
  } = useCamera();

  // Auto-open camera when native is available and initialized
  useEffect(() => {
    if (nativeAvailable && cameraInfo && !initializing) {
      openCamera();
    }
  }, [nativeAvailable, cameraInfo, initializing, openCamera]);

  // Show loading/initializing state
  if (initializing) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center space-y-3">
          <div className="text-xl font-bold tracking-wider" style={{ color: 'var(--text-primary)' }}>XRAW</div>
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Initializing...</div>
        </div>
      </div>
    );
  }

  // Browser mode: Show redesigned UI with native-unavailable indicator
  // Do NOT early return - always show the redesigned interface

  // Default camera info for when native is available but camera not yet enumerated
  const defaultCameraInfo = cameraInfo || {
    id: '0',
    facing: 'back' as const,
    hardwareLevel: 'unknown' as const,
    capabilities: [] as string[],
    rawSupported: false,
    manualControls: false,
    sensorInfo: null,
  };

  // Determine if we should show bottom navigation
  const showBottomNav = screen !== 'camera';
  
  return (
    <div 
      className="w-full h-full flex flex-col overflow-hidden relative" 
      style={{ 
        background: 'var(--bg-primary)',
        height: '100dvh',
        paddingBottom: showBottomNav ? '64px' : '0' // Reserve space for bottom nav
      }}
    >
      {/* Native unavailable banner - compact, non-blocking */}
      {!nativeAvailable && (
        <div 
          className="w-full px-4 py-2 text-center text-xs"
          style={{ 
            background: 'var(--bg-tertiary)',
            color: 'var(--accent-warning)',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          Browser mode • Install APK for camera access
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {screen === 'camera' && (
          <CameraScreen
            cameraInfo={defaultCameraInfo}
            settings={settings}
            recording={recording}
            previewActive={previewActive}
            nativeAvailable={nativeAvailable}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onCaptureStill={captureRawStill}
            onUpdateSetting={updateSetting}
            onOpenDiagnostics={() => setScreen('diagnostics')}
            onOpenSettings={() => setScreen('settings')}
          />
        )}
        
        {screen === 'diagnostics' && (
          <DiagnosticsScreen
            cameraInfo={defaultCameraInfo}
            onBack={() => setScreen('camera')}
          />
        )}
        
        {screen === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdateSetting={updateSetting}
            onBack={() => setScreen('camera')}
          />
        )}
        
        {screen === 'about' && (
          <AboutScreen
            onBack={() => setScreen('camera')}
          />
        )}
      </div>

      {/* Bottom Navigation - Only show on non-camera screens */}
      {showBottomNav && (
        <nav 
          className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch"
          style={{ 
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-subtle)',
            height: '64px',
            paddingBottom: 'env(safe-area-inset-bottom)' // Handle iPhone notch etc
          }}
        >
          <NavButton label="Camera" active={false} onClick={() => setScreen('camera')} />
          <NavButton label="Diagnostics" active={screen === 'diagnostics'} onClick={() => setScreen('diagnostics')} />
          <NavButton label="Settings" active={screen === 'settings'} onClick={() => setScreen('settings')} />
          <NavButton label="About" active={screen === 'about'} onClick={() => setScreen('about')} />
        </nav>
      )}

      {/* Error Toast */}
      {errors.length > 0 && (
        <div className="fixed top-12 left-2 right-2 z-50 space-y-2">
          {errors.slice(-3).map((error, i) => (
            <div
              key={`${error.timestamp}-${i}`}
              className="px-4 py-3 rounded-lg text-sm"
              style={{
                background: error.severity === 'error' || error.severity === 'critical'
                  ? 'rgba(196, 30, 58, 0.1)'
                  : error.severity === 'warning'
                  ? 'rgba(212, 165, 116, 0.1)'
                  : 'var(--bg-secondary)',
                color: error.severity === 'error' || error.severity === 'critical'
                  ? 'var(--accent-recording)'
                  : error.severity === 'warning'
                  ? 'var(--accent-warning)'
                  : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              {error.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center py-2 text-xs sm:text-sm font-medium transition-colors min-w-0"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--bg-tertiary)' : 'transparent'
      }}
    >
      <span className="truncate px-2">{label}</span>
    </button>
  );
}

export default App;
