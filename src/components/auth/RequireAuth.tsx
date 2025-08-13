import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface RequireAuthProps {
  children: React.ReactNode;
}

const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const [checked, setChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthed(!!session);
      setChecked(true);
      if (!session) navigate("/auth", { replace: true });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthed(!!session);
      setChecked(true);
      if (!session) navigate("/auth", { replace: true });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (!checked) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        <div className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Checking session...</div>
      </div>
    );
  }

  if (!isAuthed) return null;

  return <>{children}</>;
};

export default RequireAuth;
