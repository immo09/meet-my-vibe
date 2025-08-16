import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.6d38a22226be4ad48b1d86c6ff8cca7c',
  appName: 'meet-my-vibe',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://6d38a222-26be-4ad4-8b1d-86c6ff8cca7c.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#488AFF',
      sound: 'beep.wav'
    }
  }
};

export default config;