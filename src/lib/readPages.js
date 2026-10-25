// Lists use a stable (created_at, id) cursor. Financial totals belong in SQL
// aggregates, not in sums over a browser page. Fail instead of silently clipping
// an unexpectedly large result set.
export async function readPages(makeQuery, { pageSize = 500, maxRows = 20000 } = {}) {
  const rows = [];
  let cursor = null;
  for (;;) {
    let query = makeQuery().order("created_at", { ascending:false, nullsFirst:false }).order("id", { ascending:false }).limit(pageSize);
    if (cursor) query = cursor.created_at == null
      ? query.is("created_at", null).lt("id", cursor.id)
      : query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id}),created_at.is.null`);
    const { data, error, count } = await query;
    if (error) throw error;
    const page = data || [];
    if (!page.length) return rows;
    rows.push(...page);
    if (rows.length > maxRows) throw new Error("This list is too large to load at once. Use a narrower database report.");
    // count is the remaining number matching this page's cursor, not a stale
    // original count. A server with a custom row cap can still paginate safely.
    if (count != null ? page.length >= count : page.length < pageSize) return rows;
    const last = page[page.length-1];
    if (last.id == null || !("created_at" in last) || (cursor?.id === last.id && cursor?.created_at === last.created_at)) throw new Error("The list could not be paged safely. Please retry.");
    cursor = {id:last.id,created_at:last.created_at};
  }
}
