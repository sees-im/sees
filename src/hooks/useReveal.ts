import { useEffect, useRef } from "react";

/**
 * Reveals every `[data-reveal]` element on the page as it scrolls into view —
 * one observer for all of them, so sections don't each need their own ref.
 *
 * Sets `js-reveal` on <html> first. The CSS that hides content is scoped to
 * that class, so if JavaScript never runs the page stays fully readable
 * instead of being stuck at opacity 0.
 */
export function useRevealAll() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      for (const el of targets) el.classList.add("is-visible");
      return;
    }

    root.classList.add("js-reveal");

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );

    for (const el of targets) obs.observe(el);
    return () => obs.disconnect();
  }, []);
}

/**
 * Adds `is-visible` to the element when it scrolls into view.
 * Pair with the `.reveal` class in styles.css.
 */
export function useReveal<T extends HTMLElement>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-visible");
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px", ...options },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [options]);

  return ref;
}
