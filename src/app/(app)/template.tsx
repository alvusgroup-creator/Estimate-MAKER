/** Re-mounts on every navigation so each page fades and lifts in. */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
