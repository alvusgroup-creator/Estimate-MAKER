import type { CSSProperties, ReactNode } from "react";
import type { Template } from "@/generated/prisma/enums";
import type { OrgBranding, ClientDTO } from "@/lib/estimates/dto";
import { formatMoney } from "@/lib/estimates/calc";
import { UNIT_LABELS } from "@/lib/estimates/schemas";
import { clientDisplayName, formatAddress } from "@/lib/utils";

/**
 * The document itself. Pure presentational; receives plain numbers/strings so it renders
 * identically in the editor preview, the public /e/[token] page and print-to-PDF.
 * Six layouts share one data contract and one set of pieces (parties, meta, lines, totals,
 * balance bar, payment instructions, notes, signatures). Colors come from the org:
 * --doc-primary drives headers/tables, --doc-accent the gradients.
 */
export type DocumentLine = {
  name: string;
  description?: string | null;
  quantity: number;
  unit: keyof typeof UNIT_LABELS;
  unitPrice: number;
  lineTotal: number;
  isOptional?: boolean;
};

export type DocumentData = {
  number: string;
  title?: string | null;
  issueDate: string | Date;
  expiresAt?: string | Date | null;
  client: ClientDTO;
  jobAddress: { addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null };
  lines: DocumentLine[];
  subtotal: number;
  discountAmount: number;
  taxLabel: string;
  taxRate: number;
  taxAmount: number;
  total: number;
  depositAmount: number;
  amountPaid?: number; // invoices: Σ payments received
  notes?: string | null;
  terms?: string | null;
  // Customer acceptance (public link)
  acceptedAt?: string | Date | null;
  signerName?: string | null;
  signatureDataUrl?: string | null; // drawn on the public link; falls back to the typed name
  // Invoice mode
  kind?: "ESTIMATE" | "INVOICE" | "CHANGE_ORDER";
  dueDate?: string | Date | null;
  paidAt?: string | Date | null;
  // Change-order mode: the accepted estimate this amends, so the document can show the revised contract total
  changeOrder?: { parentNumber: string; parentTitle?: string | null; originalTotal: number; priorChangesTotal: number } | null;
  // Job photos shown on the document
  photos?: { url: string; caption?: string | null }[];
};

type Ctx = {
  org: OrgBranding;
  data: DocumentData;
  money: (n: number) => string;
  date: (d: string | Date) => string;
  orgAddr: string[];
  clientAddr: string[];
  jobAddr: string[];
  showJob: boolean;
  pct: string;
  isInvoice: boolean;
  isChangeOrder: boolean;
  heading: string;
  balance: number; // invoices: what's still owed
};

export function EstimateDocument({ template, org, data, className }: {
  template: Template;
  org: OrgBranding;
  data: DocumentData;
  className?: string;
}) {
  const vars = { "--doc-primary": org.primaryColor, "--doc-accent": org.accentColor } as CSSProperties;
  const clientAddr = formatAddress(data.client);
  const jobAddr = formatAddress(data.jobAddress);
  const isInvoice = data.kind === "INVOICE";
  const ctx: Ctx = {
    org,
    data,
    money: (n) => formatMoney(n, org.currency, org.locale),
    date: (d) => new Date(d).toLocaleDateString(org.locale, { year: "numeric", month: "short", day: "numeric" }),
    orgAddr: formatAddress(org),
    clientAddr,
    jobAddr,
    showJob: jobAddr.length > 0 && jobAddr.join() !== clientAddr.join(),
    pct: (data.taxRate * 100).toFixed(2).replace(/\.?0+$/, ""),
    isInvoice,
    isChangeOrder: data.kind === "CHANGE_ORDER",
    heading: isInvoice ? "Invoice" : data.kind === "CHANGE_ORDER" ? "Change Order" : "Estimate",
    balance: Math.max(0, Math.round((data.total - (data.amountPaid ?? 0)) * 100) / 100),
  };

  const Layout = { CLEAN: CleanLayout, BOLD: BoldLayout, CLASSIC: ClassicLayout, NOIR: NoirLayout, MINIMAL: MinimalLayout, EXECUTIVE: ExecutiveLayout }[template] ?? CleanLayout;

  return (
    <article
      style={vars}
      className={`doc @container bg-white text-[#111] text-[13px] leading-normal w-full mx-auto min-h-[900px] flex flex-col ${className ?? ""}`}
    >
      <Layout {...ctx} />
    </article>
  );
}

