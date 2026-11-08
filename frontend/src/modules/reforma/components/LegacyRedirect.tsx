import { Navigate, useLocation } from 'react-router-dom';

import { CALENDAR_PATH } from '@/modules/reforma/search';

/** Old address (/reforma?aba=...), kept working for saved links. */
export function LegacyRedirect() {
  const { search } = useLocation();
  return <Navigate to={`${CALENDAR_PATH}${search}`} replace />;
}
