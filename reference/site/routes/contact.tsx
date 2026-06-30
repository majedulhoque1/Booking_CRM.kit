import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { FadeIn } from "@/components/site/FadeIn";
import { ConsultationForm } from "@/components/site/ConsultationForm";
import { MapPin, Phone, Clock, MessageCircle } from "lucide-react";

// FILL: replace {SITE_NAME}, the branches array, the phone/WhatsApp numbers, and the
// opening hours with the client's brand brief. Layout/FadeIn are the consuming app's chrome.
export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Us — {SITE_NAME}" },
      { name: "description", content: "Visit us, book a free consultation, or message us on WhatsApp." },
      { property: "og:title", content: "Contact {SITE_NAME}" },
      { property: "og:description", content: "We're here to help. Reach out — no question is too small." },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: Contact,
});

// FILL: one entry per physical location (name, address, map query). Remove if none.
const branches = [
  { name: "Main Branch", address: "{STREET ADDRESS}", mapQ: "{MAP SEARCH QUERY}" },
];

// FILL: the client's phone + WhatsApp numbers (E.164 for the wa.me link).
const PHONE_DISPLAY = "+00 000 000 0000";
const PHONE_TEL = "+000000000000";
const WHATSAPP_E164 = "000000000000";

function Contact() {
  return (
    <Layout>
      <section className="bg-surface section">
        <div className="container-page text-center max-w-2xl mx-auto">
          <FadeIn>
            <h1 className="text-4xl md:text-5xl font-extrabold text-primary">We're Here to Help</h1>
            <p className="mt-4 text-foreground/70 text-lg">Reach out to us — no question is too small.</p>
          </FadeIn>
        </div>
      </section>

      <section className="section">
        <div className="container-page grid md:grid-cols-2 gap-6">
          {branches.map((b, i) => (
            <FadeIn key={b.name} delay={i * 0.1}>
              <div className="card-soft overflow-hidden h-full">
                <iframe
                  title={b.name}
                  src={`https://www.google.com/maps?q=${encodeURIComponent(b.mapQ)}&output=embed`}
                  className="w-full h-56 border-0"
                  loading="lazy"
                />
                <div className="p-6">
                  <h2 className="font-heading font-bold text-xl text-primary">{b.name}</h2>
                  <ul className="mt-4 space-y-3 text-sm text-foreground/75">
                    <li className="flex gap-3"><MapPin size={18} className="shrink-0 text-secondary mt-0.5" />{b.address}</li>
                    <li className="flex gap-3"><Phone size={18} className="shrink-0 text-secondary mt-0.5" /><a href={`tel:${PHONE_TEL}`} className="hover:text-secondary">{PHONE_DISPLAY}</a></li>
                    <li className="flex gap-3"><Clock size={18} className="shrink-0 text-secondary mt-0.5" />{/* FILL: opening hours */}Mon – Fri, 9:00 AM – 5:00 PM</li>
                  </ul>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="section bg-surface">
        <div className="container-page grid lg:grid-cols-2 gap-12 items-start">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-extrabold text-primary">Send us a quick inquiry</h2>
            <p className="mt-4 text-foreground/70 text-lg">
              Tell us how we can help. Our care coordinator will call you back within 24 hours — gently, privately, and without pressure.
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_E164}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 bg-supporting text-supporting-foreground font-semibold px-5 py-3 rounded-lg hover:opacity-90 transition"
            >
              <MessageCircle size={18} /> Prefer WhatsApp? Message us directly →
            </a>
          </FadeIn>
          <FadeIn delay={0.1}><ConsultationForm /></FadeIn>
        </div>
      </section>
    </Layout>
  );
}