/* ═══════════════════════════ shared pieces ═══════════════════════════ */

function Logo({ org, className = "", size = "md" }: { org: OrgBranding; className?: string; size?: "sm" | "md" | "lg" }) {
  const h = size === "lg" ? "h-20 max-w-[260px]" : size === "sm" ? "h-12 max-w-[180px]" : "h-16 max-w-[220px]";
  if (org.logoUrl) {
    // Wide and square logos both work: constrain height, let width follow, cap width.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={org.logoUrl} alt={org.name} className={`${h} w-auto object-contain object-left ${className}`} />;
  }
  const box = size === "lg" ? "h-20 w-20 text-3xl" : size === "sm" ? "h-12 w-12 text-xl" : "h-16 w-16 text-2xl";
  return (
    <div className={`${box} rounded-xl grid place-items-center text-white font-bold ${className}`} style={{ background: "var(--doc-primary)" }}>
      {org.name.charAt(0)}
    </div>
  );
}

function Label({ children, className = "", color }: { children: ReactNode; className?: string; color?: boolean }) {
  return <p className={`text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 ${color ? "" : "text-neutral-500"} ${className}`} style={color ? { color: "var(--doc-primary)" } : undefined}>{children}</p>;
}

function Party({ label, name, lines, contact, color, big }: { label: string; name?: string; lines: string[]; contact?: (string | null | undefined)[]; color?: boolean; big?: boolean }) {
  return (
    <div className="min-w-0">
      <Label color={color}>{label}</Label>
      {name && <p className={`font-bold leading-tight break-words ${big ? "text-[16px]" : "text-[14px]"}`}>{name}</p>}
      {lines.map((l, i) => <p key={i} className="text-neutral-700">{l}</p>)}
      {contact?.filter(Boolean).map((c, i) => <p key={`c${i}`} className="text-neutral-600">{c}</p>)}
    </div>
  );
}

/** Small right-aligned contact stack (phone / email / address / website), as in the letterhead references. */
function ContactStack({ org, orgAddr, className = "", light }: { org: OrgBranding; orgAddr: string[]; className?: string; light?: boolean }) {
  const lines = [org.licenseNo ? `Lic. ${org.licenseNo}` : null, org.phone, org.email, ...orgAddr, org.website].filter((x): x is string => !!x);
  return (
    <div className={`text-[11px] leading-[1.6] ${light ? "text-white/85" : "text-neutral-600"} ${className}`}>
      {lines.map((l, i) => <p key={i}>{l}</p>)}
    </div>
  );
}

function metaRows(ctx: Ctx): [string, string][] {
  const { data, date, isInvoice, isChangeOrder } = ctx;
  const rows: [string, string][] = [[isInvoice ? "Number" : isChangeOrder ? "Change order #" : "Estimate #", data.number], ["Date", date(data.issueDate)]];
  if (isChangeOrder && data.changeOrder) rows.push(["Amends", data.changeOrder.parentNumber]);
  if (isInvoice) rows.push(["Due date", data.dueDate ? date(data.dueDate) : "On receipt"]);
  if (!isInvoice && !isChangeOrder && data.expiresAt) rows.push(["Valid until", date(data.expiresAt)]);
  if (isInvoice && data.paidAt) rows.push(["Paid", date(data.paidAt)]);
  return rows;
}

