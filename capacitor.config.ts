import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xraw.camera',
  appName: 'XRAW Camera',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#000000',
      showSpinner: false
    }
  }
};

export default config;
