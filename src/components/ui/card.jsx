export function Card({ children, className = "" }) {
  return <section className={`bg-white border border-slate-200 ${className}`}>{children}</section>;
}

export function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}
