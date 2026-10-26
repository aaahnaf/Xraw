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

  // Show unavailable state when native plugin is not present
  if (!nativeAvailable) {
    return (
      <div className="w-screen h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center space-y-6 max-w-sm px-8">
          <div className="space-y-2">
            <div className="text-xl font-bold tracking-wider" style={{ color: 'var(--text-primary)' }}>XRAW CAMERA</div>
          </div>
          <div className="text-sm leading-relaxed" style={{ color: 'var(--accent-warning)' }}>
            Native camera plugin not available.
          </div>
          <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            This interface requires the Android native build.
          </div>
          <div className="text-xs leading-relaxed pt-4" style={{ color: 'var(--text-tertiary)' }}>
            To use XRAW Camera:<br />
            1. Push this project to GitHub<br />
            2. Run the "Build XRAW Camera APK" workflow<br />
            3. Install the APK on your Android device<br />
            4. Open the app from the home screen
          </div>
          <button
            onClick={() => setScreen('about')}
            className="mt-6 px-6 py-3 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          >
            View App Info
          </button>
        </div>
        
        {/* Error display */}
        {errors.length > 0 && (
          <div className="fixed top-4 left-4 right-4 space-y-2">
            {errors.slice(-3).map((error, i) => (
              <div key={`${error.timestamp}-${i}`} className="px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--bg-secondary)', color: 'var(--accent-warning)', border: '1px solid var(--border-subtle)' }}>
                {error.message}
              </div>
            ))}
          </div>
        )}
        
        {/* Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 flex justify-around" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
          <NavButton label="Camera" active={screen === 'camera'} onClick={() => setScreen('camera')} />
          <NavButton label="Diagnostics" active={screen === 'diagnostics'} onClick={() => setScreen('diagnostics')} />
          <NavButton label="Settings" active={screen === 'settings'} onClick={() => setScreen('settings')} />
          <NavButton label="About" active={screen === 'about'} onClick={() => setScreen('about')} />
        </nav>
        
        {screen === 'about' && <AboutScreen onBack={() => setScreen('camera')} />}
      </div>
    );
  }

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

  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ background: 'var(--bg-primary)' }}>
      {/* Main Content */}
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

      {/* Navigation Bar - Only show on non-camera screens */}
      {(screen === 'diagnostics' || screen === 'settings' || screen === 'about') && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 py-3 flex justify-around" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
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
      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
      style={{
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        background: active ? 'var(--bg-tertiary)' : 'transparent'
      }}
    >
      {label}
    </button>
  );
}

export default App;
