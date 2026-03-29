/**
 * Email Sender (Stub)
 *
 * Reads SMTP configuration from environment variables.
 * If not configured, logs a warning and skips.
 * In mock mode (always, since we avoid a real SMTP dependency),
 * the email content is logged to the console.
 */

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function loadSmtpConfig(): SmtpConfig | null {
  const host = process.env['WHEATLEY_SMTP_HOST'];
  const port = process.env['WHEATLEY_SMTP_PORT'];
  const user = process.env['WHEATLEY_SMTP_USER'];
  const pass = process.env['WHEATLEY_SMTP_PASS'];
  const from = process.env['WHEATLEY_SMTP_FROM'];

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return null;
  }

  return { host, port: portNum, user, pass, from };
}

export class EmailSender {
  private config: SmtpConfig | null;
  private warned = false;

  constructor() {
    this.config = loadSmtpConfig();
  }

  /**
   * Send an email. In practice this is a mock/stub that logs the email.
   * A real implementation would use nodemailer or a raw SMTP client.
   */
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    if (!this.config) {
      if (!this.warned) {
        // eslint-disable-next-line no-console
        console.warn(
          '[email-sender] SMTP not configured (set WHEATLEY_SMTP_HOST, WHEATLEY_SMTP_PORT, ' +
          'WHEATLEY_SMTP_USER, WHEATLEY_SMTP_PASS, WHEATLEY_SMTP_FROM). Skipping email.',
        );
        this.warned = true;
      }
      return;
    }

    // Mock mode: log the email rather than sending it
    // eslint-disable-next-line no-console
    console.log(
      `[email-sender] (mock) From: ${this.config.from} | To: ${to} | Subject: ${subject}\n` +
      `  Body: ${body.slice(0, 200)}${body.length > 200 ? '...' : ''}`,
    );
  }
}