/** Number / date / due — `right` style is the "NUMBER: INV-1001" stack from the references. */
function Meta({ ctx, style = "card", light }: { ctx: Ctx; style?: "card" | "right" | "plain"; light?: boolean }) {
  const rows = metaRows(ctx);
  if (style === "right") {
    return (
      <dl className="grid grid-cols-[auto_auto] justify-start @xl:justify-end content-start self-start gap-x-3 gap-y-0.5 text-[11.5px] whitespace-nowrap">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className={`text-right font-bold uppercase tracking-wider text-[9.5px] self-center ${light ? "text-white/80" : ""}`} style={light ? undefined : { color: "var(--doc-primary)" }}>{k}:</dt>
            <dd className={`text-right font-semibold ${light ? "text-white" : "text-neutral-800"}`}>{v}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[12.5px] whitespace-nowrap ${style === "card" ? "rounded-lg bg-neutral-100 px-5 py-4 @xl:min-w-[220px]" : ""}`}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="font-semibold text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

type Head = "primary" | "gradient" | "dark" | "light" | "boxed";

function Lines({ ctx, head, zebra }: { ctx: Ctx; head: Head; zebra?: boolean }) {
  const { data, money } = ctx;
  const th = "text-[10px] font-bold uppercase tracking-[0.1em] py-2.5 px-2 @xl:px-3";
  const headCls = {
    primary: `${th} text-white`,
    gradient: `${th} text-white`,
    dark: `${th} text-white`,
    light: `${th} text-neutral-500 border-b-2 border-neutral-800`,
    boxed: `${th} text-neutral-800 bg-neutral-100 border border-neutral-400`,
  }[head];
  const headStyle: CSSProperties | undefined = {
    primary: { background: "var(--doc-primary)" },
    gradient: { background: "linear-gradient(90deg, var(--doc-primary), var(--doc-accent))" },
    dark: { background: "#1f2937" },
    light: undefined,
    boxed: undefined,
  }[head];
  const td = head === "boxed" ? "py-2.5 px-2 @xl:px-3 border border-neutral-400 align-top" : "py-3 px-2 @xl:px-3 border-b border-neutral-200 align-top";

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr style={headStyle}>
          <th className={`${headCls} text-left`}>Description</th>
          <th className={`${headCls} text-right w-[64px] @xl:w-[84px]`}>Qty</th>
          <th className={`${headCls} text-right w-[72px] @xl:w-[96px]`}>Rate</th>
          <th className={`${headCls} text-right w-[84px] @xl:w-[108px]`}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.lines.map((l, i) => (
          <tr key={i} className={`${l.isOptional ? "text-neutral-500" : ""} ${zebra && i % 2 ? "bg-neutral-50" : ""}`}>
            <td className={td}>
              <p className="font-bold leading-snug">
                {l.name}
                {l.isOptional && <span className="ml-2 text-[9.5px] uppercase tracking-wider border border-neutral-300 rounded px-1 py-px font-medium">optional</span>}
              </p>
              {l.description && <p className="text-neutral-500 text-[11.5px] whitespace-pre-line mt-0.5 leading-snug">{l.description}</p>}
            </td>
            <td className={`${td} text-right tabular-nums whitespace-nowrap`}>{l.quantity} <span className="text-neutral-500">{UNIT_LABELS[l.unit]}</span></td>
            <td className={`${td} text-right tabular-nums`}>{money(l.unitPrice)}</td>
            <td className={`${td} text-right tabular-nums font-bold`}>{money(l.lineTotal)}</td>
          </tr>
        ))}
        {data.lines.length === 0 && (
          <tr><td colSpan={4} className={`${td} text-center text-neutral-400 py-8`}>No items yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

/**
 * Subtotal / discount / tax / total (+ paid, deposit, change-order summary), then the money line
 * the customer looks for: BALANCE DUE on invoices, TOTAL on estimates. `bar` = dark gradient
 * band from the references; `line` = big bold row with a rule; `box` = classic bordered total.
 */
function Totals({ ctx, finish, align = "right" }: { ctx: Ctx; finish: "bar" | "line" | "box"; align?: "right" | "full" }) {
  const { data, money, pct, isInvoice, isChangeOrder, balance } = ctx;
  const row = "flex justify-between items-baseline py-[3px] text-neutral-700";
  const co = isChangeOrder ? data.changeOrder : null;
  const paid = data.amountPaid ?? 0;
  const finalLabel = isInvoice ? (balance > 0 ? "Balance due" : "Paid in full") : isChangeOrder ? (data.total < 0 ? "Credit" : "Change total") : "Total";
  const finalValue = isInvoice ? balance : data.total;

  return (
    <div className={align === "full" ? "w-full" : "w-full max-w-[320px] ml-auto"}>
      <div className={row}><span>Subtotal</span><span className="tabular-nums font-semibold text-neutral-900">{money(data.subtotal)}</span></div>
      {data.discountAmount > 0 && <div className={row}><span>Discount</span><span className="tabular-nums">− {money(data.discountAmount)}</span></div>}
      {data.taxRate > 0 && <div className={row}><span>{data.taxLabel} ({pct}%)</span><span className="tabular-nums">{money(data.taxAmount)}</span></div>}
      {isInvoice && (
        <>
          <div className={row}><span>Total</span><span className="tabular-nums font-semibold text-neutral-900">{money(data.total)}</span></div>
          <div className={row}><span>Paid</span><span className="tabular-nums">{money(paid)}</span></div>
        </>
      )}
      {co && (
        <>
          <div className={row}><span>Original estimate {co.parentNumber}</span><span className="tabular-nums">{money(co.originalTotal)}</span></div>
          {co.priorChangesTotal !== 0 && <div className={row}><span>Previously approved changes</span><span className="tabular-nums">{money(co.priorChangesTotal)}</span></div>}
        </>
      )}

      {finish === "bar" ? (
        <div className="mt-3 flex justify-between items-center px-4 py-2.5 text-white" style={{ background: "linear-gradient(90deg, #111827, #4b5563)" }}>
          <span className="text-[12px] font-bold uppercase tracking-wider">{finalLabel}</span>
          <span className="text-[18px] font-bold tabular-nums">{money(finalValue)}</span>
        </div>
      ) : finish === "box" ? (
        <div className="mt-3 flex justify-between items-center border-2 border-neutral-800 px-3 py-2">
          <span className="text-[13px] font-bold uppercase tracking-wide">{finalLabel}</span>
          <span className="text-[18px] font-bold tabular-nums">{money(finalValue)}</span>
        </div>
      ) : (
        <div className="mt-2 pt-2.5 border-t-2 border-neutral-800 flex justify-between items-baseline">
          <span className="text-[13px] font-bold uppercase tracking-wide">{finalLabel}</span>
          <span className="text-[20px] font-bold tabular-nums">{money(finalValue)}</span>
        </div>
      )}

      {co && (
        <div className="flex justify-between items-baseline pt-2 text-[12.5px] font-semibold text-neutral-900"><span>Revised contract total</span><span className="tabular-nums">{money(co.originalTotal + co.priorChangesTotal + data.total)}</span></div>
      )}
      {data.depositAmount > 0 && !isInvoice && !isChangeOrder && (
        <div className={`${row} text-[12px] mt-1.5`}>
          <span>Deposit due on acceptance</span>
          <span className="tabular-nums font-semibold text-neutral-900">{money(data.depositAmount)}</span>
        </div>
      )}
    </div>
  );
}

/** "Payment instructions" (invoices) from Settings; nothing rendered when the org hasn't set it. */
function PaymentInstructions({ ctx }: { ctx: Ctx }) {
  if (!ctx.isInvoice || !ctx.org.paymentInstructions) return null;
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] font-bold mb-1">Payment instructions</p>
      <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-neutral-700">{ctx.org.paymentInstructions}</p>
    </div>
  );
}

function Notes({ data, title = "Notes" }: { data: DocumentData; title?: string }) {
  if (!data.notes) return null;
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] font-bold mb-1">{title}</p>
      <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-neutral-700">{data.notes}</p>
    </div>
  );
}

function Terms({ data }: { data: DocumentData }) {
  if (!data.terms) return null;
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] font-bold mb-1">Terms &amp; conditions</p>
      <p className="whitespace-pre-line text-[11px] leading-relaxed text-neutral-600">{data.terms}</p>
    </div>
  );
}

/** Bottom block used by most layouts: payment instructions + notes on the left, totals on the right. */
function BottomSplit({ ctx, finish }: { ctx: Ctx; finish: "bar" | "line" | "box" }) {
  const left = (ctx.isInvoice && ctx.org.paymentInstructions) || ctx.data.notes;
  return (
    <section className={`grid gap-8 ${left ? "@xl:grid-cols-[1fr_320px]" : ""} items-end`}>
      {left ? (
        <div className="space-y-4 self-end">
          <PaymentInstructions ctx={ctx} />
          <Notes data={ctx.data} title={ctx.isInvoice ? "Comments" : "Notes"} />
        </div>
      ) : null}
      <Totals ctx={ctx} finish={finish} align={left ? "full" : "right"} />
    </section>
  );
}

/** Signature block: contractor (from settings) + customer (from acceptance, or blank line). */
function Signatures({ ctx, tone = "light" }: { ctx: Ctx; tone?: "light" | "dark" }) {
  const { org, data, date, isInvoice, isChangeOrder } = ctx;
  const line = tone === "dark" ? "border-neutral-800" : "border-neutral-400";
  const customerCaption = data.acceptedAt
    ? `${data.signerName ?? "Client"} · ${isChangeOrder ? "Approved" : "Accepted"} ${date(data.acceptedAt)}`
    : isInvoice ? "Client" : isChangeOrder ? "Customer approval" : "Customer signature";
  return (
    <section className="grid grid-cols-2 gap-10 pt-2 break-inside-avoid">
      <div>
        <div className={`h-[56px] flex items-end border-b ${line}`}>
          {!isInvoice && data.acceptedAt && data.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.signatureDataUrl} alt="Customer signature" className="h-12 w-auto max-w-full object-contain object-left-bottom" />
          ) : !isInvoice && data.acceptedAt && data.signerName ? (
            <span className="font-[cursive] italic text-[20px] leading-none pb-1 text-neutral-900">{data.signerName}</span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-600">{customerCaption}</p>
      </div>
      <div>
        <div className={`h-[56px] flex items-end justify-end border-b ${line}`}>
          {org.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.signatureDataUrl} alt="Signature" className="h-12 w-auto max-w-full object-contain object-right-bottom" />
          ) : null}
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-800 font-semibold text-right">{org.signatureName || org.name}</p>
      </div>
    </section>
  );
}

function ThankYou({ ctx, className = "" }: { ctx: Ctx; className?: string }) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${className}`} style={{ color: "var(--doc-primary)" }}>
      {ctx.isInvoice ? "Thank you for your business" : ctx.isChangeOrder ? "Approve above to proceed with the change" : "We look forward to working with you"}
    </p>
  );
}

