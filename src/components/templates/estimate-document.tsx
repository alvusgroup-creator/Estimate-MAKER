import type { CSSProperties, ReactNode } from "react";
import type { Template } from "@/generated/prisma/enums";
import type { OrgBranding, ClientDTO } from "@/lib/estimates/dto";
import { formatMoney } from "@/lib/estimates/calc";
import { UNIT_LABELS } from "@/lib/estimates/schemas";
import { clientDisplayName, formatAddress } from "@/lib/utils";

/**
 * The document itself. Pure presentational; receives plain numbers/strings so it renders
 * identically in the live editor preview, the public /e/[token] page and print-to-PDF.
 * Three layouts share one data contract — see CleanLayout / BoldLayout / ClassicLayout below.
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
  const ctx: Ctx = {
    org,
    data,
    money: (n) => formatMoney(n, org.currency, org.locale),
    date: (d) => new Date(d).toLocaleDateString(org.locale, { year: "numeric", month: "short", day: "numeric" }),
    orgAddr: formatAddress(org),
    clientAddr,
    jobAddr,
    showJob: jobAddr.length > 0 && jobAddr.join() !== clientAddr.join(),
    pct: (data.taxRate * 100).toFixed(2).replace(/.?0+$/, ""),
    isInvoice: data.kind === "INVOICE",
    isChangeOrder: data.kind === "CHANGE_ORDER",
    heading: data.kind === "INVOICE" ? "Invoice" : data.kind === "CHANGE_ORDER" ? "Change Order" : "Estimate",
  };

  const Layout = template === "BOLD" ? BoldLayout : template === "CLASSIC" ? ClassicLayout : CleanLayout;

  return (
    <article
      style={vars}
      className={`doc bg-white text-[#111] text-[13px] leading-normal w-full mx-auto min-h-[900px] flex flex-col ${template === "CLASSIC" ? "font-serif" : ""} ${className ?? ""}`}
    >
      <Layout {...ctx} />
    </article>
  );
}

/* ═══════════════════════════ shared pieces ═══════════════════════════ */

function Logo({ org, className = "" }: { org: OrgBranding; className?: string }) {
  if (org.logoUrl) {
    // Wide and square logos both work: constrain height, let width follow, cap width.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={org.logoUrl} alt={org.name} className={`h-16 max-w-[220px] w-auto object-contain object-left ${className}`} />;
  }
  return (
    <div className={`h-16 w-16 rounded-xl grid place-items-center text-white text-2xl font-bold ${className}`} style={{ background: "var(--doc-primary)" }}>
      {org.name.charAt(0)}
    </div>
  );
}

