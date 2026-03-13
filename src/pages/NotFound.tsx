import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle p-6">
      <div className="text-center animate-fade-up">
        <h1 className="text-8xl font-bold font-display text-gradient mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-8">This page doesn't exist</p>
        <Button asChild className="rounded-full px-6" size="lg">
          <Link to="/">
            <Home className="h-4 w-4 mr-2" />
            Back to Hangz
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
