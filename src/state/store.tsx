import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useReducer, useState } from 'react';
import { matchedRecipeIds } from '../logic/matching';
import { AppState, Day, DAYS, MatchRule, Member, Recipe, Vote } from '../types';

const STORAGE_KEY = 'familyswipe.v1';

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

type Store = { state: AppState; dispatch: React.Dispatch<Action>; ready: boolean };

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) dispatch({ type: 'hydrate', state: JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  return <StoreContext.Provider value={{ state, dispatch, ready }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
}

export const newId = () => Math.random().toString(36).slice(2, 10);