function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500 mb-1.5 ${className}`}>{children}</p>;
}

function Party({ label, name, lines, contact }: { label: string; name?: string; lines: string[]; contact?: (string | null | undefined)[] }) {
  return (
    <div className="min-w-0">
      <Label>{label}</Label>
      {name && <p className="font-semibold text-[14px] leading-tight">{name}</p>}
      {lines.map((l, i) => <p key={i} className="text-neutral-700">{l}</p>)}
      {contact?.filter(Boolean).map((c, i) => <p key={`c${i}`} className="text-neutral-600">{c}</p>)}
    </div>
  );
}

function MetaRows({ data, date, dense }: { data: DocumentData; date: Ctx["date"]; dense?: boolean }) {
  const inv = data.kind === "INVOICE";
  const co = data.kind === "CHANGE_ORDER";
  const rows: [string, string][] = [
    [inv ? "Invoice #" : co ? "Change order #" : "Estimate #", data.number],
    ["Date", date(data.issueDate)],
  ];
  if (co && data.changeOrder) rows.push(["Amends estimate", data.changeOrder.parentNumber]);
  if (inv && data.dueDate) rows.push(["Due date", date(data.dueDate)]);
  if (!inv && !co && data.expiresAt) rows.push(["Valid until", date(data.expiresAt)]);
  if (inv && data.paidAt) rows.push(["Paid", date(data.paidAt)]);
  return (
    <dl className={`grid grid-cols-[auto_1fr] gap-x-6 ${dense ? "gap-y-0.5" : "gap-y-1.5"} text-[12.5px] whitespace-nowrap`}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-neutral-500">{k}</dt>
          <dd className="font-semibold text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Lines({ ctx, variant }: { ctx: Ctx; variant: "clean" | "bold" | "classic" }) {
  const { data, money } = ctx;
  const th = "text-[10.5px] font-semibold uppercase tracking-[0.1em] py-2.5 px-3";
  const headCls =
    variant === "bold"
      ? `${th} text-white`
      : variant === "classic"
        ? `${th} text-neutral-800 bg-neutral-100 border border-neutral-400`
        : `${th} text-neutral-500 border-b-2`;
  const headStyle = variant === "bold" ? { background: "var(--doc-primary)" } : variant === "clean" ? { borderColor: "var(--doc-primary)" } : undefined;
  const td = variant === "classic" ? "py-2.5 px-3 border border-neutral-400 align-top" : "py-3 px-3 border-b border-neutral-200 align-top";

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr style={headStyle}>
          <th className={`${headCls} text-left`}>Description</th>
          <th className={`${headCls} text-right w-[88px]`}>Qty</th>
          <th className={`${headCls} text-right w-[100px]`}>Rate</th>
          <th className={`${headCls} text-right w-[112px]`}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.lines.map((l, i) => (
          <tr key={i} className={`${l.isOptional ? "text-neutral-500" : ""} ${variant === "bold" && i % 2 ? "bg-neutral-50" : ""}`}>
            <td className={td}>
              <p className="font-medium leading-snug">
                {l.name}
                {l.isOptional && <span className="ml-2 text-[9.5px] uppercase tracking-wider border border-neutral-300 rounded px-1 py-px">optional</span>}
              </p>
              {l.description && <p className="text-neutral-600 text-[12px] whitespace-pre-line mt-0.5 leading-snug">{l.description}</p>}
            </td>
            <td className={`${td} text-right tabular-nums whitespace-nowrap`}>{l.quantity} <span className="text-neutral-500">{UNIT_LABELS[l.unit]}</span></td>
            <td className={`${td} text-right tabular-nums`}>{money(l.unitPrice)}</td>
            <td className={`${td} text-right tabular-nums font-medium`}>{money(l.lineTotal)}</td>
          </tr>
        ))}
        {data.lines.length === 0 && (
          <tr><td colSpan={4} className={`${td} text-center text-neutral-400 py-8`}>No items yet</td></tr>
        )}
      </tbody>
    </table>
  );
}

function Totals({ ctx, variant }: { ctx: Ctx; variant: "clean" | "bold" | "classic" }) {
  const { data, money, pct } = ctx;
  const row = "flex justify-between items-baseline py-1 text-neutral-700";
  const totalLabel = ctx.isChangeOrder ? (data.total < 0 ? "Credit" : "Change total") : "Total";
  const co = ctx.isChangeOrder ? data.changeOrder : null;
  return (
    <div className="w-full max-w-[300px] ml-auto">
      <div className={row}><span>Subtotal</span><span className="tabular-nums">{money(data.subtotal)}</span></div>
      {data.discountAmount > 0 && <div className={row}><span>Discount</span><span className="tabular-nums">− {money(data.discountAmount)}</span></div>}
      {data.taxRate > 0 && <div className={row}><span>{data.taxLabel} ({pct}%)</span><span className="tabular-nums">{money(data.taxAmount)}</span></div>}

      {variant === "classic" ? (
        <div className="mt-2 flex justify-between items-center border-2 border-neutral-800 px-3 py-2">
          <span className="text-[15px] font-bold uppercase tracking-wide">{totalLabel}</span>
          <span className="text-[18px] font-bold tabular-nums">{money(data.total)}</span>
        </div>
      ) : variant === "bold" ? (
        <div className="mt-2 flex justify-between items-center px-3 py-2.5 text-white rounded-md" style={{ background: "var(--doc-primary)" }}>
          <span className="text-[13px] font-bold uppercase tracking-wide">{totalLabel}</span>
          <span className="text-[18px] font-bold tabular-nums">{money(data.total)}</span>
        </div>
      ) : (
        <div className="mt-2 pt-2.5 border-t-2 flex justify-between items-baseline" style={{ borderColor: "var(--doc-primary)" }}>
          <span className="text-[14px] font-semibold">{totalLabel}</span>
          <span className="text-[20px] font-bold tabular-nums" style={{ color: "var(--doc-primary)" }}>{money(data.total)}</span>
        </div>
      )}

      {co && (
        <div className="mt-3 pt-2 border-t border-neutral-300 text-[12px]">
          <div className={row}><span>Original estimate {co.parentNumber}</span><span className="tabular-nums">{money(co.originalTotal)}</span></div>
          {co.priorChangesTotal !== 0 && <div className={row}><span>Previously approved changes</span><span className="tabular-nums">{money(co.priorChangesTotal)}</span></div>}
          <div className={row}><span>This change order</span><span className="tabular-nums">{money(data.total)}</span></div>
          <div className="flex justify-between items-baseline pt-1 text-[13.5px] font-semibold text-neutral-900"><span>Revised contract total</span><span className="tabular-nums">{money(co.originalTotal + co.priorChangesTotal + data.total)}</span></div>
        </div>
      )}
      {data.depositAmount > 0 && !ctx.isInvoice && !ctx.isChangeOrder && (
        <div className={`${row} text-[12.5px] mt-1`}>
          <span>Deposit due on acceptance</span>
          <span className="tabular-nums font-semibold text-neutral-900">{money(data.depositAmount)}</span>
        </div>
      )}
      {ctx.isInvoice && (data.amountPaid ?? 0) > 0 && (
        <>
          <div className={`${row} text-[12.5px] mt-1`}><span>Paid to date</span><span className="tabular-nums">− {money(data.amountPaid ?? 0)}</span></div>
          {data.total - (data.amountPaid ?? 0) > 0.005 ? (
            <div className="flex justify-between items-baseline pt-1 text-[14px] font-semibold"><span>Balance due</span><span className="tabular-nums">{money(data.total - (data.amountPaid ?? 0))}</span></div>
          ) : (
            <div className="flex justify-between items-baseline pt-1 text-[13px] font-semibold text-green-700"><span>Paid in full</span><span className="tabular-nums">{money(0)}</span></div>
          )}
        </>
      )}
    </div>
  );
}

function NotesTerms({ data, cols = false }: { data: DocumentData; cols?: boolean }) {
  if (!data.notes && !data.terms) return null;
  return (
    <section className={`grid gap-6 text-[12px] text-neutral-700 ${cols && data.notes && data.terms ? "sm:grid-cols-2" : ""}`}>
      {data.notes && (
        <div>
          <Label>Notes</Label>
          <p className="whitespace-pre-line leading-relaxed">{data.notes}</p>
        </div>
      )}
      {data.terms && (
        <div>
          <Label>Terms &amp; conditions</Label>
          <p className="whitespace-pre-line leading-relaxed">{data.terms}</p>
        </div>
      )}
    </section>
  );
}

/** Signature block: contractor (from settings) + customer (from acceptance, or blank line). */
function Signatures({ ctx, variant }: { ctx: Ctx; variant: "clean" | "bold" | "classic" }) {
  const { org, data, date } = ctx;
  if (ctx.isInvoice) {
    return (
      <section className="flex items-end justify-between gap-6 pt-2">
        <p className="text-[12px] text-neutral-600">Thank you for your business.</p>
        {org.signatureDataUrl && (
          <div className="text-right">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={org.signatureDataUrl} alt="Signature" className="h-12 w-auto max-w-[200px] object-contain ml-auto" />
            <p className="text-[11px] text-neutral-600 mt-1">{org.signatureName || org.name}</p>
          </div>
        )}
      </section>
    );
  }
  const line = variant === "classic" ? "border-neutral-800" : "border-neutral-400";
  return (
    <section className="grid grid-cols-2 gap-10 pt-2">
      <div>
        <div className={`h-[64px] flex items-end border-b ${line}`}>
          {org.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.signatureDataUrl} alt="Signature" className="h-14 w-auto max-w-full object-contain object-left-bottom" />
          ) : null}
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] text-neutral-600">
          <span>{org.signatureName || org.name}</span>
          <span>Prepared by</span>
        </div>
      </div>
      <div>
        <div className={`h-[64px] flex items-end border-b ${line}`}>
          {data.acceptedAt && data.signatureDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.signatureDataUrl} alt="Customer signature" className="h-14 w-auto max-w-full object-contain object-left-bottom" />
          ) : data.acceptedAt && data.signerName ? (
            <span className="font-[cursive] italic text-[22px] leading-none pb-1 text-neutral-900">{data.signerName}</span>
          ) : null}
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] text-neutral-600">
          <span>{data.acceptedAt ? `${data.signerName ?? "Client"} · ${ctx.isChangeOrder ? "Approved" : "Accepted"} ${date(data.acceptedAt)}` : ctx.isChangeOrder ? "Customer approval" : "Customer signature"}</span>
          <span>{data.acceptedAt ? "Client" : "Date"}</span>
        </div>
      </div>
    </section>
  );
}

function ContactFooter({ org, orgAddr, dark }: { org: OrgBranding; orgAddr: string[]; dark?: boolean }) {
  const muted = dark ? "text-white/70" : "text-neutral-500";
  const text = dark ? "text-white" : "text-neutral-800";
  return (
    <footer className={`grid grid-cols-2 sm:grid-cols-3 gap-6 text-[11px] ${dark ? "" : "border-t border-neutral-200"} pt-5 mt-auto`}>
      <div>
        <p className={`${muted} uppercase tracking-wider text-[9.5px] mb-1`}>Business</p>
        <p className={`${text} font-medium`}>{org.name}</p>
        {orgAddr.map((l, i) => <p key={i} className={muted}>{l}</p>)}
      </div>
      <div>
        <p className={`${muted} uppercase tracking-wider text-[9.5px] mb-1`}>Contact</p>
        {org.phone && <p className={text}>{org.phone}</p>}
        {org.email && <p className={text}>{org.email}</p>}
        {org.website && <p className={text}>{org.website}</p>}
      </div>
      {org.licenseNo && (
        <div>
          <p className={`${muted} uppercase tracking-wider text-[9.5px] mb-1`}>License</p>
          <p className={text}>{org.licenseNo}</p>
        </div>
      )}
    </footer>
  );
}

/* ═══════════════════════════ CLEAN (ref 1 / 2) ═══════════════════════════ */

function CleanLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr, jobAddr, showJob, date } = ctx;
  return (
    <div className="flex flex-col flex-1 p-8 sm:p-12 print:p-0 gap-9 print:gap-6">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[34px] font-bold tracking-tight leading-none" style={{ color: "var(--doc-primary)" }}>{ctx.heading}</p>
          {data.title && <p className="mt-2 text-[14px] text-neutral-600">{data.title}</p>}
        </div>
        <Logo org={org} />
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-8">
        <Party label="From" name={org.name} lines={orgAddr} contact={[org.phone, org.email]} />
        <Party label="Prepared for" name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} />
        <div className="rounded-lg bg-neutral-100 px-5 py-4 min-w-[220px] self-start">
          <MetaRows data={data} date={date} />
          {showJob && (
            <div className="mt-3 pt-3 border-t border-neutral-300">
              <Label className="mb-0.5">Job site</Label>
              {jobAddr.map((l, i) => <p key={i} className="text-[12px] text-neutral-700">{l}</p>)}
            </div>
          )}
        </div>
      </section>

      <Lines ctx={ctx} variant="clean" />
      <Totals ctx={ctx} variant="clean" />
      <NotesTerms data={data} cols />
      <Photos ctx={ctx} />
      <Signatures ctx={ctx} variant="clean" />
      <ContactFooter org={org} orgAddr={orgAddr} />
    </div>
  );
}

/* ═══════════════════════════ BOLD (ref 3 / 4) ═══════════════════════════ */

function BoldLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr, jobAddr, showJob, date } = ctx;
  return (
    <div className="flex flex-col flex-1">
      <header className="text-white px-8 sm:px-12 print:px-6 py-8 print:py-5" style={{ background: "var(--doc-primary)" }}>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg p-2">
              <Logo org={org} className="!h-12 !max-w-[180px]" />
            </div>
            <div>
              <p className="font-bold text-[18px] leading-tight">{org.name}</p>
              <p className="text-white/75 text-[12px] mt-0.5">{[...orgAddr].join(" · ")}</p>
              <p className="text-white/75 text-[12px]">{[org.phone, org.email].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[30px] font-black uppercase tracking-tight leading-none">{ctx.heading}</p>
            <p className="text-white/90 font-semibold text-[14px] mt-2">{data.number}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col flex-1 p-8 sm:p-12 print:px-0 print:py-6 gap-8 print:gap-5">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="rounded-lg border border-neutral-200 p-4">
            <Party label="Prepared for" name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} />
          </div>
          <div className="rounded-lg border border-neutral-200 p-4">
            <Label>Job site</Label>
            {(showJob ? jobAddr : clientAddr).length ? (showJob ? jobAddr : clientAddr).map((l, i) => <p key={i} className="text-neutral-700">{l}</p>) : <p className="text-neutral-400">—</p>}
            {data.title && <p className="mt-2 font-medium">{data.title}</p>}
          </div>
          <div className="rounded-lg p-4 self-start" style={{ background: "color-mix(in srgb, var(--doc-primary) 8%, white)" }}>
            <MetaRows data={data} date={date} />
          </div>
        </section>

        <Lines ctx={ctx} variant="bold" />
        <Totals ctx={ctx} variant="bold" />
        <NotesTerms data={data} cols />
        <Photos ctx={ctx} />
        <Signatures ctx={ctx} variant="bold" />
      </div>

      <div className="px-8 sm:px-12 print:px-6 py-5 print:py-4 text-white mt-auto" style={{ background: "var(--doc-primary)" }}>
        <ContactFooter org={org} orgAddr={orgAddr} dark />
      </div>
    </div>
  );
}

/* ═══════════════════════════ CLASSIC (ref 6) ═══════════════════════════ */

function ClassicLayout(ctx: Ctx) {
  const { org, data, orgAddr, clientAddr, jobAddr, showJob, date } = ctx;
  return (
    <div className="flex flex-col flex-1 p-8 sm:p-12 print:p-0 gap-9 print:gap-6">
      <header className="flex items-start justify-between gap-6 pb-6 border-b-2 border-neutral-800">
        <div className="flex items-start gap-4">
          <Logo org={org} />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-[20px] leading-tight">{org.name}</p>
            {orgAddr.map((l, i) => <p key={i} className="text-neutral-700">{l}</p>)}
            {org.phone && <p className="text-neutral-700">{org.phone}</p>}
            {org.email && <p className="text-neutral-700">{org.email}</p>}
          </div>
        </div>
        <p className="text-[26px] font-bold uppercase tracking-[0.15em] shrink-0">{ctx.heading}</p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-8">
        <Party label="Bill to" name={clientDisplayName(data.client)} lines={clientAddr} contact={[data.client.phone, data.client.email]} />
        <Party label="Job site" lines={showJob ? jobAddr : clientAddr} />
        <div className="col-span-2 sm:col-span-1 min-w-[220px]">
          <MetaRows data={data} date={date} />
        </div>
      </section>

      {data.title && <p className="text-[15px] font-semibold -mb-4">{data.title}</p>}
      <Lines ctx={ctx} variant="classic" />
      <Totals ctx={ctx} variant="classic" />
      <Photos ctx={ctx} />
      <Signatures ctx={ctx} variant="classic" />
      <NotesTerms data={data} />
      <ContactFooter org={org} orgAddr={orgAddr} />
    </div>
  );
}

/* ═══════════════════════════ job photos ═══════════════════════════ */

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
