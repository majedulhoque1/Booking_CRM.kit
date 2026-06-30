import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/site/Layout";
import { FadeIn } from "@/components/site/FadeIn";
import { BookingCalendar } from "@/components/site/BookingCalendar";

// FILL: swap "{SITE_NAME}" and the copy below for the client's brand brief.
export const Route = createFileRoute("/book-consultation")({
  head: () => ({
    meta: [
      { title: "Book a Consultation — {SITE_NAME}" },
      { name: "description", content: "Pick a free time slot to book a consultation. Private and pressure-free." },
      { property: "og:title", content: "Book a Consultation — {SITE_NAME}" },
      { property: "og:description", content: "Choose a day and time that works for you." },
    ],
    links: [{ rel: "canonical", href: "/book-consultation" }],
  }),
  component: BookConsultation,
});

function BookConsultation() {
  return (
    <Layout>
      <section className="bg-surface section">
        <div className="container-page text-center max-w-2xl mx-auto">
          <FadeIn>
            <h1 className="text-4xl md:text-5xl font-extrabold text-primary">Book a Consultation</h1>
            <p className="mt-4 text-foreground/70 text-lg">
              Choose a day and time that suits you. It's private, gentle, and there's no pressure.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="section">
        <div className="container-page max-w-2xl mx-auto">
          <FadeIn><BookingCalendar /></FadeIn>
        </div>
      </section>
    </Layout>
  );
}
