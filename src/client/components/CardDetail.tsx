/**
 * Card Detail Panel
 *
 * Displays full card detail with spec file contents.
 */

import React from 'react';
import type { CardDetailResponse } from '../api.js';

interface CardDetailProps {
  detail: CardDetailResponse;
  onClose: () => void;
}

export function CardDetail({ detail, onClose }: CardDetailProps) {
  const { card, specContents } = detail;

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50">
      <div className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
            <p className="text-sm text-gray-500">
              {card.id} &middot; {card.phase} &middot; {card.source}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Spec contents */}
        <div className="px-6 py-4 space-y-6">
          {specContents && Object.keys(specContents).length > 0 ? (
            Object.entries(specContents).map(([fileName, content]) => (
              <div key={fileName}>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-gray-400">&#128196;</span>
                  {fileName}
                </h3>
                <pre className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-800 overflow-x-auto whitespace-pre-wrap">
                  {content}
                </pre>
              </div>
            ))
          ) : (
            <p className="text-gray-400 text-center py-8">
              No spec files available for this card.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
