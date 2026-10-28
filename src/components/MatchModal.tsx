import { Image } from 'expo-image';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { Member, Recipe } from '../types';

type Props = { recipe: Recipe | null; likers: Member[]; onClose: () => void };

export function MatchModal({ recipe, likers, onClose }: Props) {
  return (
    <Modal visible={!!recipe} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {recipe && (
          <View style={styles.box}>
            <Text style={styles.title}>It's a match!</Text>
            <Image source={recipe.image} style={styles.photo} contentFit="cover" />
            <Text style={styles.name}>{recipe.name}</Text>
            <Text style={styles.avatars}>{likers.map((m) => m.avatar).join('  ')}</Text>
            <Text style={styles.who}>{likers.map((m) => m.name).join(', ')} said yum</Text>
            <Pressable style={styles.btn} onPress={onClose}>
              <Text style={styles.btnText}>Keep swiping</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(29,36,32,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  box: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 22, alignItems: 'center', gap: 10 },
  title: { fontSize: 34, fontWeight: '900', color: colors.match },
  photo: { width: '100%', aspectRatio: 1.2, borderRadius: radius.md },
  name: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  avatars: { fontSize: 32 },
  who: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  btn: { marginTop: 6, backgroundColor: colors.match, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
