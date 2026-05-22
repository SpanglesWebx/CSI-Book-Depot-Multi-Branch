
// src/components/Pagination.jsx
import React from "react";

export default function Pagination({ page = 1, totalPages = 1, onPageChange }) {
  // Defensive casts to numbers
  const current = Number(page) || 1;
  const total = Math.max(0, Number(totalPages) || 0);

  // If there's only one (or zero) page, don't render pagination
  if (total <= 1) return null;

  const pages = [];
  const windowSize = 1; // neighbors around current page

  // always include first
  pages.push(1);

  // left ellipsis
  if (current - windowSize > 2) pages.push("left-ellipsis");

  // middle pages
  const start = Math.max(2, current - windowSize);
  const end = Math.min(total - 1, current + windowSize);
  for (let i = start; i <= end; i++) pages.push(i);

  // right ellipsis
  if (current + windowSize < total - 1) pages.push("right-ellipsis");

  // always include last
  if (total > 1) pages.push(total);

  const handleClick = (p) => {
    if (!p || p === current || p === "left-ellipsis" || p === "right-ellipsis") return;
    if (typeof onPageChange === "function") onPageChange(Number(p));
  };

  return (
    <div className="flex justify-center items-center gap-2 mt-4 select-none">
      {/* Prev */}
      <button
        aria-label="Previous page"
        className="px-3 py-1 rounded-full text-black hover:bg-[#C8FAD6]"
        disabled={current === 1}
        onClick={() => handleClick(current - 1)}
      >
        &lt;
      </button>

      {pages.map((p, idx) =>
        p === "left-ellipsis" || p === "right-ellipsis" ? (
          <span key={p + idx} className="px-2 select-none">…</span>
        ) : (
          <button
            key={`page-${p}`}
            onClick={() => handleClick(p)}
            className={`w-8 h-8 rounded-full transition-colors ${p === current ? "bg-[#007867] text-white" : "text-black hover:bg-[#C8FAD6]"
              }`}
            aria-current={p === current ? "page" : undefined}
            aria-label={`Go to page ${p}`}
          >
            {p}
          </button>
        )
      )}

      {/* Next */}
      <button
        aria-label="Next page"
        className="px-3 py-1 rounded-full text-black hover:bg-[#C8FAD6]"
        disabled={current === total}
        onClick={() => handleClick(current + 1)}
      >
        &gt;
      </button>
    </div>
  );
}
