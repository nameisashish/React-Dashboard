import { useState } from 'react';
import { Button, Card } from '../components/ui.jsx';
import { finesService } from '../services/finesService.js';
export function ImportPage({ onImported }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run(commit) {
    setBusy(true); setError('');
    try {
      const data = await finesService.import(file, commit); setResult(data);
      if (data.imported) onImported();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <Card className="import-card"><span className="eyebrow red">DATA INTAKE</span><h2>Validate before importing</h2>
    <p>Upload a validated-source workbook (.xlsx, up to 5 MB and 10,000 rows). No records are saved until you review validation and select Import.</p>
    <p>Required columns: <code>CustomerID, Fines Imposed, Status, Reason, Date, SourceArea</code>.</p>
    <p>Status: Valid, Invalid or Pending. SourceArea: Logistics, Warehouse or Manufacturing. Dates: Excel dates or YYYY-MM-DD. Amounts: USD, nonnegative, up to two decimals. This checks structure; business validity must be confirmed separately.</p>
    <input aria-label="Excel dataset" type="file" accept=".xlsx" disabled={busy} onChange={e => { setFile(e.target.files[0]); setResult(null); setError(''); }}/>
    <div className="import-actions"><Button disabled={!file || busy} onClick={() => run(false)}>{busy ? 'Processing…' : 'Validate workbook'}</Button>
    {result?.valid && !result.imported && <Button disabled={busy} onClick={() => run(true)}>Import {result.rows} records</Button>}</div>
    {error && <p role="alert" className="field-error">{error}</p>}
    {result && <div role="status"><h3>{result.imported ? `${result.imported} records imported` : result.valid ? `${result.rows} rows passed validation` : 'Validation failed — no records imported'}</h3>
    {result.errors?.map(e => <p key={e.row}>Row {e.row}: {e.message}</p>)}</div>}
  </Card>;
}
