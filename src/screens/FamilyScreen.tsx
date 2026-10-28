import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MATCH_RULES } from '../logic/matching';
import { CUISINES, emptyPrefs, isVegetarian, KINDS, MEATS, prefsSummary, vegetarianSkips } from '../logic/preferences';
import { newId, useStore } from '../state/store';
import { formatCode } from '../sync/household';
import { AVATARS, colors, radius } from '../theme';
import { FoodPrefs, Member } from '../types';

type Draft = { id: string | null; name: string; avatar: string; isKid: boolean; noFoods: string; prefs: FoodPrefs };

const blankDraft = (avatar: string): Draft => ({ id: null, name: '', avatar, isKid: false, noFoods: '', prefs: emptyPrefs() });

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export function FamilyScreen({ onDone }: { onDone: () => void }) {
  const { state, dispatch, household, leaveFamily } = useStore();
  const [draft, setDraft] = useState<Draft | null>(state.members.length === 0 ? blankDraft(AVATARS[0]) : null);

  const save = () => {
    if (!draft || !draft.name.trim()) return;
    const member: Member = {
      id: draft.id ?? newId(),
      name: draft.name.trim(),
      avatar: draft.avatar,
      isKid: draft.isKid,
      noFoods: draft.noFoods.split(',').map((s) => s.trim()).filter(Boolean),
      prefs: draft.prefs,
    };
    dispatch({ type: draft.id ? 'updateMember' : 'addMember', member });
    setDraft(null);
  };

  const edit = (m: Member) =>
    setDraft({ id: m.id, name: m.name, avatar: m.avatar, isKid: m.isKid, noFoods: m.noFoods.join(', '), prefs: m.prefs });

  const remove = (m: Member) =>
    Alert.alert(`Remove ${m.name}?`, 'Their swipes for this week will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => dispatch({ type: 'removeMember', id: m.id }) },
    ]);

  const newWeek = () =>
    Alert.alert('Start a new week?', 'This clears everyone\'s swipes, matches, the plan and the grocery list. Your family stays.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Start new week', style: 'destructive', onPress: () => dispatch({ type: 'newWeek' }) },
    ]);

  const shareCode = () => {
    if (!household) return;
    Share.share({
      message: `Join our family on FamilySwipe so we can pick dinners together! Open the app, tap "Join your family" and type this code: ${formatCode(household.inviteCode)}`,
    }).catch(() => {});
  };

  const leave = () =>
    Alert.alert('Leave this family on this device?', 'Your family keeps everything. You can join again any time with the family code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leaveFamily().catch(() => Alert.alert("Couldn't leave", 'Check your internet connection and try again.')),
      },
    ]);

  const nextAvatar = AVATARS[state.members.length % AVATARS.length];

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {state.members.length === 0 && (
        <View style={styles.welcome}>
          <Text style={styles.welcomeTitle}>Welcome! Let's set up your family.</Text>
          <Text style={styles.welcomeText}>
            {household
              ? "Add everyone who eats dinner at your house, kids too. Then each person swipes on their own phone or tablet (or you pass one around). When enough of you say yum, it's a match."
              : "Add everyone who eats dinner at your house, kids too. Then pass the phone around and swipe on dinners. When enough of you say yum, it's a match."}
          </Text>
        </View>
      )}

      {household && (
        <View style={styles.codeCard}>
          <Text style={styles.label}>{household.name}: family code</Text>
          <Text style={styles.code}>{formatCode(household.inviteCode)}</Text>
          <Text style={styles.help}>
            To add a phone or tablet (Grandpa's phone, a kid's iPad or Kindle), open FamilySwipe on it, tap "Join your
            family" and type this code.
          </Text>
          <Pressable onPress={shareCode} style={styles.secondary}>
            <Text style={styles.secondaryText}>Send the code</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.h1}>Your family</Text>
      {state.members.map((m) => (
        <View key={m.id} style={styles.member}>
          <Text style={styles.avatar}>{m.avatar}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>
              {m.name}
              {m.isKid ? '  ·  Kid' : ''}
            </Text>
            {prefsSummary(m) !== '' && <Text style={styles.noFoods}>{prefsSummary(m)}</Text>}
          </View>
          <Pressable onPress={() => edit(m)} style={styles.linkBtn}>
            <Text style={styles.link}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => remove(m)} style={styles.linkBtn}>
            <Text style={[styles.link, { color: colors.match }]}>Remove</Text>
          </Pressable>
        </View>
      ))}

      {draft ? (
        <View style={styles.form}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
            placeholder="e.g. Mom, Jake, Grandpa"
            style={styles.input}
            autoFocus
            returnKeyType="done"
          />
          <Text style={styles.label}>Pick an avatar</Text>
          <View style={styles.avatars}>
            {AVATARS.map((a) => (
              <Pressable
                key={a}
                onPress={() => setDraft({ ...draft, avatar: a })}
                style={[styles.avatarChoice, draft.avatar === a && styles.avatarChosen]}
              >
                <Text style={{ fontSize: 28 }}>{a}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>This is a kid</Text>
              <Text style={styles.help}>Kids get big pictures and simple Yum / Yuck buttons.</Text>
            </View>
            <Switch
              value={draft.isKid}
              onValueChange={(isKid) => setDraft({ ...draft, isKid })}
              trackColor={{ true: colors.basil, false: colors.line }}
            />
          </View>
          <Text style={[styles.h2, { marginTop: 8 }]}>Food preferences</Text>
          <Text style={styles.help}>All optional. FamilySwipe shows the dinners your family likes most first.</Text>

          <Text style={styles.label}>Favorite kinds of dinner</Text>
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <Chip
                key={k.value}
                label={`${k.icon} ${k.value}`}
                on={draft.prefs.kinds.includes(k.value)}
                onPress={() => setDraft({ ...draft, prefs: { ...draft.prefs, kinds: toggle(draft.prefs.kinds, k.value) } })}
              />
            ))}
          </View>

          <Text style={styles.label}>Favorite cuisines</Text>
          <View style={styles.chips}>
            {CUISINES.map((c) => (
              <Chip
                key={c.value}
                label={`${c.icon} ${c.value}`}
                on={draft.prefs.cuisines.includes(c.value)}
                onPress={() => setDraft({ ...draft, prefs: { ...draft.prefs, cuisines: toggle(draft.prefs.cuisines, c.value) } })}
              />
            ))}
          </View>

          <Text style={styles.label}>Never eats</Text>
          <View style={styles.chips}>
            <Chip
              label="🥕 Vegetarian"
              on={isVegetarian(draft.prefs)}
              no
              onPress={() =>
                setDraft({ ...draft, prefs: { ...draft.prefs, skips: isVegetarian(draft.prefs) ? [] : vegetarianSkips() } })
              }
            />
            {MEATS.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                on={draft.prefs.skips.includes(m.value)}
                no
                onPress={() => setDraft({ ...draft, prefs: { ...draft.prefs, skips: toggle(draft.prefs.skips, m.value) } })}
              />
            ))}
          </View>
          <Text style={styles.help}>Dinners with these are hidden for the whole family.</Text>

          <Text style={styles.label}>Other foods they never eat, like allergies (optional)</Text>
          <TextInput
            value={draft.noFoods}
            onChangeText={(noFoods) => setDraft({ ...draft, noFoods })}
            placeholder="e.g. peanut, shrimp, mushroom"
            style={styles.input}
            autoCapitalize="none"
          />
          <Text style={styles.help}>Separate with commas. Recipes with these foods are hidden for the whole family.</Text>
          <View style={styles.formButtons}>
            {state.members.length > 0 && (
              <Pressable onPress={() => setDraft(null)} style={styles.secondary}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
            )}
            <Pressable onPress={save} style={[styles.primary, !draft.name.trim() && { opacity: 0.5 }]} disabled={!draft.name.trim()}>
              <Text style={styles.primaryText}>{draft.id ? 'Save' : 'Add to family'}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setDraft(blankDraft(nextAvatar))} style={styles.addBtn}>
          <Text style={styles.addText}>+ Add a family member</Text>
        </Pressable>
      )}

      {state.members.length > 0 && !draft && (
        <Pressable onPress={onDone} style={styles.primary}>
          <Text style={styles.primaryText}>Start swiping</Text>
        </Pressable>
      )}

      <Text style={[styles.h1, { marginTop: 18 }]}>What counts as a match?</Text>
      {MATCH_RULES.map((r) => {
        const on = state.matchRule === r.value;
        return (
          <Pressable key={r.value} onPress={() => dispatch({ type: 'setRule', rule: r.value })} style={[styles.rule, on && styles.ruleOn]}>
            <View style={[styles.radio, on && styles.radioOn]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.ruleLabel}>{r.label}</Text>
              <Text style={styles.help}>{r.help}</Text>
            </View>
          </Pressable>
        );
      })}

      {state.members.length > 0 && (
        <Pressable onPress={newWeek} style={[styles.secondary, { marginTop: 18 }]}>
          <Text style={[styles.secondaryText, { color: colors.match }]}>Start a new week</Text>
        </Pressable>
      )}

      {household && (
        <Pressable onPress={leave} style={styles.secondary}>
          <Text style={[styles.secondaryText, { color: colors.muted, fontSize: 14 }]}>Leave this family on this device</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Chip({ label, on, no, onPress }: { label: string; on: boolean; no?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && (no ? styles.chipNo : styles.chipOn)]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      <Text style={[styles.chipText, on && { color: no ? colors.match : colors.basil }]}>
        {on && no ? '🚫 ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 10, paddingBottom: 40 },
  codeCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 6, borderWidth: 2, borderColor: colors.basil, alignItems: 'center' },
  code: { fontSize: 40, fontWeight: '800', letterSpacing: 6, color: colors.basil },
  welcome: { backgroundColor: colors.basilSoft, borderRadius: radius.md, padding: 16, gap: 6 },
  welcomeTitle: { fontSize: 20, fontWeight: '800', color: colors.basil },
  welcomeText: { fontSize: 15, lineHeight: 22, color: colors.text },
  h1: { fontSize: 24, fontWeight: '800', color: colors.text },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.line },
  avatar: { fontSize: 34 },
  memberName: { fontSize: 17, fontWeight: '800', color: colors.text },
  noFoods: { fontSize: 13, color: colors.muted },
  linkBtn: { padding: 6 },
  link: { color: colors.basil, fontWeight: '700' },
  form: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 8, borderWidth: 1, borderColor: colors.line },
  label: { fontSize: 15, fontWeight: '800', color: colors.text },
  h2: { fontSize: 19, fontWeight: '800', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.bg },
  chipOn: { borderColor: colors.basil, backgroundColor: colors.basilSoft },
  chipNo: { borderColor: colors.match, backgroundColor: colors.matchSoft },
  chipText: { fontSize: 15, fontWeight: '700', color: colors.text },
  help: { fontSize: 13, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 12, fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  avatarChoice: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarChosen: { borderColor: colors.basil, backgroundColor: colors.basilSoft },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  formButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  primary: { backgroundColor: colors.basil, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 999, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  secondary: { paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  secondaryText: { color: colors.basil, fontWeight: '800', fontSize: 16 },
  addBtn: { borderWidth: 2, borderStyle: 'dashed', borderColor: colors.line, borderRadius: radius.md, padding: 16, alignItems: 'center' },
  addText: { color: colors.basil, fontWeight: '800', fontSize: 16 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.line },
  ruleOn: { borderColor: colors.basil, backgroundColor: colors.basilSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.line },
  radioOn: { borderColor: colors.basil, borderWidth: 7 },
  ruleLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
});
