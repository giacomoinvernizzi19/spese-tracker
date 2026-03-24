import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thinkinaboutmoney.app',
  appName: "Thinkin' About Money",
  webDir: 'dist',
  server: {
    // Use the live server in production
    url: 'https://thinkin-about-money.g-invernizzi-jm.workers.dev',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#3B82F6',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      spinnerColor: '#ffffff'
    },
    StatusBar: {
      backgroundColor: '#3B82F6',
      style: 'LIGHT'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Thinkin About Money'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

// For local development, use the local server instead
if (process.env.NODE_ENV === 'development') {
  config.server = {
    url: 'http://localhost:4321',
    cleartext: true
  };
}

export default config;
