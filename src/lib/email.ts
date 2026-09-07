import nodemailer from "nodemailer";
import { APP_TITLE } from "./config";

/**
 * Outbound email via Gmail SMTP. Set GMAIL_USER and GMAIL_APP_PASSWORD (a Google "app password",
 * not the account password). If they are missing, sending is skipped and logged.
 */
export function emailConfigured(): boolean {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export type Mail = { to: string; subject: string; text: string; html?: string; replyTo?: string };

export async function sendEmail(mail: Mail): Promise<{ sent: boolean; error?: string }> {
  if (!emailConfigured()) {
    console.warn(`[email] skipped (GMAIL_USER/GMAIL_APP_PASSWORD not set): "${mail.subject}" -> ${mail.to}`);
    return { sent: false, error: "not configured" };
  }
  try {
    await getTransporter().sendMail({
      from: `"${APP_TITLE}" <${process.env.GMAIL_USER}>`,
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      text: mail.text,
      html: mail.html ?? textToHtml(mail.text),
    });
    return { sent: true };
  } catch (err) {
    console.error("[email] send failed", err);
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Minimal plain-text to HTML: escape, autolink URLs, keep line breaks. */
function textToHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linked = esc.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1c1917;white-space:pre-wrap">${linked}</div>`;
}
