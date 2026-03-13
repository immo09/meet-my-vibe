import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Home, Users, User, MessageCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { cn } from "@/lib/utils";

const AppNavigation: React.FC = () => {
  const location = useLocation();
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const unreadCount = useUnreadCount(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

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
    { path: "/chat", label: "Chat", icon: MessageCircle },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass border-t z-50">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-1.5 safe-area-bottom">
        {navItems.map(({ path, label, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative min-w-[52px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                {path === "/chat" && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>{label}</span>
              {isActive && (
                <div className="absolute -top-1.5 w-6 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-muted-foreground hover:text-destructive transition-colors min-w-[52px]"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>
    </nav>
  );
};

export default AppNavigation;
