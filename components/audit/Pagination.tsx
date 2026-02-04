'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getVisiblePages = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>

      {getVisiblePages()[0] > 1 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(1)}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
          >
            1
          </Button>
          {getVisiblePages()[0] > 2 && (
            <span className="text-gray-600 px-1">...</span>
          )}
        </>
      )}

      {getVisiblePages().map((p) => (
        <Button
          key={p}
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(p)}
          className={`h-8 w-8 p-0 ${
            p === page
              ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          {p}
        </Button>
      ))}

      {getVisiblePages()[getVisiblePages().length - 1] < totalPages && (
        <>
          {getVisiblePages()[getVisiblePages().length - 1] < totalPages - 1 && (
            <span className="text-gray-600 px-1">...</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
          >
            {totalPages}
          </Button>
        </>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