function Photos({ ctx }: { ctx: Ctx }) {
  const photos = ctx.data.photos ?? [];
  if (photos.length === 0) return null;
  return (
    <section className="break-inside-avoid">
      <Label>Job photos</Label>
      <div className="grid grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <figure key={i} className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? ""} className="w-full aspect-[4/3] object-cover rounded-md border border-neutral-200" />
            {p.caption && <figcaption className="text-[11px] text-neutral-600 mt-1 leading-snug">{p.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}

function JobSite({ ctx }: { ctx: Ctx }) {
  if (!ctx.showJob) return null;
  return <div className="shrink-0 max-w-[200px]"><Party label="Job site" lines={ctx.jobAddr} /></div>;
}

function Title({ data }: { data: DocumentData }) {
  return data.title ? <p className="text-[15px] font-bold -mt-2">{data.title}</p> : null;
}

/* ═══════════════════════════ CLEAN — ref 2: big title, gradient table ═══════════════════════════ */

function CleanLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr } = ctx;
  return (
    <div className="flex flex-col flex-1 p-6 @xl:p-12 print:p-0 gap-8 print:gap-6">
      <header className="flex items-start justify-between gap-6">
        <p className="text-[38px] font-black tracking-tight leading-none uppercase text-neutral-900">{ctx.heading}</p>
        <Logo org={org} size="lg" />
      </header>

      <section className="grid grid-cols-1 @xl:grid-cols-[1fr_1fr_auto] gap-6 @xl:gap-8">
        <Party label={ctx.isInvoice ? "Invoice from" : "From"} name={org.name} lines={orgAddr} contact={[org.phone, org.email, org.licenseNo ? `Lic. ${org.licenseNo}` : null]} color />
        <Party label={ctx.isInvoice ? "Bill to" : "Prepared for"} name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} color />
        <div className="space-y-3">
          <Meta ctx={ctx} style="right" />
          <JobSite ctx={ctx} />
        </div>
      </section>

      <Title data={data} />
      <Lines ctx={ctx} head="gradient" />
      <BottomSplit ctx={ctx} finish="bar" />
      <Terms data={data} />
      <Photos ctx={ctx} />
      <Signatures ctx={ctx} />
      <ThankYou ctx={ctx} className="text-center mt-auto pt-4" />
    </div>
  );
}

