import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

const mockArtists = [
  { name: "Alex Rivera", style: "Neo-Traditional", location: "Austin, TX", rating: 4.9 },
  { name: "Yuki Tanaka", style: "Japanese", location: "Portland, OR", rating: 5.0 },
  { name: "Dante Cruz", style: "Blackwork", location: "Brooklyn, NY", rating: 4.8 },
  { name: "Sophie Laurent", style: "Fine Line", location: "Miami, FL", rating: 4.9 },
  { name: "Marcus Chen", style: "Realism", location: "San Francisco, CA", rating: 4.7 },
  { name: "Isla Morgan", style: "Watercolor", location: "Chicago, IL", rating: 4.8 },
];

export default function NetworkPreview() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <section className="section-padding">
          <div className="container">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-display mb-4">
                Find Your <span className="text-gradient">Artist</span>
              </h1>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Browse the TattooNOW directory to discover talented artists near you.
              </p>
            </div>

            {/* Search bar */}
            <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-12">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by style or name..." className="pl-10 bg-card border-border" />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Location" className="pl-10 bg-card border-border w-full sm:w-48" />
              </div>
              <Button variant="hero">
                <Filter className="h-4 w-4 mr-1" /> Search
              </Button>
            </div>

            {/* Artist grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockArtists.map((artist) => (
                <div
                  key={artist.name}
                  className="group rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 transition-all duration-300"
                >
                  <div className="h-48 bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-sm">Portfolio Preview</span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-display text-base">{artist.name}</h3>
                      <span className="text-xs text-primary font-semibold">★ {artist.rating}</span>
                    </div>
                    <p className="text-xs text-accent mb-1">{artist.style}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {artist.location}
                    </p>
                    <Button variant="heroOutline" size="sm" className="w-full mt-4">
                      View Profile
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
