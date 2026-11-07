import { Navigate } from 'react-router-dom';

import { lastLocation } from '@/modules/intelligence/lastLocation';

/** Entry of the module (/inteligencia): goes back to the last tab and filters visited in this session. */
export function LastLocationRedirect() {
  return <Navigate to={lastLocation()} replace />;
}