/* ═══════════════════════════ BOLD — ref 3: full-color header band ═══════════════════════════ */

function BoldLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr } = ctx;
  return (
    <div className="flex flex-col flex-1">
      <header className="text-white px-6 @xl:px-12 print:px-6 py-7 print:py-5" style={{ background: "linear-gradient(100deg, var(--doc-primary), var(--doc-accent))" }}>
        <div className="flex items-start justify-between gap-6">
          <div className="bg-white rounded-lg p-2 self-start"><Logo org={org} size="sm" /></div>
          <div className="text-right shrink-0">
            <p className="text-[32px] font-black uppercase tracking-tight leading-none">{ctx.heading}</p>
            <div className="mt-3"><Meta ctx={ctx} style="right" light /></div>
          </div>
        </div>
      </header>

      <div className="flex flex-col flex-1 p-6 @xl:p-12 print:px-0 print:py-6 gap-8 print:gap-5">
        <section className="grid grid-cols-1 @xl:grid-cols-3 gap-6">
          <Party label={ctx.isInvoice ? "Bill to" : "Prepared for"} name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} color big />
          <Party label={ctx.isInvoice ? "Invoice from" : "From"} name={org.name} lines={orgAddr} contact={[org.phone, org.email]} color big />
          <JobSite ctx={ctx} />
        </section>

        <Title data={data} />
        <Lines ctx={ctx} head="primary" zebra />
        <BottomSplit ctx={ctx} finish="bar" />
        <Terms data={data} />
        <Photos ctx={ctx} />
        <Signatures ctx={ctx} />
        <ThankYou ctx={ctx} className="text-center mt-auto pt-4" />
      </div>
    </div>
  );
}

