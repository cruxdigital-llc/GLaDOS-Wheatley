/**
 * NotificationBell Component
 *
 * Bell icon with unread count badge. Opens a dropdown of recent
 * notifications. Polls every 30 seconds for new notifications.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api.js';
import type { NotificationData } from '../api.js';

interface NotificationBellProps {
  onCardClick?: (cardId: string) => void;
}

const POLL_INTERVAL = 30_000;

export function NotificationBell({ onCardClick }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const { count } = await fetchUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently ignore — polling will retry
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const { notifications: items } = await fetchNotifications();
      setNotifications(items.slice(0, 20));
    } catch {
      // Silently ignore
    }
  }, []);

  // Poll for unread count
  useEffect(() => {
    void refreshCount();
    const interval = setInterval(() => void refreshCount(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (open) {
      void refreshNotifications();
    }
  }, [open, refreshNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // Silently ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // Silently ignore
    }
  };

  const handleNotificationClick = (notif: NotificationData) => {
    if (!notif.read) {
      void handleMarkRead(notif.id);
    }
    if (notif.cardId && onCardClick) {
      onCardClick(notif.cardId);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative text-sm px-2 py-1 rounded border bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
        aria-label="Notifications"
      >
        {/* Bell icon (SVG) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 inline-block"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void handleMarkAllRead()}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-400">
                No notifications
              </div>
            )}
            {notifications.map((notif) => (
              <button
                key={notif.id}
                type="button"
                onClick={() => handleNotificationClick(notif)}
                className={`w-full text-left px-3 py-2 border-b border-gray-50 hover:bg-gray-50 ${
                  notif.read ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!notif.read && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                  <div className={!notif.read ? '' : 'ml-4'}>
                    <div className="text-sm font-medium text-gray-800">{notif.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(notif.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
