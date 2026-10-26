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
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-sm font-mono text-white/70 tracking-widest">XRAW</div>
          <div className="text-[10px] font-mono text-white/30">Initializing camera...</div>
        </div>
      </div>
    );
  }

  // Show unavailable state when native plugin is not present
  if (!nativeAvailable) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm px-6">
          <div className="text-sm font-mono text-white/70 tracking-widest">XRAW CAMERA</div>
          <div className="text-[10px] font-mono text-yellow-400/80 leading-relaxed">
            Native camera plugin not available.<br />
            This interface requires the Android native build.
          </div>
          <div className="text-[9px] font-mono text-white/30 leading-relaxed">
            To use XRAW Camera:<br />
            1. Push this project to GitHub<br />
            2. Run the "Build XRAW Camera APK" workflow<br />
            3. Install the APK on your Android device<br />
            4. Open the app from the home screen
          </div>
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="text-[9px] font-mono text-white/20">
              Browser Development Mode<br />
              UI preview only — no camera access
            </div>
          </div>
          {/* Still show UI for preview purposes */}
          <button
            onClick={() => setScreen('about')}
            className="mt-4 px-3 py-1.5 text-[9px] font-mono border border-white/10 text-white/40 rounded hover:border-white/20 transition-colors"
          >
            View App Info
          </button>
        </div>
        
        {/* Error display */}
        {errors.length > 0 && (
          <div className="fixed top-4 left-4 right-4 space-y-1">
            {errors.slice(-3).map((error, i) => (
              <div key={`${error.timestamp}-${i}`} className="px-3 py-1.5 rounded text-[9px] font-mono bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
                {error.message}
              </div>
            ))}
          </div>
        )}
        
        {/* Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 border-t border-white/5 px-4 py-1.5 flex justify-around">
          <NavButton label="CAMERA" active={screen === 'camera'} onClick={() => setScreen('camera')} />
          <NavButton label="DIAG" active={screen === 'diagnostics'} onClick={() => setScreen('diagnostics')} />
          <NavButton label="SETTINGS" active={screen === 'settings'} onClick={() => setScreen('settings')} />
          <NavButton label="ABOUT" active={screen === 'about'} onClick={() => setScreen('about')} />
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
    <div className="w-screen h-screen bg-black overflow-hidden relative">
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

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 border-t border-white/5 px-4 py-1.5 flex justify-around">
        <NavButton label="CAMERA" active={screen === 'camera'} onClick={() => setScreen('camera')} />
        <NavButton label="DIAG" active={screen === 'diagnostics'} onClick={() => setScreen('diagnostics')} />
        <NavButton label="SETTINGS" active={screen === 'settings'} onClick={() => setScreen('settings')} />
        <NavButton label="ABOUT" active={screen === 'about'} onClick={() => setScreen('about')} />
      </nav>

      {/* Error Toast */}
      {errors.length > 0 && (
        <div className="fixed top-12 left-2 right-2 z-50 space-y-1">
          {errors.slice(-3).map((error, i) => (
            <div
              key={`${error.timestamp}-${i}`}
              className={`px-3 py-1.5 rounded text-[9px] font-mono border ${
                error.severity === 'error' || error.severity === 'critical'
                  ? 'bg-red-500/10 border-red-500/20 text-red-400'
                  : error.severity === 'warning'
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
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
      className={`text-[9px] font-mono tracking-wider px-3 py-1 transition-colors ${
        active ? 'text-white/80' : 'text-white/30 hover:text-white/50'
      }`}
    >
      {label}
    </button>
  );
}

export default App;
