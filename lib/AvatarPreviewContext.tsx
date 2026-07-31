import { createContext, useContext, useState, ReactNode } from 'react';
import { Modal, View, StyleSheet, Dimensions } from 'react-native';
import Avatar from '@/components/Avatar';

type PreviewTarget = { avatarId?: string | null; avatarUrl?: string | null; username?: string | null } | null;

const AvatarPreviewContext = createContext<((t: PreviewTarget) => void) | null>(null);

const PREVIEW_SIZE = Math.min(Dimensions.get('window').width * 0.62, 260);

// Instagram-style hold-to-preview: long-pressing any avatar shows it
// large and circular until released. Mounted once near the root so
// every screen shares one modal instead of each rolling its own.
export function AvatarPreviewProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<PreviewTarget>(null);

  return (
    <AvatarPreviewContext.Provider value={setTarget}>
      {children}
      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View
          style={styles.overlay}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => setTarget(null)}
        >
          {target && (
            <View style={styles.ring}>
              <Avatar avatarId={target.avatarId} avatarUrl={target.avatarUrl} username={target.username} size={PREVIEW_SIZE} />
            </View>
          )}
        </View>
      </Modal>
    </AvatarPreviewContext.Provider>
  );
}

export function useAvatarPreview() {
  const ctx = useContext(AvatarPreviewContext);
  if (!ctx) throw new Error('useAvatarPreview must be used within AvatarPreviewProvider');
  return ctx;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'center', alignItems: 'center' },
  ring: { padding: 6, borderRadius: 999, borderWidth: 3, borderColor: '#ffffff33' },
});
