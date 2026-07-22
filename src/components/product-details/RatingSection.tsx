import { useCallback, useEffect, useState } from "react";
import { Star, PenLine, BadgeCheck } from "lucide-react";

import { useInView } from "@/hooks/useInView";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  fetchApprovedReviewsForOwner,
  fetchApprovedReviewsForStore,
  submitMerchantReview,
  submitStorefrontReview,
} from "@/services/storefrontReviewService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
  verified?: boolean;
  merchantReply?: string;
}

interface RatingSectionProps {
  productId: string;
  storeSlug?: string;
  reviews?: Review[];
}

const reviewCountLabel = (count: number) => {
  if (count === 0) return "لا توجد مراجعات بعد";
  if (count === 1) return "مراجعة واحدة";
  if (count === 2) return "مراجعتان";
  if (count >= 3 && count <= 10) return `${count} مراجعات`;
  return `${count} مراجعة`;
};

const RatingSection = ({ productId, storeSlug, reviews = [] }: RatingSectionProps) => {
  const [sectionRef, inView] = useInView<HTMLDivElement>();
  const [dbReviews, setDbReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newReview, setNewReview] = useState({ name: "", rating: 0, comment: "" });
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchReviews = useCallback(async () => {
    if (!productId) return;
    setLoading(true);

    try {
      if (storeSlug) {
        const data = await fetchApprovedReviewsForStore(storeSlug, productId);
        setDbReviews(
          data.map((r) => ({
            id: r.id,
            name: r.reviewer_name,
            rating: r.rating,
            comment: r.comment,
            date: new Date(r.created_at).toLocaleDateString("ar-EG"),
            helpful: r.helpful_count ?? 0,
            avatar: "",
          }))
        );
        return;
      }

      if (!user?.id) {
        setDbReviews([]);
        return;
      }

      const data = await fetchApprovedReviewsForOwner(productId, user.id);
      setDbReviews(
        data.map((r) => ({
          id: r.id,
          name: r.reviewer_name,
          rating: r.rating,
          comment: r.comment,
          date: new Date(r.created_at).toLocaleDateString("ar-EG"),
          helpful: r.helpful_count ?? 0,
          avatar: "",
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [productId, storeSlug, user?.id]);

  useEffect(() => {
    if (!inView) return;
    void fetchReviews();
  }, [inView, fetchReviews]);

  const allReviews = reviews.length > 0 ? reviews : dbReviews;
  const hasReviews = allReviews.length > 0;

  const averageRating = hasReviews
    ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
    : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = allReviews.filter((review) => review.rating === rating).length;
    const percentage = hasReviews ? (count / allReviews.length) * 100 : 0;
    return { rating, count, percentage };
  });

  const canSubmit =
    newReview.name.trim().length > 0 &&
    newReview.comment.trim().length >= 2 &&
    newReview.rating > 0 &&
    !submitting;

  const handleSubmitReview = async () => {
    if (!canSubmit) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      if (storeSlug) {
        const result = await submitStorefrontReview(storeSlug, {
          productId,
          reviewerName: newReview.name.trim(),
          rating: newReview.rating,
          comment: newReview.comment.trim(),
        });
        if (!result.success) throw new Error(result.error ?? "فشل إرسال التقييم");
      } else {
        if (!user?.id) throw new Error("يجب تسجيل الدخول");
        const result = await submitMerchantReview(user.id, {
          productId,
          reviewerName: newReview.name.trim(),
          rating: newReview.rating,
          comment: newReview.comment.trim(),
        });
        if (!result.success) throw new Error(result.error ?? "فشل إرسال التقييم");
      }

      toast({
        title: storeSlug ? "تم إرسال تقييمك" : "تم إضافة التقييم",
        description: storeSlug
          ? "سيظهر التقييم بعد موافقة المتجر. شكراً لك!"
          : "شكراً لك على تقييمك!",
      });

      setNewReview({ name: "", rating: 0, comment: "" });
      setShowReviewForm(false);
      void fetchReviews();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "خطأ",
        description:
          error instanceof Error ? error.message : "حدث خطأ في إرسال التقييم. يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderInteractiveStars = (rating: number, size = "w-8 h-8") => (
    <div className="flex items-center gap-1 justify-end">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setNewReview((prev) => ({ ...prev, rating: star }))}
          className="p-0.5 rounded-md hover:scale-110 transition-transform"
          aria-label={`${star} نجوم`}
        >
          <Star
            className={cn(
              size,
              "transition-colors",
              star <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"
            )}
          />
        </button>
      ))}
    </div>
  );

  const renderStars = (rating: number, size = "w-3.5 h-3.5") => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            size,
            star <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/15"
          )}
        />
      ))}
    </div>
  );

  return (
    <section ref={sectionRef} className="sf-card overflow-hidden" dir="rtl">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-5 py-5 sm:px-6 border-b border-border/[0.07]">
        <div className="text-right space-y-0.5">
          <h2 className="text-lg font-bold text-foreground tracking-tight">التقييمات والمراجعات</h2>
          <p className="text-sm text-muted-foreground">{reviewCountLabel(allReviews.length)}</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowReviewForm((open) => !open)}
          className={cn(
            "rounded-xl shrink-0 self-stretch sm:self-auto h-10 px-5 font-medium",
            showReviewForm
              ? "bg-muted text-foreground hover:bg-muted/80"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          <PenLine className="w-4 h-4 ml-2" />
          {showReviewForm ? "إغلاق" : "اكتب تقييمك"}
        </Button>
      </header>

      <div className="px-5 py-6 sm:px-6 space-y-6">
        {/* Summary panel */}
        <div
          className={cn(
            "rounded-xl bg-muted/25 p-5 sm:p-6",
            hasReviews && "flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-10"
          )}
        >
          {/* Score block — always right-aligned in RTL */}
          <div className="text-right space-y-2 shrink-0">
            <p className="text-4xl sm:text-5xl font-bold text-foreground tabular-nums leading-none">
              {averageRating.toFixed(1)}
            </p>
            <div className="flex justify-end">{renderStars(Math.round(averageRating), "w-4 h-4")}</div>
            <p className="text-xs text-muted-foreground">{reviewCountLabel(allReviews.length)}</p>
          </div>

          {/* Distribution — fixed width so bars don't stretch */}
          {hasReviews ? (
            <div className="w-full md:w-auto md:flex-1 md:max-w-xs md:mr-auto space-y-2">
              {ratingDistribution.map(({ rating, count, percentage }) => (
                <div
                  key={rating}
                  className="grid grid-cols-[1.25rem_0.75rem_1fr_1.25rem] items-center gap-2"
                >
                  <span className="text-xs text-muted-foreground tabular-nums text-right">{rating}</span>
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                  <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400/80 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          ) : !loading ? (
            <p className="text-sm text-muted-foreground text-right md:text-center flex-1">
              كن أول من يشارك تجربته مع هذا المنتج
            </p>
          ) : null}
        </div>

        {/* Review form */}
        {showReviewForm && (
          <div className="rounded-xl border border-border/[0.07] bg-background/50 p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">شاركنا رأيك</h3>
              {storeSlug && (
                <span className="text-[11px] text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">
                  يُعرض بعد موافقة المتجر
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground text-right mb-2">
                  الاسم
                </label>
                <Input
                  value={newReview.name}
                  onChange={(e) => setNewReview((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="اسمك أو لقبك"
                  className="text-right rounded-xl border-border/[0.08]"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground text-right mb-2">
                  تقييمك
                </label>
                {renderInteractiveStars(newReview.rating)}
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground text-right mb-2">
                  تعليقك
                </label>
                <Textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder="ما الذي أعجبك أو لم يعجبك؟"
                  className="text-right rounded-xl min-h-[100px] border-border/[0.08] resize-none"
                  rows={3}
                  disabled={submitting}
                />
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <Button
                  variant="ghost"
                  onClick={() => setShowReviewForm(false)}
                  disabled={submitting}
                  className="rounded-xl"
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={!canSubmit}
                  className="rounded-xl px-6"
                >
                  {submitting ? "جاري الإرسال..." : "إرسال"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reviews list */}
        {loading ? (
          <p className="text-center py-8 text-sm text-muted-foreground">جاري تحميل التقييمات...</p>
        ) : hasReviews ? (
          <div className="space-y-3">
            {allReviews.map((review) => (
              <article
                key={review.id}
                className="rounded-xl bg-muted/15 border border-border/[0.06] p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={review.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {review.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 text-right space-y-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-sm text-foreground">{review.name}</span>
                      {review.verified && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          <BadgeCheck className="w-3 h-3" />
                          شراء موثّق
                        </span>
                      )}
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <time className="text-xs text-muted-foreground tabular-nums">{review.date}</time>
                    </div>

                    {renderStars(review.rating)}

                    <p className="text-sm text-foreground/80 leading-relaxed">{review.comment}</p>

                    {review.merchantReply && (
                      <div className="rounded-lg bg-primary/5 border-r-2 border-primary/25 px-3 py-2.5 mt-1">
                        <p className="text-[11px] font-semibold text-primary mb-1">رد المتجر</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{review.merchantReply}</p>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : !showReviewForm ? (
          <p className="text-center text-sm text-muted-foreground py-2">
            اضغط «اكتب تقييمك» لمشاركة تجربتك
          </p>
        ) : null}
      </div>
    </section>
  );
};

export default RatingSection;
