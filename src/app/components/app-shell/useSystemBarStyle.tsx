import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';

type SystemBarStyleContextValue = {
  safeAreaFill: string | undefined;
  setSafeAreaFill: Dispatch<SetStateAction<string | undefined>>;
};

const SystemBarStyleContext = createContext<SystemBarStyleContextValue | null>(null);

export function SystemBarStyleProvider({ children }: { children: ReactNode }) {
  const [safeAreaFill, setSafeAreaFill] = useState<string>();
  const value = useMemo(() => ({ safeAreaFill, setSafeAreaFill }), [safeAreaFill]);

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
  const { setSafeAreaFill } = useSystemBarStyleContext();

  useLayoutEffect(() => {
    setSafeAreaFill(fill);

    return () => {
      setSafeAreaFill(undefined);
    };
  }, [fill, setSafeAreaFill]);
}

export function useSystemBarStyle() {
  return useSystemBarStyleContext();
}
