import MaskedView from '@react-native-masked-view/masked-view';
import { File, Paths } from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useSettingsStore } from '@/stores/settings';

interface WallpaperProps {
  height?: number;
  dim?: boolean;
}

const WallpaperInner = ({ height = 400, dim = true }: WallpaperProps) => {
  try {
    const settingsStore = useSettingsStore(state => state.personalization);
    const currentWallpaper = settingsStore.wallpaper;

    const [image, setImage] = useState<string | null>(null);

    useEffect(() => {
      if (currentWallpaper?.path?.name) {
        const file = new File(Paths.document, currentWallpaper.path.directory || '', currentWallpaper.path.name);
        if (file.exists) {
          setImage(file.uri);
        } else {
          setImage(null);
        }
      }
      else {
        setImage(null);
      }
    }, [currentWallpaper]);

    const isGradient = currentWallpaper?.type === "gradient" && Boolean(currentWallpaper?.gradient?.colors);

    return (
      <MaskedView
        style={[styles.container, { height }]}
        maskElement={
          <LinearGradient
            colors={['rgba(0, 0, 0, 1)', 'rgba(0, 0, 0, 0)']}
            locations={[0.5, 1]}
            style={{ width: '100%', height }}
          />
        }
      >
        {isGradient ? (
          <LinearGradient
            colors={currentWallpaper!.gradient!.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.image, { height }]}
          />
        ) : (
          <Image
            source={image ? { uri: image } : require('@/assets/images/wallpapers/clouds.jpg')}
            style={[styles.image, { height }]}
          />
        )}

        {dim &&
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0)']}
            locations={[0, 1]}
            style={[styles.dimGradient, { height: height / 2 }]}
          />
        }
      </MaskedView>
    );
  } catch {
    return null;
  }
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: -9
  },
  image: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0
  },
  dimGradient: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1
  }
});

// Memoized: props are stable primitives and the File.exists check runs only
// inside the [currentWallpaper] effect, so parent re-renders skip this subtree.
const Wallpaper = React.memo(WallpaperInner);

export default Wallpaper;