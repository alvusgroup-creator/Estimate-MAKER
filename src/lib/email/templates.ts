/**
 * Plain HTML emails — no framework, inline styles only, so they render the same in Gmail,
 * Outlook and Apple Mail. Every template also returns a text version.
 */
import { formatMoney } from "@/lib/estimates/calc";
import { docWords } from "@/lib/utils";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ESC[c]);
}

function layout(opts: { title: string; bodyHtml: string; cta?: { label: string; url: string }; color: string; footer: string }) {
  const cta = opts.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:${opts.color}"><a href="${opts.cta.url}" style="display:inline-block;padding:12px 22px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">${esc(opts.cta.label)}</a></td></tr></table>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f5f7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e5e7eb">
<tr><td style="height:6px;background:${opts.color};border-radius:12px 12px 0 0"></td></tr>
<tr><td style="padding:28px 28px 8px"><h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${esc(opts.title)}</h1>${opts.bodyHtml}${cta}</td></tr>
<tr><td style="padding:12px 28px 24px;font-size:12px;color:#6b7280;border-top:1px solid #f0f1f3">${opts.footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.55">${s}</p>`;

export type DocSummary = {
  number: string;
  kind: "ESTIMATE" | "INVOICE" | "CHANGE_ORDER";
  title: string | null;
  total: number;
  currency: string;
  locale: string;
  publicUrl: string;
  expiresAt?: Date | null;
  dueDate?: Date | null;
};

export type OrgSummary = { name: string; phone: string | null; email: string | null; primaryColor: string };

/** Customer-facing: "here's your estimate" with the public link. */
export function customerDocumentEmail(opts: { doc: DocSummary; org: OrgSummary; firstName: string; message: string | null }) {
  const { doc, org } = opts;
  const { word, Word } = docWords(doc.kind);
  const money = formatMoney(doc.total, doc.currency, doc.locale);
  const when = doc.kind === "INVOICE"
    ? doc.dueDate ? `Due ${doc.dueDate.toLocaleDateString(doc.locale, { dateStyle: "medium" })}` : null
    : doc.expiresAt ? `Valid until ${doc.expiresAt.toLocaleDateString(doc.locale, { dateStyle: "medium" })}` : null;
  const subject = `${Word} ${doc.number} from ${org.name}${doc.title ? ` — ${doc.title}` : ""}`;

  const custom = opts.message?.trim() || null;
  const intro = custom
    ? custom.split(/\n{2,}/).map((para) => p(esc(para).replace(/\n/g, "<br>"))).join("")
    : p(`Here's your ${word} from ${esc(org.name)}. Open the link below to review it${doc.kind !== "INVOICE" ? " and accept online" : ""}.`);
  const bodyHtml =
    p(`Hi ${esc(opts.firstName)},`) + intro +
    `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;background:#f9fafb;border-radius:8px;width:100%"><tr><td style="padding:14px 16px">
      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">${Word} ${esc(doc.number)}</div>
      ${doc.title ? `<div style="font-size:15px;font-weight:600;margin-top:2px">${esc(doc.title)}</div>` : ""}
      <div style="font-size:22px;font-weight:700;margin-top:6px">${esc(money)}</div>
      ${when ? `<div style="font-size:13px;color:#6b7280;margin-top:2px">${esc(when)}</div>` : ""}
    </td></tr></table>`;

  const contactList = [org.phone, org.email].filter((x): x is string => !!x);
  const contact = contactList.map(esc).join(" · ");
  const footer = `${esc(org.name)}${contact ? ` · ${contact}` : ""}<br>If the button doesn't work, copy this link: <a href="${doc.publicUrl}" style="color:#2563eb">${doc.publicUrl}</a>`;

  const html = layout({ title: `Your ${word} from ${org.name}`, bodyHtml, cta: { label: `View ${word}`, url: doc.publicUrl }, color: org.primaryColor, footer });
  const text = [
    `Hi ${opts.firstName},`,
    "",
    custom ?? `Here's your ${word} from ${org.name}.`,
    "",
    `${Word} ${doc.number}${doc.title ? ` — ${doc.title}` : ""}`,
    `Total: ${money}`,
    ...(when ? [when] : []),
    "",
    `View ${word}: ${doc.publicUrl}`,
    "",
    `${org.name}${contactList.length ? ` · ${contactList.join(" · ")}` : ""}`,
  ].join("\n");
  return { subject, html, text };
}

/** Contractor-facing: the customer did something on the public link. */
export function contractorActivityEmail(opts: {
  kind: "VIEWED" | "ACCEPTED" | "DECLINED";
  doc: DocSummary;
  clientName: string;
  appUrl: string;
  estimateId: string;
  signerName?: string | null;
  reason?: string | null;
  color: string;
}) {
  const { doc } = opts;
  const { word: lower } = docWords(doc.kind);
  const money = formatMoney(doc.total, doc.currency, doc.locale);
  const label = doc.title ? `${doc.number} — ${doc.title}` : doc.number;
  const openUrl = `${opts.appUrl}/estimates/${opts.estimateId}`;

  const heads = {
    VIEWED: {
      subject: `👀 ${opts.clientName} viewed ${lower} ${doc.number}`,
      title: `${opts.clientName} just opened your ${lower}`,
      body: `They're looking at it now. A quick follow-up call or text often closes the job.`,
    },
    ACCEPTED: {
      subject: `✅ ${opts.clientName} accepted ${doc.number} (${money})`,
      title: `${opts.clientName} accepted your ${lower}`,
      body: doc.kind === "CHANGE_ORDER" ? `Signed by ${opts.signerName ?? opts.clientName}. The extra work is approved — it will be included when you invoice the job.` : `Signed by ${opts.signerName ?? opts.clientName}. Next step: schedule the job, then convert it to an invoice from the app.`,
    },
    DECLINED: {
      subject: `❌ ${opts.clientName} declined ${doc.number}`,
      title: `${opts.clientName} declined your ${lower}`,
      body: opts.reason ? `Their reason: “${opts.reason}”` : `No reason given. You can reopen and revise it from the app.`,
    },
  }[opts.kind];

  // heads.body is plain text; escape once for HTML, use as-is for the text part
  const bodyHtml = p(esc(heads.body)) + p(`<strong>${esc(label)}</strong><br>Total: ${esc(money)}`);
  const html = layout({
    title: heads.title,
    bodyHtml,
    cta: { label: "Open in Estimate Builder", url: openUrl },
    color: opts.color,
    footer: `You get this because notifications are on in Settings → Notifications.`,
  });
  const text = `${heads.title}\n\n${heads.body}\n\n${label}\nTotal: ${money}\n\nOpen: ${openUrl}`;
  return { subject: heads.subject, html, text };
}
