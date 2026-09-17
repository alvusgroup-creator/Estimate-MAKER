import { Resend } from "resend";

/**
 * Thin wrapper over Resend. When RESEND_API_KEY is missing every send is a no-op that
 * logs to the console, so local dev and the public link keep working without an account.
 */
const FROM = process.env.EMAIL_FROM ?? "EasyInvoice <onboarding@resend.dev>";

export function emailEnabled() {
  return !!process.env.RESEND_API_KEY;
}

let client: Resend | null = null;
function resend() {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Contractor's address so the customer's reply goes to them, not to us */
  replyTo?: string | null;
  /** Shown as the sender name; the address stays ours (domain verification) */
  fromName?: string | null;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: true; id: string | null } | { ok: false; error: string }> {
  if (!emailEnabled()) {
    console.info(`[email] (disabled) to=${input.to} subject="${input.subject}"`);
    return { ok: true, id: null };
  }
  const address = FROM.match(/<(.+)>/)?.[1] ?? FROM;
  const from = input.fromName ? `${input.fromName.replace(/[<>"]/g, "")} <${address}>` : FROM;
  try {
    const { data, error } = await resend().emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}
