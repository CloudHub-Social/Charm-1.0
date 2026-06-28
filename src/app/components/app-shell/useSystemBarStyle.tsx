import type { ReactNode } from 'react';
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';

type SystemBarStyleContextValue = {
  safeAreaFill: string | undefined;
  registerSafeAreaFill: (owner: symbol, fill: string | undefined) => void;
  unregisterSafeAreaFill: (owner: symbol) => void;
};

const SystemBarStyleContext = createContext<SystemBarStyleContextValue | null>(null);

type SystemBarStyleState = {
  owner: symbol | null;
  safeAreaFill: string | undefined;
};

export function SystemBarStyleProvider({ children }: { children: ReactNode }) {
  const [{ safeAreaFill }, setState] = useState<SystemBarStyleState>({
    owner: null,
    safeAreaFill: undefined,
  });
  const value = useMemo(
    () => ({
      safeAreaFill,
      registerSafeAreaFill: (nextOwner: symbol, fill: string | undefined) => {
        setState({ owner: nextOwner, safeAreaFill: fill });
      },
      unregisterSafeAreaFill: (nextOwner: symbol) => {
        setState((current) =>
          current.owner === nextOwner ? { owner: null, safeAreaFill: undefined } : current
        );
      },
    }),
    [safeAreaFill]
  );

  return <SystemBarStyleContext.Provider value={value}>{children}</SystemBarStyleContext.Provider>;
}

function useSystemBarStyleContext(): SystemBarStyleContextValue {
  const context = useContext(SystemBarStyleContext);

  if (!context) {
    throw new Error('useSystemBarStyleContext must be used within SystemBarStyleProvider');
  }

  return context;
}

export function useSystemBarSafeAreaFill(fill: string | undefined) {
  const { registerSafeAreaFill, unregisterSafeAreaFill } = useSystemBarStyleContext();
  const ownerRef = useRef(Symbol('system-bar-safe-area-fill'));

  useLayoutEffect(() => {
    const owner = ownerRef.current;
    registerSafeAreaFill(owner, fill);

    return () => {
      unregisterSafeAreaFill(owner);
    };
  }, [fill, registerSafeAreaFill, unregisterSafeAreaFill]);
}

export function useSystemBarStyle() {
  return useSystemBarStyleContext();
}
