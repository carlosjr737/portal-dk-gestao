import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows ?? 3}
        className={cn(
          "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground outline-none transition",
          "placeholder:text-muted-foreground",
          "focus:border-primary",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
