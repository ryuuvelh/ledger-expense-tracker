"use client";

import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function FormLabel({ children }: { children: ReactNode }) {
  return <div className="form-label">{children}</div>;
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="form-error">{message}</div>;
}

export function FormHint({ children }: { children: ReactNode }) {
  return <p className="form-hint">{children}</p>;
}

export function FormInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={["input-field", className].filter(Boolean).join(" ")} />;
}

export function FormSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, ...rest } = props;
  return <select {...rest} className={["input-field", className].filter(Boolean).join(" ")} />;
}

export function FormField(props: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={["block space-y-1.5", props.className].filter(Boolean).join(" ")}>
      <FormLabel>{props.label}</FormLabel>
      {props.children}
      {props.error ? <FormError message={props.error} /> : null}
      {props.hint ? <FormHint>{props.hint}</FormHint> : null}
    </label>
  );
}

export function FormRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

export function FormTypeToggle<T extends string>(props: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="form-type-toggle">
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={props.value === option.value}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
