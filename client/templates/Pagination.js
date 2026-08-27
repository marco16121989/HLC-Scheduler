import { useEffect, useMemo, useState } from "react";

export const usePagination = (items, pageSize = 25, resetKey = "") => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => setPage(1), [resetKey]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);
  return { page, setPage, totalPages, pageItems, totalItems: items.length };
};

export const PaginationControls = ({ page, setPage, totalPages, totalItems }) => {
  if (totalPages <= 1) return null;
  return <nav className="list-pagination" aria-label="Paginazione elenco">
    <span>{totalItems} elementi · Pagina {page} di {totalPages}</span>
    <div className="btn-group" role="group">
      <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Precedente</button>
      <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Successiva</button>
    </div>
  </nav>;
};
