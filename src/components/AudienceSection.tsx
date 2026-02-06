import { Palette, Building2, CalendarDays } from "lucide-react";

const audiences = [
  {
    icon: Palette,
    title: "Solo Artists",
    description: "Manage your bookings, portfolio, and client communications from one dashboard.",
  },
  {
    icon: Building2,
    title: "Studios",
    description: "Coordinate multiple artists, schedules, and walk-ins with studio management tools.",
  },
  {
    icon: CalendarDays,
    title: "Conventions & Events",
    description: "Promote events, manage vendor booths, and sell tickets seamlessly.",
  },
];

export default function AudienceSection() {
  return (
    <section id="audience" className="section-padding">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-display mb-4">
            Built for <span className="text-gradient">Every Level</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you're a solo artist or running a multi-location studio, TattooNOW adapts to your workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {audiences.map((item) => (
            <div
              key={item.title}
              className="group rounded-lg border border-border bg-card p-8 hover:border-primary/40 hover:glow-border transition-all duration-300"
            >
              <item.icon className="h-10 w-10 text-accent mb-4 group-hover:text-primary transition-colors" />
              <h3 className="font-display text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
