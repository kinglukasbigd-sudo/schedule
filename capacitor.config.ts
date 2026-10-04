import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.term.planner',
  appName: 'TERM',
  webDir: 'dist',
  ios: { contentInset: 'never' },
  android: { backgroundColor: '#FBFBFA' },
};

export default config;
