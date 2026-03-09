import React from "react";
import { usePresence } from "@/contexts/PresenceContext";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Props {
  userId: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  lastSeenAt?: string | null;
  showLastSeen?: boolean;
}

const sizeMap = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

const PresenceIndicator: React.FC<Props> = ({ userId, className, size = "md", lastSeenAt, showLastSeen = false }) => {
  const { isOnline } = usePresence();
  const online = isOnline(userId);

  const lastSeenText = !online && lastSeenAt
    ? `Last seen ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`
    : online ? "Online" : "Offline";

  return (
    <span className={cn("inline-flex items-center gap-1.5", showLastSeen && "gap-1.5")}>
      <span
        className={cn(
          "rounded-full border-2 border-background block shrink-0",
          sizeMap[size],
          online ? "bg-green-500" : "bg-muted-foreground/40",
          className
        )}
        title={lastSeenText}
        aria-label={lastSeenText}
      />
      {showLastSeen && !online && lastSeenAt && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {lastSeenText}
        </span>
      )}
    </span>
  );
};

export default PresenceIndicator;
