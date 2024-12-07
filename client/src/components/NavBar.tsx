import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export default function NavBar() {
  const [location] = useLocation();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-6">
        <div className="flex h-14 items-center justify-between">
          <div className="flex">
            <Link href="/">
              <a className={cn(
                "text-lg font-semibold transition-colors hover:text-primary",
                location === "/" ? "text-primary" : "text-gray-500"
              )}>
                Video Content Hub
              </a>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/">
              <a className={cn(
                "text-sm transition-colors hover:text-primary",
                location === "/" ? "text-primary" : "text-gray-500"
              )}>
                Dashboard
              </a>
            </Link>
            <Link href="/uploads">
              <a className={cn(
                "text-sm transition-colors hover:text-primary",
                location === "/uploads" ? "text-primary" : "text-gray-500"
              )}>
                My Uploads
              </a>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
