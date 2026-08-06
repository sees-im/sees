import { useEffect, useRef } from "react";

export function ScrollToTop() {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let ticking = false;
    let visible = false;

    const onScroll = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;

        const button = buttonRef.current;
        if (!button) return;

        const scrollBottom = window.scrollY + window.innerHeight;
        const pageBottom = document.documentElement.scrollHeight;
        const shouldShow = pageBottom - scrollBottom < 180 && window.scrollY > 400;

        if (shouldShow === visible) return;

        visible = shouldShow;
        button.classList.toggle("is-visible", shouldShow);
        button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
        button.tabIndex = shouldShow ? 0 : -1;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Scroll to top"
      aria-hidden="true"
      tabIndex={-1}
      onClick={() => {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }}
      className="scroll-to-top"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 19V5" />
        <path d="m5 12 7-7 7 7" />
      </svg>
    </button>
  );
}
