import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';
import { matchedRecipeIds } from '../logic/matching';
import {
  createHousehold,
  fetchFamily,
  Household,
  joinHousehold,
  leaveHousehold,
  pushChange,
  subscribeToFamily,
} from '../sync/household';
import { syncEnabled } from '../sync/supabase';
import { AppState, Day, DAYS, MatchRule, Member, Recipe, Vote } from '../types';

const STORAGE_KEY = 'familyswipe.v1';
const DEVICE_KEY = 'familyswipe.device.v1';

const emptyPlan = (): Record<Day, string | null> =>
  Object.fromEntries(DAYS.map((d) => [d, null])) as Record<Day, string | null>;

export const initialState: AppState = {
  members: [],
  matchRule: 'parentsPlusKid',
  votes: {},
  recipes: {},
  deckOrder: [],
  plan: emptyPlan(),
  checkedGroceries: [],
};

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'addMember'; member: Member }
  | { type: 'updateMember'; member: Member }
  | { type: 'removeMember'; id: string }
  | { type: 'setRule'; rule: MatchRule }
  | { type: 'vote'; memberId: string; recipeId: string; vote: Vote }
  | { type: 'undoVote'; memberId: string; recipeId: string }
  | { type: 'addRecipes'; recipes: Recipe[] }
  | { type: 'importRecipe'; recipe: Recipe }
  | { type: 'setPlanDay'; day: Day; recipeId: string | null }
  | { type: 'autofillPlan' }
  | { type: 'toggleGrocery'; key: string }
  | { type: 'newWeek' };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return { ...initialState, ...action.state, plan: { ...emptyPlan(), ...action.state.plan } };
    case 'addMember':
      return { ...state, members: [...state.members, action.member] };
    case 'updateMember':
      return {
        ...state,
        members: state.members.map((m) => (m.id === action.member.id ? action.member : m)),
      };
    case 'removeMember': {
      const { [action.id]: _removed, ...votes } = state.votes;
      return { ...state, members: state.members.filter((m) => m.id !== action.id), votes };
    }
    case 'setRule':
      return { ...state, matchRule: action.rule };
    case 'vote':
      return {
        ...state,
        votes: {
          ...state.votes,
          [action.memberId]: { ...state.votes[action.memberId], [action.recipeId]: action.vote },
        },
      };
    case 'undoVote': {
      const { [action.recipeId]: _undone, ...mine } = state.votes[action.memberId] ?? {};
      return { ...state, votes: { ...state.votes, [action.memberId]: mine } };
    }
    case 'addRecipes': {
      const recipes = { ...state.recipes };
      const deckOrder = [...state.deckOrder];
      for (const r of action.recipes) {
        if (!recipes[r.id]) deckOrder.push(r.id);
        recipes[r.id] = r;
      }
      return { ...state, recipes, deckOrder };
    }
    case 'importRecipe': {
      // A recipe someone added from a link goes to the top of everyone's deck.
      const { recipe } = action;
      return {
        ...state,
        recipes: { ...state.recipes, [recipe.id]: recipe },
        deckOrder: [recipe.id, ...state.deckOrder.filter((id) => id !== recipe.id)],
      };
    }
    case 'setPlanDay':
      return { ...state, plan: { ...state.plan, [action.day]: action.recipeId } };
    case 'autofillPlan': {
      const planned = new Set(Object.values(state.plan).filter(Boolean));
      const unplanned = matchedRecipeIds(state).filter((id) => !planned.has(id));
      const plan = { ...state.plan };
      for (const day of DAYS) {
        if (!plan[day] && unplanned.length) plan[day] = unplanned.shift()!;
      }
      return { ...state, plan };
    }
    case 'toggleGrocery': {
      const checked = new Set(state.checkedGroceries);
      checked.has(action.key) ? checked.delete(action.key) : checked.add(action.key);
      return { ...state, checkedGroceries: [...checked] };
    }
    case 'newWeek':
      // Keep the family, start fresh votes, deck, plan and list.
      return { ...initialState, members: state.members, matchRule: state.matchRule };
  }
}

type Store = {
  state: AppState;
  dispatch: (action: Action) => void;
  ready: boolean;
  /** The shared family this device belongs to, when family sync is on. */
  household: Household | null;
  /** The person who last swiped on this device, so they don't have to pick themselves every time. */
  myMemberId: string | null;
  setMyMemberId: (id: string | null) => void;
  /** Set when a change couldn't be saved to the family. */
  syncError: string | null;
  startFamily: (name: string) => Promise<void>;
  joinFamily: (code: string) => Promise<void>;
  leaveFamily: () => Promise<void>;
};

