import { useEffect, useState } from "react";
import { Star, MessageSquarePlus } from "lucide-react";
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

interface Review {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
}

interface RatingSectionProps {
  productId: string;
  storeSlug?: string;
  reviews?: Review[];
}

const reviewCountLabel = (count: number) => {
  if (count === 0) return "لا توجد مراجعات";
  if (count === 1) return "مراجعة واحدة";
  if (count === 2) return "مراجعتان";
  if (count >= 3 && count <= 10) return `${count} مراجعات`;
  return `${count} مراجعة`;
};

const RatingSection = ({ productId, storeSlug, reviews = [] }: RatingSectionProps) => {
  const [dbReviews, setDbReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newReview, setNewReview] = useState({ name: "", rating: 0, comment: "" });
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchReviews = async () => {
    if (!productId) return;
    setLoading(true);

    try {
      if (storeSlug) {
        const data = await fetchApprovedReviewsForStore(storeSlug, productId);
        const mapped = data.map((r) => ({
          id: r.id,
          name: r.reviewer_name,
          rating: r.rating,
          comment: r.comment,
          date: new Date(r.created_at).toLocaleDateString("ar-EG"),
          helpful: r.helpful_count ?? 0,
          avatar: "",
        }));
        setDbReviews(mapped);
        return;
      }

      if (!user?.id) {
        setDbReviews([]);
        return;
      }

      const data = await fetchApprovedReviewsForOwner(productId, user.id);
      const mapped = data.map((r) => ({
        id: r.id,
        name: r.reviewer_name,
        rating: r.rating,
        comment: r.comment,
        date: new Date(r.created_at).toLocaleDateString("ar-EG"),
        helpful: r.helpful_count ?? 0,
        avatar: "",
      }));
      setDbReviews(mapped);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [productId, storeSlug, user?.id]);

  const allReviews = reviews.length > 0 ? reviews : dbReviews;

  const averageRating =
    allReviews.length > 0
      ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length
      : 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = allReviews.filter((review) => review.rating === rating).length;
    const percentage = allReviews.length > 0 ? (count / allReviews.length) * 100 : 0;
    return { rating, count, percentage };
  });

  const handleSubmitReview = async () => {
    if (!newReview.name.trim() || !newReview.comment.trim() || newReview.rating === 0) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive",
      });
      return;
    }

    if (newReview.comment.trim().length < 2) {
      toast({
        title: "خطأ",
        description: "يجب أن يحتوي التعليق على حرفين على الأقل",
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
        if (!result.success) throw new Error(result.error);
      } else {
        if (!user?.id) throw new Error("يجب تسجيل الدخول");
        const result = await submitMerchantReview(user.id, {
          productId,
          reviewerName: newReview.name.trim(),
          rating: newReview.rating,
          comment: newReview.comment.trim(),
        });
        if (!result.success) throw new Error(result.error);
      }

      toast({
        title: storeSlug ? "تم إرسال تقييمك" : "تم إضافة التقييم",
        description: storeSlug
          ? "سيظهر التقييم بعد موافقة المتجر. شكراً لك!"
          : "شكراً لك على تقييمك!",
      });

      setNewReview({ name: "", rating: 0, comment: "" });
      setShowReviewForm(false);
      fetchReviews();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في إرسال التقييم. يرجى المحاولة مرة أخرى",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderInteractiveStars = (rating: number, size = "w-7 h-7") => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setNewReview({ ...newReview, rating: star })}
          className="p-0.5"
          aria-label={`${star} نجوم`}
        >
          <Star
            className={`${size} transition-colors ${
              star <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/40 hover:text-amber-300"
            }`}
          />
        </button>
      ))}
    </div>
  );

  const renderStars = (rating: number, size = "w-4 h-4") => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${size} ${star <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );

  return (
    <section className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6 border-b border-border/40 bg-muted/20">
        <div className="text-right">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">التقييمات والمراجعات</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{reviewCountLabel(allReviews.length)}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowReviewForm(!showReviewForm)}
          className="rounded-xl shrink-0 self-end sm:self-auto"
        >
          <MessageSquarePlus className="w-4 h-4 ml-1.5" />
          أضف تقييم
        </Button>
      </div>

      <div className="p-4 sm:p-6">
        <div className="grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-8 items-center rounded-xl bg-muted/40 border border-border/30 p-4 sm:p-6 mb-6">
          <div className="text-center sm:text-right sm:min-w-[120px]">
            <div className="text-4xl sm:text-5xl font-bold text-foreground leading-none">
              {averageRating.toFixed(1)}
            </div>
            <div className="flex justify-center sm:justify-end mt-2 mb-1">
              {renderStars(Math.round(averageRating), "w-4 h-4 sm:w-5 sm:h-5")}
            </div>
            <p className="text-xs text-muted-foreground">{reviewCountLabel(allReviews.length)}</p>
          </div>

          <div className="space-y-2">
            {ratingDistribution.map(({ rating, count, percentage }) => (
              <div key={rating} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground w-4 text-left">{rating}</span>
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden border border-border/30">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-muted-foreground w-6 text-left tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {showReviewForm && (
          <div className="rounded-xl border border-border bg-background p-4 sm:p-6 space-y-4 mb-6">
            <h3 className="text-base font-semibold text-right text-foreground">أضف تقييمك</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground text-right mb-2">الاسم *</label>
                <Input
                  value={newReview.name}
                  onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}
                  placeholder="اكتب اسمك"
                  className="text-right rounded-xl"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground text-right mb-2">التقييم *</label>
                <div className="flex justify-end">{renderInteractiveStars(newReview.rating)}</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground text-right mb-2">التعليق *</label>
                <Textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  placeholder="اكتب تعليقك هنا..."
                  className="text-right rounded-xl min-h-[100px]"
                  rows={3}
                  disabled={submitting}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowReviewForm(false)} disabled={submitting} className="rounded-xl">
                  إلغاء
                </Button>
                <Button onClick={handleSubmitReview} disabled={submitting} className="rounded-xl">
                  {submitting ? "جاري الإرسال..." : "إرسال التقييم"}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">جاري تحميل التقييمات...</div>
          ) : allReviews.length === 0 ? (
            <div className="text-center py-10 rounded-xl border border-dashed border-border/60 bg-muted/20">
              <Star className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد تقييمات لهذا المنتج حتى الآن</p>
              <p className="text-xs text-muted-foreground/80 mt-1">كن أول من يقيّم هذا المنتج</p>
            </div>
          ) : (
            allReviews.map((review) => (
              <article
                key={review.id}
                className="rounded-xl border border-border/40 bg-background p-4 sm:p-5"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <Avatar className="w-10 h-10 sm:w-11 sm:h-11 shrink-0">
                    <AvatarImage src={review.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {review.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">{review.date}</span>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-foreground text-sm sm:text-base">{review.name}</h4>
                        {renderStars(review.rating)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default RatingSection;
