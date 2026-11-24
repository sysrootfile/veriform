/**
 * E-posta gönderim portu — SMTP (nodemailer, lazy import) veya console (geliştirme).
 * Prod'da SMTP_HOST vb. ortam değişkenleriyle yapılandırılır; yoksa mail yerine
 * log düşer (nazik düşüş, panel çalışmaya devam eder).
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}

/** Geliştirme/devre dışı modu: maili tam metniyle loga yazar (bağlantı token'ları görünür). */
export function createConsoleEmailSender(): EmailSender {
  return {
    async send(email) {
      console.log(`[mailer:console] → ${email.to} | ${email.subject}\n${email.text}`);
    },
  };
}

/** SMTP gönderici — nodemailer lazy import (paket yoksa çağrı anında hata). */
export function createSmtpEmailSender(config: {
  host: string;
  port: number;
  user?: string | undefined;
  pass?: string | undefined;
  from: string;
}): EmailSender {
  return {
    async send(email) {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        ...(config.user ? { auth: { user: config.user, pass: config.pass ?? "" } } : {}),
      });
      await transport.sendMail({
        from: config.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    },
  };
}

/** Ortam değişkenlerinden gönderici seçer — SMTP yoksa console. */
export function createMailSenderFromEnv(
  env: Record<string, string | undefined> = process.env,
): EmailSender {
  if (env.SMTP_HOST) {
    return createSmtpEmailSender({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT ?? "587"),
      ...(env.SMTP_USER ? { user: env.SMTP_USER } : {}),
      ...(env.SMTP_PASS ? { pass: env.SMTP_PASS } : {}),
      from: env.SMTP_FROM ?? "Veriform <noreply@veriform.io>",
    });
  }
  return createConsoleEmailSender();
}
