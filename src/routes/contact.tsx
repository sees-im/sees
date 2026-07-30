import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { ContactForm } from "@/routes/index";
import { MarketingFooter, MarketingHeader } from "@/components/MarketingPage";
import { ScrollToTop } from "@/components/ScrollToTop";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — SEES" },
      { name: "description", content: "Send a private signal to the SEES team." },
      { property: "og:title", content: "Contact — SEES" },
      { property: "og:description", content: "Send a private signal to the SEES team." },
    ],
    links: [{ rel: "canonical", href: "https://www.sees.im/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="marketing-site contact-page-premium min-h-screen bg-background text-foreground flex flex-col">
      <MarketingHeader />
      <main className="contact-page-premium__main flex-1">
        <section className="site-shell contact-page-premium__hero">
          <div className="contact-page-premium__index" aria-hidden>03 / CONTACT</div>
          <div className="contact-page-premium__copy">
            <p className="marketing-eyebrow">Private channel</p>
            <h1>Send a signal.<br /><em>Keep it clear.</em></h1>
            <p className="contact-page-premium__lead">
              Questions, ideas, or a problem worth solving? Put it in writing. The team will pick it up from here.
            </p>
            <div className="contact-page-premium__meta">
              <span><ShieldCheck className="size-4" strokeWidth={1.6} /> Stored through the protected channel</span>
            </div>
          </div>
          <div className="contact-page-premium__card">
            <div className="contact-page-premium__cardbar"><span>SEES / 03</span><span>Open channel</span></div>
            <ContactForm />
          </div>
        </section>
      </main>
      <MarketingFooter />
      <ScrollToTop />
    </div>
  );
}
