import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type ViewerSettings } from '../core/settings';
import { loadSettings, persistSettings } from './repo';
export function useSettings(): [ViewerSettings, (s: ViewerSettings) => void] {
  const [s, set] = useState<ViewerSettings>(() => loadSettings(DEFAULT_SETTINGS));
  useEffect(() => persistSettings(s), [s]);
  return [s, set];
}
