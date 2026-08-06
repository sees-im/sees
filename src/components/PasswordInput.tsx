import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperClassName?: string;
};

export const PasswordInput = React.forwardRef<HTMLInputElement, Props>(
  ({ className = "", wrapperClassName = "", ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className={`relative ${wrapperClassName}`}>
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className={`pr-11 ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide passphrase" : "Show passphrase"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent transition-colors p-1"
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
