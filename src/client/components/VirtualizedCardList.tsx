/**
 * Virtualized Card List
 *
 * Renders a windowed list of cards for boards with 100+ items.
 * Uses a simple virtual scroll implementation without external libraries.
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import type { BoardCard } from '../../shared/grammar/types.js';

interface VirtualizedCardListProps {
  cards: BoardCard[];
  itemHeight: number;
  containerHeight: number;
  renderCard: (card: BoardCard, index: number) => React.ReactNode;
  overscan?: number;
}

export function VirtualizedCardList({
  cards,
  itemHeight,
  containerHeight,
  renderCard,
  overscan = 5,
}: VirtualizedCardListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const totalHeight = cards.length * itemHeight;

  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visible = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(cards.length - 1, start + visible + overscan * 2);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, itemHeight, containerHeight, cards.length, overscan]);

  const visibleCards = useMemo(() => {
    const items: React.ReactNode[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      items.push(
        <div
          key={cards[i].id}
          style={{
            position: 'absolute',
            top: i * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
          }}
        >
          {renderCard(cards[i], i)}
        </div>,
      );
    }
    return items;
  }, [startIndex, endIndex, cards, itemHeight, renderCard]);

  // For small lists, skip virtualization
  if (cards.length <= 50) {
    return (
      <div>
        {cards.map((card, i) => (
          <div key={card.id}>{renderCard(card, i)}</div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflow: 'auto', position: 'relative' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleCards}
      </div>
    </div>
  );
}
