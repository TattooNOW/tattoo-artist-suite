import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Maria Santos",
    role: "Tattoo Artist, NYC",
    quote: "TattooNOW cut my admin time in half. I can finally focus on what I love — tattooing.",
    rating: 5,
  },
  {
    name: "Jake Thompson",
    role: "Studio Owner, LA",
    quote: "Managing 8 artists used to be chaos. Now everything runs smooth from one dashboard.",
    rating: 5,
  },
  {
    name: "Aisha Williams",
    role: "Convention Organizer",
    quote: "Ticket sales and vendor management in one platform? Game changer for our annual expo.",
    rating: 5,
  },
];

export default function SocialProofSection() {
  return (
    <section id="social-proof" className="section-padding bg-card/50">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display mb-4">
            Trusted by <span className="text-gradient">Thousands</span>
          </h2>
          <p className="text-muted-foreground">See what artists and studio owners are saying.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground leading-relaxed mb-4 italic">
                "{t.quote}"
              </p>
              <div>
                <p className="font-display text-sm">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
