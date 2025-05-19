# Premier Spaces App

## Development Environment

### Important Notes for SDK 53+

#### Notification Limitations in Expo Go

As of Expo SDK 53, push notifications functionality has been removed from Expo Go. The app will automatically handle this limitation by:

1. Displaying toast messages instead of notifications when running in Expo Go
2. Disabling background task registration in Expo Go

For full notification functionality, you must use a development build:

```bash
# Create a development build
npx expo prebuild

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios
```

More information:

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)

## Data Synchronization

The app includes an offline-first data synchronization system that:

1. Stores data locally when offline
2. Automatically syncs when network connection is restored
3. Shows progress notifications for sync operations (only in development builds)
4. Supports background sync (only in development builds)
