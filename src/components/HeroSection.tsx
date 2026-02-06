import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />

      <div className="relative container text-center max-w-3xl animate-fade-in-up">
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-display leading-tight mb-6">
          Run Your Tattoo Business{" "}
          <span className="text-gradient">Like a Pro</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto font-body">
          The all-in-one platform that helps tattoo artists, studios, and conventions
          manage clients, bookings, payments, and marketing — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="hero" size="lg">
            Start Free Trial
          </Button>
          <Button variant="heroOutline" size="lg">
            See How It Works
          </Button>
        </div>
      </div>
    </section>
  );
}
