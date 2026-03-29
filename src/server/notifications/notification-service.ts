/**
 * Per-User Notification Service
 *
 * In-memory notification store with per-user preferences.
 * Each user can receive notifications for specific events and
 * configure delivery channels (in-app, email, slack).
 */

import type { Notification, NotificationEvent, NotificationPreferences } from './types.js';
import { EmailSender } from './email-sender.js';

/** Maximum notifications stored per user before oldest are evicted. */
const MAX_NOTIFICATIONS_PER_USER = 200;

/** All available notification events. */
const ALL_EVENTS: NotificationEvent[] = [
  'claim', 'release', 'transition', 'comment', 'mention', 'workflow',
];

let idCounter = 0;

function generateId(): string {
  idCounter += 1;
  return `notif_${Date.now()}_${idCounter}`;
}

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function defaultPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    events: [...ALL_EVENTS],
    channels: {
      inApp: true,
      email: false,
      slack: false,
    },
  };
}

export class UserNotificationService {
  private store = new Map<string, Notification[]>();
  private preferences = new Map<string, NotificationPreferences>();
  private emailSender = new EmailSender();

  /**
   * Send a notification to a user.
   * Respects the user's event filter and channel preferences.
   */
  notify(
    userId: string,
    event: NotificationEvent,
    title: string,
    body: string,
    cardId?: string,
  ): void {
    const prefs = this.getPreferences(userId);

    // Skip if the user has opted out of this event type
    if (!prefs.events.includes(event)) {
      return;
    }

    // In-app notification
    if (prefs.channels.inApp) {
      const notification: Notification = {
        id: generateId(),
        userId,
        event,
        title,
        body,
        cardId,
        read: false,
        createdAt: utcNow(),
      };

      let userNotifications = this.store.get(userId);
      if (!userNotifications) {
        userNotifications = [];
        this.store.set(userId, userNotifications);
      }

      userNotifications.push(notification);

      // Evict oldest when over limit
      if (userNotifications.length > MAX_NOTIFICATIONS_PER_USER) {
        const excess = userNotifications.length - MAX_NOTIFICATIONS_PER_USER;
        userNotifications.splice(0, excess);
      }
    }

    // Email channel (stub/mock)
    if (prefs.channels.email) {
      void this.emailSender.sendEmail(
        prefs.userId,
        `[Wheatley] ${title}`,
        body,
      );
    }

    // Slack channel — would integrate with the webhook-based NotificationService
    // For now, just log it
    if (prefs.channels.slack) {
      // eslint-disable-next-line no-console
      console.log(`[slack-stub] Notification for ${userId}: ${title}`);
    }
  }

  /** Get unread notifications for a user (newest first). */
  getUnread(userId: string): Notification[] {
    const all = this.store.get(userId) ?? [];
    return [...all].reverse().filter((n) => !n.read);
  }

  /** Get all notifications for a user (newest first), with optional limit. */
  getAll(userId: string, limit?: number): Notification[] {
    const all = this.store.get(userId) ?? [];
    const reversed = [...all].reverse();
    return limit !== undefined ? reversed.slice(0, limit) : reversed;
  }

  /** Mark a single notification as read. */
  markRead(userId: string, notificationId: string): void {
    const all = this.store.get(userId);
    if (!all) return;
    const notif = all.find((n) => n.id === notificationId);
    if (notif) {
      notif.read = true;
    }
  }

  /** Mark all notifications as read for a user. */
  markAllRead(userId: string): void {
    const all = this.store.get(userId);
    if (!all) return;
    for (const notif of all) {
      notif.read = true;
    }
  }

  /** Get a user's notification preferences (returns defaults if not set). */
  getPreferences(userId: string): NotificationPreferences {
    return this.preferences.get(userId) ?? defaultPreferences(userId);
  }

  /** Update a user's notification preferences (partial merge). */
  updatePreferences(userId: string, prefs: Partial<NotificationPreferences>): void {
    const current = this.getPreferences(userId);
    const updated: NotificationPreferences = {
      ...current,
      userId,
      ...(prefs.events !== undefined ? { events: prefs.events } : {}),
      channels: {
        ...current.channels,
        ...(prefs.channels ?? {}),
      },
    };
    this.preferences.set(userId, updated);
  }
}
