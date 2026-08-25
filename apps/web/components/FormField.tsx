import { useId } from "react";
import type { CSSProperties } from "react";

type Size = "member" | "field";

const SIZE: Record<Size, string> = { member: "h-12", field: "h-14 text-lg" };

export interface FormFieldProps {
  label?: string;
  value?: string;
  placeholder?: string;
  /** Full sentence: what went wrong and what to do next. Never a code. */
  error?: string;
  hint?: string;
  /** Machine identity input (plate, VIN, code) — mono + letter-spacing. */
  mono?: boolean;
  size?: Size;
  type?: string;
  onChange?: (value: string) => void;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

/** Uppercase label + sunken input + sentence-form error. */
export function FormField({
  label, value, placeholder, error, hint, mono, size = "member", type = "text",
  onChange, id, className, style,
}: FormFieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const inputCls = [
    "w-full bg-chassis border rounded-sm px-3",
    SIZE[size],
    error ? "border-danger" : "border-line",
    mono ? "font-mono tracking-[0.12em]" : "font-body",
    "text-ink placeholder:text-ink-muted",
  ].join(" ");
  return (
    <div className={["flex flex-col gap-1", className].filter(Boolean).join(" ")} style={style}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-[0.03em] text-ink-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={inputCls}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-sm text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}
