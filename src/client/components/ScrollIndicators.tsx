/**
 * Scroll Indicators Component
 *
 * Wraps a horizontally scrollable container and shows left/right
 * arrow buttons when content overflows in that direction.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface ScrollIndicatorsProps {
  children: React.ReactNode;
}

const SCROLL_AMOUNT = 280; // roughly one column width

export function ScrollIndicators({ children }: ScrollIndicatorsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateIndicators = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateIndicators();
    el.addEventListener('scroll', updateIndicators, { passive: true });

    const observer = new ResizeObserver(updateIndicators);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', updateIndicators);
      observer.disconnect();
    };
  }, [updateIndicators]);

  const scrollBy = (direction: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;
    const amount = direction === 'left' ? -SCROLL_AMOUNT : SCROLL_AMOUNT;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* Left indicator */}
      <div
        className={`absolute left-0 top-0 bottom-0 z-10 flex items-center transition-opacity duration-200 ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <button
          type="button"
          onClick={() => scrollBy('left')}
          className="ml-1 w-8 h-8 rounded-full bg-white/90 border border-gray-200 shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white"
          aria-label="Scroll left"
        >
          &#9664;
        </button>
      </div>

      {/* Right indicator */}
      <div
        className={`absolute right-0 top-0 bottom-0 z-10 flex items-center transition-opacity duration-200 ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <button
          type="button"
          onClick={() => scrollBy('right')}
          className="mr-1 w-8 h-8 rounded-full bg-white/90 border border-gray-200 shadow-md flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-white"
          aria-label="Scroll right"
        >
          &#9654;
        </button>
      </div>

      {/* Scrollable container */}
      <div ref={containerRef} className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
