export function Button({ children, className = "", variant = "default", disabled = false, ...props }) {
  const base = "inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed";
  const style = variant === "outline"
    ? "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
    : "bg-slate-900 text-white hover:bg-slate-700";
  return (
    <button disabled={disabled} className={`${base} ${style} ${className}`} {...props}>
      {children}
    </button>
  );
}
