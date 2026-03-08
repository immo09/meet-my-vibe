import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Users, User, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const AppNavigation: React.FC = () => {
  const location = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({ title: "Signed out successfully" });
    } catch (error) {
      toast({ 
        title: "Error signing out", 
        description: "Please try again",
        variant: "destructive" 
      });
    }
  };

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/nearby", label: "Nearby", icon: Users },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="bg-card border-t border-border px-4 py-2">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {navItems.map(({ path, label, icon: Icon }) => (
          <Button
            key={path}
            variant={location.pathname === path ? "default" : "ghost"}
            size="sm"
            asChild
            className="flex-1 mx-1"
          >
            <Link to={path} className="flex items-center gap-2">
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="flex-1 mx-1"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </nav>
  );
};

export default AppNavigation;