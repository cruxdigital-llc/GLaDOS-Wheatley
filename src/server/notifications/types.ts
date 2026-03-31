/**
 * Per-User Notification Types
 *
 * Defines notification events, preferences, and the notification shape.
 */

export type NotificationEvent = 'claim' | 'release' | 'transition' | 'comment' | 'mention' | 'workflow';

export interface NotificationPreferences {
  userId: string;
  events: NotificationEvent[];
  channels: {
    inApp: boolean;
    email: boolean;
    slack: boolean;
  };
}

export interface Notification {
  id: string;
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
  cardId?: string;
  read: boolean;
  createdAt: string;
}
