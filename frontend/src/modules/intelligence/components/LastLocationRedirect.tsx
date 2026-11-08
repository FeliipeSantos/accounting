import { Navigate, useLocation, useParams } from 'react-router-dom';

import { lastLocation } from '@/modules/intelligence/lastLocation';
import { legacyTabPath } from '@/modules/intelligence/paths';

/** Entry of the module (/inteligencia-contabil/publicacoes): goes back to the last tab and filters visited in this session. */
export function LastLocationRedirect() {
  return <Navigate to={lastLocation()} replace />;
}

/** Old addresses (/inteligencia/<aba>?filtros), kept working for saved links. */
export function LegacyTabRedirect() {
  const { tab } = useParams();
  const { search } = useLocation();
  return <Navigate to={tab ? legacyTabPath(tab, search) : lastLocation()} replace />;
}
