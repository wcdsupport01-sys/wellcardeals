// Existing Sheets use different column orders. Map by their headers and retain
// cells that a partial outbox payload does not specify.
export function sheetRow(record: {id: string | number; row_key:string; payload:Record<string,unknown>}, headers:string[], idColumn:string, previous:string[] = []) {
  return headers.map((column,index) => {
    if (column === 'sync_queue_id') return String(record.id);
    const payload = record.payload || {};
    if (column === idColumn && (payload[column] == null || payload[column] === '')) return String(record.row_key);
    if (!(column in payload)) return previous[index] ?? '';
    const value=payload[column];
    return value==null ? '' : typeof value==='object' ? JSON.stringify(value) : String(value);
  });
}
