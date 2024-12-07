import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function NavBar() {
  const [location] = useLocation();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-6">
        <div className="flex h-14 items-center justify-between">
          <div className="flex">
            <Link href="/"
              className={cn(
                "text-lg font-semibold transition-colors hover:text-primary",
                location === "/" ? "text-primary" : "text-gray-500"
              )}>
              Video Content Hub
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/"
              className={cn(
                "text-sm transition-colors hover:text-primary",
                location === "/" ? "text-primary" : "text-gray-500"
              )}>
              Dashboard
            </Link>
            <Link href="/processing"
              className={cn(
                "text-sm transition-colors hover:text-primary",
                location === "/processing" ? "text-primary" : "text-gray-500"
              )}>
              Video Processing
            </Link>
            <Link href="/analysis"
              className={cn(
                "text-sm transition-colors hover:text-primary",
                location === "/analysis" ? "text-primary" : "text-gray-500"
              )}>
              Video Analysis
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
