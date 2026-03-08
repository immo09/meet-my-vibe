
CREATE TRIGGER on_rating_insert
AFTER INSERT ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_recalc_reputation();
