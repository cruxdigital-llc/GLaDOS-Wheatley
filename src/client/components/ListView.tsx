import { useMemo, useState } from 'react';
import type { BoardCard, BoardColumn, BoardPhase } from '../../shared/grammar/types.js';

const PHASE_COLORS: Record<string, string> = {
  unclaimed: 'bg-gray-100 text-gray-700',
  planning: 'bg-blue-100 text-blue-700',
  speccing: 'bg-purple-100 text-purple-700',
  implementing: 'bg-yellow-100 text-yellow-700',
  verifying: 'bg-green-100 text-green-700',
  done: 'bg-emerald-100 text-emerald-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-yellow-100 text-yellow-700',
  P3: 'bg-blue-100 text-blue-700',
};

/** Phase sort order for deterministic sorting. */
const PHASE_ORDER: Record<BoardPhase, number> = {
  unclaimed: 0,
  planning: 1,
  speccing: 2,
  implementing: 3,
  verifying: 4,
  done: 5,
};

/** Priority sort order (P0 highest urgency first). */
const PRIORITY_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
};

type SortField = 'title' | 'phase' | 'assignee' | 'priority' | 'due' | 'activity';
type SortDirection = 'asc' | 'desc';

interface ListViewProps {
  columns: BoardColumn[];
  onCardClick: (card: BoardCard) => void;
  currentUser: string;
}

/** Extract the claimant (assignee) from a card, falling back to empty string. */
function getAssignee(card: BoardCard): string {
  return card.claim?.claimant ?? '';
}

/** Extract a priority string for sorting/display. */
function getPriority(card: BoardCard): string {
  return card.metadata?.priority ?? '';
}

/** Extract due date string, empty if unset. */
function getDue(card: BoardCard): string {
  return card.metadata?.due ?? '';
}

/** Derive "last activity" timestamp from claim claimedAt as best available signal. */
function getLastActivity(card: BoardCard): string {
  return card.claim?.claimedAt ?? '';
}

/** Format an ISO date/timestamp for display. */
function formatDate(iso: string): string {
  if (!iso) return '\u2014';
  // Show YYYY-MM-DD portion
  return iso.slice(0, 10);
}

/** Return true when a YYYY-MM-DD date string is before today. */
function isOverdue(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

function comparePrimitive(a: string, b: string, dir: SortDirection): number {
  const cmp = a.localeCompare(b);
  return dir === 'asc' ? cmp : -cmp;
}

function compareNumeric(a: number, b: number, dir: SortDirection): number {
  const cmp = a - b;
  return dir === 'asc' ? cmp : -cmp;
}

export default function ListView({ columns, onCardClick, currentUser }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  /** Flatten all cards from every column. */
  const allCards = useMemo(() => columns.flatMap((col) => col.cards), [columns]);

  /** Sorted cards based on current sort state. */
  const sortedCards = useMemo(() => {
    const cards = [...allCards];
    cards.sort((a, b) => {
      switch (sortField) {
        case 'title':
          return comparePrimitive(a.title, b.title, sortDir);
        case 'phase':
          return compareNumeric(PHASE_ORDER[a.phase], PHASE_ORDER[b.phase], sortDir);
        case 'assignee':
          return comparePrimitive(getAssignee(a), getAssignee(b), sortDir);
        case 'priority': {
          const pa = PRIORITY_ORDER[getPriority(a)] ?? 99;
          const pb = PRIORITY_ORDER[getPriority(b)] ?? 99;
          return compareNumeric(pa, pb, sortDir);
        }
        case 'due':
          return comparePrimitive(getDue(a), getDue(b), sortDir);
        case 'activity':
          return comparePrimitive(getLastActivity(a), getLastActivity(b), sortDir);
        default:
          return 0;
      }
    });
    return cards;
  }, [allCards, sortField, sortDir]);

  /** Handle column header click — toggle direction if same field, otherwise reset to asc. */
  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  /** Render a sort indicator arrow next to the active column header. */
  function sortIndicator(field: SortField): string {
    if (field !== sortField) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  }

  const headerClass =
    'px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700';

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className={headerClass} onClick={() => handleSort('title')}>
              Title{sortIndicator('title')}
            </th>
            <th className={headerClass} onClick={() => handleSort('phase')}>
              Phase{sortIndicator('phase')}
            </th>
            <th className={headerClass} onClick={() => handleSort('assignee')}>
              Assignee{sortIndicator('assignee')}
            </th>
            <th className={headerClass} onClick={() => handleSort('priority')}>
              Priority{sortIndicator('priority')}
            </th>
            <th className={headerClass} onClick={() => handleSort('due')}>
              Due Date{sortIndicator('due')}
            </th>
            <th className={headerClass} onClick={() => handleSort('activity')}>
              Last Activity{sortIndicator('activity')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sortedCards.map((card) => {
            const assignee = getAssignee(card);
            const priority = getPriority(card);
            const due = getDue(card);
            const activity = getLastActivity(card);
            const overdue = isOverdue(due);
            const isCurrentUser = assignee === currentUser;

            return (
              <tr
                key={card.id}
                onClick={() => onCardClick(card)}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {/* Title */}
                <td className="px-3 py-2 font-medium text-gray-900 max-w-xs truncate">
                  {card.title}
                </td>

                {/* Phase badge */}
                <td className="px-3 py-2">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_COLORS[card.phase] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {card.phase}
                  </span>
                </td>

                {/* Assignee */}
                <td className="px-3 py-2 text-gray-600">
                  {assignee ? (
                    <span className={isCurrentUser ? 'font-semibold text-blue-600' : ''}>
                      {assignee}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">unassigned</span>
                  )}
                </td>

                {/* Priority badge */}
                <td className="px-3 py-2">
                  {priority ? (
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${PRIORITY_COLORS[priority] ?? ''}`}
                    >
                      {priority}
                    </span>
                  ) : (
                    <span className="text-gray-400">{'\u2014'}</span>
                  )}
                </td>

                {/* Due date with overdue highlighting */}
                <td className={`px-3 py-2 ${overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                  {formatDate(due)}
                </td>

                {/* Last activity */}
                <td className="px-3 py-2 text-gray-500">
                  {formatDate(activity)}
                </td>
              </tr>
            );
          })}

          {sortedCards.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                No cards to display.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
