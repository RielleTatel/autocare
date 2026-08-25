import React from "react";

export interface FormFieldProps {
  label?: string;
  value?: string;
  placeholder?: string;
  /** Full sentence: what went wrong and what to do next. Never a code. */
  error?: string;
  hint?: string;
  /** Machine identity input (plate, VIN, code) — mono + letter-spacing. */
  mono?: boolean;
  size?: "member" | "field";
  type?: string;
  onChange?: (value: string) => void;
  id?: string;
  style?: React.CSSProperties;
}

/** Uppercase label + sunken input + sentence-form error. */
export declare function FormField(props: FormFieldProps): React.ReactElement;
