import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../state/store';
import { colors, radius } from '../theme';

/** First screen on a new phone or tablet: start a family, or join one with its code. */
export function WelcomeScreen() {
  const { state, startFamily, joinFamily } = useStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'start' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanCode = code.replace(/[^A-Za-z0-9]/g, '');

  const run = async (which: 'start' | 'join', work: () => Promise<void>) => {
    setBusy(which);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Something went wrong. Check your internet connection and try again.');
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.hero}>🍽️</Text>
        <Text style={styles.h1}>Welcome to FamilySwipe</Text>
        <Text style={styles.sub}>Everyone swipes on dinners from their own phone or tablet. When enough of you say yum, it's a match.</Text>

        <View style={styles.card}>
          <Text style={styles.h2}>Join your family</Text>
          <Text style={styles.help}>Ask whoever set up your family for the 6-letter code. It's on their Family tab.</Text>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="ABC 123"
            placeholderTextColor={colors.line}
            style={styles.codeInput}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            returnKeyType="go"
            onSubmitEditing={() => cleanCode.length === 6 && run('join', () => joinFamily(cleanCode))}
          />
          <Pressable
            onPress={() => run('join', () => joinFamily(cleanCode))}
            style={[styles.primary, (cleanCode.length !== 6 || busy) && { opacity: 0.5 }]}
            disabled={cleanCode.length !== 6 || !!busy}
          >
            {busy === 'join' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Join family</Text>}
          </Pressable>
        </View>

        <Text style={styles.or}>or</Text>

        <View style={styles.card}>
          <Text style={styles.h2}>Start a new family</Text>
          <Text style={styles.help}>
            Do this on one phone. You'll get a code to type in on everyone else's phones and tablets.
            {state.members.length > 0 ? ' The family you already set up on this phone comes with you.' : ''}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Family name, e.g. The Smiths"
            placeholderTextColor={colors.muted}
            style={styles.input}
            maxLength={40}
          />
          <Pressable onPress={() => run('start', () => startFamily(name))} style={[styles.secondaryBtn, !!busy && { opacity: 0.5 }]} disabled={!!busy}>
            {busy === 'start' ? <ActivityIndicator color={colors.basil} /> : <Text style={styles.secondaryText}>Start a family</Text>}
          </Pressable>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 20, gap: 14, paddingBottom: 40, width: '100%', maxWidth: 520, alignSelf: 'center' },
  hero: { fontSize: 56, textAlign: 'center', marginTop: 12 },
  h1: { fontSize: 28, fontWeight: '800', color: colors.text, textAlign: 'center' },
  sub: { fontSize: 16, lineHeight: 22, color: colors.muted, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text },
  help: { fontSize: 14, lineHeight: 20, color: colors.muted },
  codeInput: {
    borderWidth: 2,
    borderColor: colors.basil,
    borderRadius: radius.sm,
    paddingVertical: 14,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.bg,
  },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 12, fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  primary: { backgroundColor: colors.basil, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  secondaryBtn: { borderWidth: 2, borderColor: colors.basil, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  secondaryText: { color: colors.basil, fontWeight: '800', fontSize: 16 },
  or: { textAlign: 'center', color: colors.muted, fontWeight: '700' },
  error: { backgroundColor: colors.matchSoft, color: colors.text, padding: 14, borderRadius: radius.sm, overflow: 'hidden' },
});
