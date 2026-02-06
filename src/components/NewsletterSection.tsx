import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewsletterSection() {
  const [email, setEmail] = useState("");

  return (
    <section className="section-padding bg-card/50">
      <div className="container max-w-2xl text-center">
        <h2 className="text-3xl md:text-4xl font-display mb-4">
          Stay in the <span className="text-gradient">Loop</span>
        </h2>
        <p className="text-muted-foreground mb-8">
          Get the latest tips, features, and industry insights delivered to your inbox.
        </p>
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
        >
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 bg-background border-border"
          />
          <Button variant="hero" type="submit">
            Subscribe
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-3">
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  );
}
