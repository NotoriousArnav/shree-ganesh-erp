import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
          variant === "primary" &&
            "bg-primary text-primary-foreground hover:opacity-90",
          variant === "outline" &&
            "border border-border bg-card text-foreground hover:bg-accent",
          variant === "ghost" &&
            "text-muted-foreground hover:bg-accent hover:text-foreground",
          variant === "danger" &&
            "bg-destructive text-destructive-foreground hover:opacity-90",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/25",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/25",
        className,
      )}
      {...props}
    />
  );
});

export function Field({
  label,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("block space-y-1", className)}>
      {/* The hint sits outside the label so it does not become part of the
          field's accessible name. */}
      <label className="block space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        {children}
      </label>
      {hint ? (
        <span className="block text-xs text-muted-foreground/80">{hint}</span>
      ) : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "bg-muted text-muted-foreground",
        tone === "green" &&
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
        tone === "amber" &&
          "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        tone === "red" &&
          "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
        tone === "blue" &&
          "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      )}
    >
      {children}
    </span>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl">
        <div className="mb-4 space-y-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