/* ═══════════════════════════ CLASSIC — ref 1: letterhead, dark table ═══════════════════════════ */

function ClassicLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr } = ctx;
  return (
    <div className="flex flex-col flex-1 p-6 @xl:p-12 print:p-0 gap-7 print:gap-5">
      <header className="flex items-start justify-between gap-6">
        <Logo org={org} size="lg" />
        <ContactStack org={org} orgAddr={orgAddr} className="text-right" />
      </header>

      <div className="border-t-[3px] border-neutral-900 pt-3 flex items-baseline justify-between gap-6 border-b border-neutral-300 pb-3">
        <p className="text-[20px] font-black tracking-tight truncate">{org.name}</p>
        <p className="text-[22px] font-black uppercase tracking-wide shrink-0">{ctx.heading}</p>
      </div>

      <section className="grid grid-cols-1 @xl:grid-cols-[1fr_auto] gap-6 @xl:gap-8">
        <div className="flex gap-6">
          <Party label={ctx.isInvoice ? "Bill to" : "Prepared for"} name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} color big />
          <JobSite ctx={ctx} />
        </div>
        <Meta ctx={ctx} style="right" />
      </section>

      <Title data={data} />
      <Lines ctx={ctx} head="dark" />
      <BottomSplit ctx={ctx} finish="bar" />
      <Terms data={data} />
      <Photos ctx={ctx} />
      <Signatures ctx={ctx} />
      <ThankYou ctx={ctx} className="text-center mt-auto pt-4" />
    </div>
  );
}

/* ═══════════════════════════ NOIR — ref 4: black header, centered title ═══════════════════════════ */

function NoirLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr, date } = ctx;
  return (
    <div className="flex flex-col flex-1">
      <header className="text-white px-6 @xl:px-12 print:px-6 py-7 print:py-5 flex items-start justify-between gap-6" style={{ background: "repeating-linear-gradient(135deg, #111827 0 14px, #1f2937 14px 16px)" }}>
        <div className="bg-white/95 rounded-md p-2 self-start"><Logo org={org} size="sm" /></div>
        <div className="text-right">
          <p className="text-[15px] font-black uppercase tracking-wide">{org.name}</p>
          <ContactStack org={org} orgAddr={orgAddr} light />
        </div>
      </header>

      <div className="flex flex-col flex-1 p-6 @xl:p-12 print:px-0 print:py-6 gap-7 print:gap-5">
        <div className="text-center">
          <p className="text-[34px] font-black uppercase tracking-[0.08em] leading-none">{ctx.heading}</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500 mt-2">{date(data.issueDate)}</p>
          {data.title && <p className="text-[14px] font-semibold mt-3">{data.title}</p>}
        </div>

        <section className="grid grid-cols-1 @xl:grid-cols-[1fr_auto] gap-6 @xl:gap-8">
          <div className="flex gap-6">
            <Party label={ctx.isInvoice ? "Bill to" : "Prepared for"} name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} big />
            <JobSite ctx={ctx} />
          </div>
          <Meta ctx={ctx} style="right" />
        </section>

        <Lines ctx={ctx} head="dark" />
        <BottomSplit ctx={ctx} finish="bar" />
        <Terms data={data} />
        <Photos ctx={ctx} />
        <Signatures ctx={ctx} tone="dark" />
        <ThankYou ctx={ctx} className="text-center mt-auto pt-4" />
      </div>
    </div>
  );
}

/* ═══════════════════════════ MINIMAL — ref 5: thin rules, no fills ═══════════════════════════ */

function MinimalLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr } = ctx;
  return (
    <div className="flex flex-col flex-1 p-6 @xl:p-12 print:p-0 gap-7 print:gap-5">
      <header className="flex items-start justify-between gap-6 pb-5 border-b border-neutral-300">
        <div className="flex items-center gap-4 min-w-0">
          <Logo org={org} />
          <p className="text-[22px] font-black tracking-tight leading-tight">{org.name}</p>
        </div>
        <ContactStack org={org} orgAddr={orgAddr} className="text-right shrink-0" />
      </header>

      <section className="grid grid-cols-1 @xl:grid-cols-[1fr_auto] gap-6 @xl:gap-8">
        <div className="flex gap-6">
          <Party label={ctx.isInvoice ? "Bill to" : "Prepared for"} name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} color big />
          <JobSite ctx={ctx} />
        </div>
        <div className="text-right">
          <p className="text-[24px] font-black uppercase tracking-wide leading-none mb-2">{ctx.heading}</p>
          <Meta ctx={ctx} style="right" />
        </div>
      </section>

      <Title data={data} />
      <Lines ctx={ctx} head="light" />
      <BottomSplit ctx={ctx} finish="line" />
      <Terms data={data} />
      <Photos ctx={ctx} />
      <Signatures ctx={ctx} />
      <ThankYou ctx={ctx} className="text-center mt-auto pt-4" />
    </div>
  );
}

/* ═══════════════════════════ EXECUTIVE — ref 6: blue table, big balance line ═══════════════════════════ */

function ExecutiveLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr } = ctx;
  return (
    <div className="flex flex-col flex-1 p-6 @xl:p-12 print:p-0 gap-7 print:gap-5">
      <header className="flex items-start justify-between gap-6">
        <Logo org={org} size="lg" />
        <div className="text-right">
          <p className="text-[30px] font-black uppercase tracking-tight leading-none text-neutral-900">{ctx.heading}</p>
          <p className="text-[12px] font-bold mt-2">{org.name}</p>
          <ContactStack org={org} orgAddr={orgAddr} />
        </div>
      </header>

      <section className="grid grid-cols-1 @xl:grid-cols-[1fr_auto] gap-6 @xl:gap-8 border-t border-neutral-300 pt-5">
        <div className="flex gap-6">
          <Party label={ctx.isInvoice ? "Bill to" : "Prepared for"} name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} color big />
          <JobSite ctx={ctx} />
        </div>
        <Meta ctx={ctx} style="right" />
      </section>

      <Title data={data} />
      <Lines ctx={ctx} head="primary" />
      <BottomSplit ctx={ctx} finish="line" />
      <Terms data={data} />
      <Photos ctx={ctx} />
      <Signatures ctx={ctx} />
      <ThankYou ctx={ctx} className="text-center mt-auto pt-4" />
    </div>
  );
}
