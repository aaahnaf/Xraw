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
    settings,
    recording,
    errors,
    openCamera,
    startRecording,
    stopRecording,
    captureRawStill,
    updateSetting,
  } = useCamera();

  // Initialize camera on mount
  useEffect(() => {
    openCamera();
  }, [openCamera]);

  return (
    <div className="w-screen h-screen bg-black overflow-hidden relative">
      {/* Main Content */}
      {screen === 'camera' && (
        <CameraScreen
          cameraInfo={cameraInfo}
          settings={settings}
          recording={recording}
          previewActive={previewActive}
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
          cameraInfo={cameraInfo}
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

      {/* Navigation Bar - Always visible */}
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
