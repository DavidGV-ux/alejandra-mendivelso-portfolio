export type Section = 'works' | 'about' | 'contact';

export interface AppState {
  section: Section;
  /** Índice del proyecto activo en la espiral */
  activeIndex: number;
  /** Índice destino (para animación de cámara) */
  targetIndex: number;
  detailProjectId: string | null;
  helpOpen: boolean;
  /** Portada visible tras la intro */
  heroOpen: boolean;
  introDone: boolean;
  loadingProgress: number;
  ready: boolean;
}

type Listener = (state: AppState, prev: AppState) => void;

export function createStore(initial: AppState) {
  let state = initial;
  const listeners = new Set<Listener>();
  const sliceListeners = new Map<keyof AppState, Set<Listener>>();

  function emit(prev: AppState): void {
    listeners.forEach((l) => l(state, prev));
    (Object.keys(state) as Array<keyof AppState>).forEach((key) => {
      if (state[key] !== prev[key]) {
        sliceListeners.get(key)?.forEach((l) => l(state, prev));
      }
    });
  }

  return {
    get(): AppState {
      return state;
    },
    set(patch: Partial<AppState>): void {
      const prev = state;
      const next = { ...state, ...patch };
      if (Object.keys(patch).every((k) => state[k as keyof AppState] === next[k as keyof AppState])) {
        return;
      }
      state = next;
      emit(prev);
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeKey<K extends keyof AppState>(
      key: K,
      listener: (value: AppState[K], prev: AppState[K]) => void,
    ): () => void {
      const wrapped: Listener = (s, p) => {
        if (s[key] !== p[key]) listener(s[key], p[key]);
      };
      if (!sliceListeners.has(key)) sliceListeners.set(key, new Set());
      sliceListeners.get(key)!.add(wrapped);
      return () => sliceListeners.get(key)?.delete(wrapped);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