type DeviceInfo = { household: Household | null; myMemberId: string | null };

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);
  const [device, setDevice] = useState<DeviceInfo>({ household: null, myMemberId: null });
  const [syncError, setSyncError] = useState<string | null>(null);

  // Latest values for callbacks that outlive a render.
  const stateRef = useRef(state);
  stateRef.current = state;
  const householdId = device.household?.id ?? null;
  const householdRef = useRef(householdId);
  householdRef.current = householdId;

  // Changes are saved to the server one at a time, in order.
  const sync = useRef({ queue: Promise.resolve(), pending: 0, generation: 0, reloadWanted: false });

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(DEVICE_KEY)])
      .then(([raw, rawDevice]) => {
        if (raw) rawDispatch({ type: 'hydrate', state: JSON.parse(raw) });
        if (rawDevice && syncEnabled) setDevice(JSON.parse(rawDevice));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(DEVICE_KEY, JSON.stringify(device)).catch(() => {});
  }, [device, ready]);

  const reload = useCallback(async () => {
    const hid = householdRef.current;
    if (!hid) return;
    const s = sync.current;
    if (s.pending > 0) {
      // Wait for our own changes to land first, or the reload would undo them on screen.
      s.reloadWanted = true;
      return;
    }
    const generation = s.generation;
    try {
      const fresh = await fetchFamily(hid);
      if (householdRef.current !== hid) return;
      if (s.pending > 0 || s.generation !== generation) {
        s.reloadWanted = true;
        return;
      }
      rawDispatch({ type: 'hydrate', state: fresh.state });
      setDevice((d) => (d.household?.id === hid ? { ...d, household: fresh.household } : d));
      setSyncError(null);
    } catch {
      setSyncError("Can't reach your family right now. Check your internet connection.");
    }
  }, []);

  const dispatch = useCallback(
    (action: Action) => {
      const prev = stateRef.current;
      const next = reducer(prev, action);
      stateRef.current = next;
      rawDispatch(action);

      const hid = householdRef.current;
      if (!hid || action.type === 'hydrate') return;
      const s = sync.current;
      s.pending += 1;
      s.generation += 1;
      s.queue = s.queue
        .then(() => pushChange(hid, action, prev, next))
        .then(() => setSyncError(null))
        .catch(() => setSyncError("Some changes didn't reach your family. Check your internet connection."))
        .finally(() => {
          s.pending -= 1;
          if (s.pending === 0 && s.reloadWanted) {
            s.reloadWanted = false;
            reload();
          }
        });
    },
    [reload],
  );

  // Listen for what the rest of the family does, and catch up whenever the app comes back on screen.
  useEffect(() => {
    if (!householdId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reloadSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(reload, 300);
    };
    const unsubscribe = subscribeToFamily(householdId, {
      onChange: reloadSoon,
      onVote: (memberId, recipeId, vote) => rawDispatch({ type: 'vote', memberId, recipeId, vote }),
    });
    const appState = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') reloadSoon();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      appState.remove();
    };
  }, [householdId, reload]);

  const startFamily = useCallback(async (name: string) => {
    const household = await createHousehold(name, stateRef.current);
    setDevice({ household, myMemberId: null });
  }, []);

  const joinFamily = useCallback(async (code: string) => {
    const joined = await joinHousehold(code);
    const fresh = await fetchFamily(joined.id);
    rawDispatch({ type: 'hydrate', state: fresh.state });
    setDevice({ household: fresh.household, myMemberId: null });
  }, []);

  const leaveFamily = useCallback(async () => {
    const hid = householdRef.current;
    if (hid) await leaveHousehold(hid);
    rawDispatch({ type: 'hydrate', state: initialState });
    setDevice({ household: null, myMemberId: null });
    setSyncError(null);
  }, []);

  const setMyMemberId = useCallback((myMemberId: string | null) => setDevice((d) => ({ ...d, myMemberId })), []);

  return (
    <StoreContext.Provider
      value={{
        state,
        dispatch,
        ready,
        household: device.household,
        myMemberId: device.myMemberId,
        setMyMemberId,
        syncError,
        startFamily,
        joinFamily,
        leaveFamily,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

export const newId = () => Math.random().toString(36).slice(2, 10);
