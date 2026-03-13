import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface RateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rateeId: string;
  rateeName: string;
  onRated?: () => void;
}

const RateUserDialog: React.FC<RateUserDialogProps> = ({
  open,
  onOpenChange,
  rateeId,
  rateeName,
  onRated,
}) => {
  const { toast } = useToast();
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (score === 0) {
      toast({ title: "Please select a rating", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("ratings").insert({
        rater_id: user.id,
        ratee_id: rateeId,
        score,
        comment: comment.trim() || null,
      });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Already rated", description: "You've already rated this person.", variant: "destructive" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Rating submitted", description: `You rated ${rateeName} ${score}/5.` });
        onRated?.();
        onOpenChange(false);
        setScore(0);
        setComment("");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-0 shadow-card">
        <DialogHeader>
          <DialogTitle className="font-display">Rate {rateeName}</DialogTitle>
          <DialogDescription>How was your hangout experience?</DialogDescription>
        </DialogHeader>

        {/* Star rating */}
        <div className="flex justify-center gap-2 py-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="focus:outline-none transition-transform hover:scale-125 active:scale-95"
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setScore(star)}
            >
              <Star
                className={`h-9 w-9 transition-colors ${
                  star <= (hover || score)
                    ? "fill-primary text-primary"
                    : "text-border"
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground font-medium">
          {score === 0
            ? "Tap a star"
            : score <= 2
            ? "Could be better"
            : score <= 3
            ? "It was okay"
            : score <= 4
            ? "Great hangout!"
            : "Amazing experience!"}
        </p>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Leave a comment (optional)…"
          rows={3}
          className="mt-2 rounded-xl"
        />

        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1 rounded-xl" onClick={handleSubmit} disabled={loading || score === 0}>
            {loading ? "Submitting…" : "Submit Rating"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RateUserDialog;
