import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Link to="/" className="font-display text-xl tracking-wider text-foreground">
              TATTOO<span className="text-primary">NOW</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              The all-in-one platform for tattoo artists, studios, and events.
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm mb-4 text-foreground">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/artist-software" className="hover:text-foreground transition-colors">Artist Software</Link></li>
              <li><Link to="/network-preview" className="hover:text-foreground transition-colors">Network</Link></li>
              <li><a href="/#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm mb-4 text-foreground">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Blog</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm mb-4 text-foreground">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} TattooNOW. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
