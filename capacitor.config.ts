import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dy.photoframemaker',
  appName: 'Photo Frame Maker',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  android: {
    backgroundColor: '#f5f6f8'
  }
};

export default config;
