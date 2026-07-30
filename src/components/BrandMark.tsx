type BrandMarkProps = {
  variant?: "mark" | "wordmark";
  className?: string;
};

export function BrandMark({ variant = "mark", className = "" }: BrandMarkProps) {
  return (
    <span className={`brand-logo brand-logo--${variant} ${className}`} aria-hidden>
      <img
        src={variant === "wordmark" ? "/brand-wordmark.png" : "/brand-mark.png"}
        alt=""
        draggable={false}
      />
    </span>
  );
}
