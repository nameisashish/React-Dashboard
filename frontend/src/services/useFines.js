import { useCallback, useEffect, useState } from 'react';
import { finesService } from './finesService.js';
export function useFines(filters, records) {
  const [state, setState] = useState({ rows: [], loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const query = JSON.stringify(filters);
  useEffect(() => {
    let active = true;
    setState({ rows: [], loading: true, error: '' });
    const timer = setTimeout(() => finesService.list(JSON.parse(query)).then(rows => {
      if (active) setState({ rows, loading: false, error: '' });
    }).catch(error => { if (active) setState({ rows: [], loading: false, error: error.message }); }), 200);
    return () => { active = false; clearTimeout(timer); };
  }, [query, records, attempt]);
  return { ...state, retry };
}
