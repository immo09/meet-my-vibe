import React from "react";
import { usePresence } from "@/contexts/PresenceContext";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

const PresenceIndicator: React.FC<Props> = ({ userId, className, size = "md" }) => {
  const { isOnline } = usePresence();
  const online = isOnline(userId);

  return (
    <span
      className={cn(
        "rounded-full border-2 border-background block shrink-0",
        sizeMap[size],
        online ? "bg-green-500" : "bg-muted-foreground/40",
        className
      )}
      title={online ? "Online" : "Offline"}
      aria-label={online ? "Online" : "Offline"}
    />
  );
};

export default PresenceIndicator;
