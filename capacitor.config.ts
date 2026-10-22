import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // TEMPORAL: app de demo — debe coincidir con applicationId en
  // android/app/build.gradle y con la key demo (src/lib/licencia-demo.ts).
  appId: 'com.faceplugin.facerecognitionsdk',
  appName: 'myapp',
  webDir: 'dist'
};

export default config;
