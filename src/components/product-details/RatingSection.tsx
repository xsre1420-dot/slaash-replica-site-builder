import { useEffect, useState } from "react";

import { Star, MessageSquarePlus, BadgeCheck } from "lucide-react";

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

  if (count === 0) return "لا توجد مراجعات";

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

    if (!inView) return;

    void fetchReviews();

  }, [productId, storeSlug, user?.id, inView]);



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

          className="p-0.5 rounded-md hover:bg-primary/5 transition-colors"

          aria-label={`${star} نجوم`}

        >

          <Star

            className={cn(

              size,

              "transition-colors",

              star <= rating ? "text-primary fill-primary" : "text-muted-foreground/25 hover:text-primary/50"

            )}

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

          className={cn(

            size,

            star <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/15"

          )}

        />

      ))}

    </div>

  );



  return (

    <section ref={sectionRef} className="rounded-2xl overflow-hidden border border-border/10 shadow-sm">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-5 sm:px-7 sm:py-6">

        <div className="text-right space-y-1">

          <h2 className="text-xl font-bold text-foreground tracking-tight">التقييمات والمراجعات</h2>

          <p className="text-sm text-muted-foreground">{reviewCountLabel(allReviews.length)}</p>

        </div>

        <Button

          variant="outline"

          size="sm"

          onClick={() => setShowReviewForm(!showReviewForm)}

          className="rounded-xl shrink-0 self-end sm:self-auto border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 font-medium"

        >

          <MessageSquarePlus className="w-4 h-4 ml-1.5" />

          أضف تقييم

        </Button>

      </div>



      <div className="px-5 sm:px-7 pb-6 sm:pb-8 space-y-6">

        <div className="grid sm:grid-cols-[auto_1fr] gap-6 sm:gap-12 items-center rounded-xl bg-background/50 p-5 sm:p-6 border border-border/8">

          <div className="text-center sm:text-right sm:min-w-[130px] space-y-2">

            <div className="text-5xl sm:text-6xl font-extrabold text-primary leading-none tabular-nums tracking-tight">

              {averageRating.toFixed(1)}

            </div>

            <div className="flex justify-center sm:justify-end">

              {renderStars(Math.round(averageRating), "w-4 h-4 sm:w-5 sm:h-5")}

            </div>

            <p className="text-xs text-muted-foreground font-medium">{reviewCountLabel(allReviews.length)}</p>

          </div>



          <div className="space-y-2.5">

            {ratingDistribution.map(({ rating, count, percentage }) => (

              <div key={rating} className="flex items-center gap-3 text-sm">

                <span className="text-muted-foreground w-3 text-left tabular-nums text-xs font-medium">{rating}</span>

                <Star className="w-3.5 h-3.5 text-primary fill-primary shrink-0 opacity-80" />

                <div className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden">

                  <div

                    className="h-full bg-primary/80 rounded-full transition-all duration-700 ease-out"

                    style={{ width: `${percentage}%` }}

                  />

                </div>

                <span className="text-muted-foreground w-6 text-left tabular-nums text-xs">{count}</span>

              </div>

            ))}

          </div>

        </div>



        {showReviewForm && (

          <div className="rounded-xl bg-background/60 p-5 sm:p-6 space-y-4 border border-border/10">

            <h3 className="text-sm font-semibold text-right text-foreground">أضف تقييمك</h3>

            <div className="space-y-4">

              <div>

                <label className="block text-xs font-medium text-muted-foreground text-right mb-2">الاسم *</label>

                <Input

                  value={newReview.name}

                  onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}

                  placeholder="اكتب اسمك"

                  className="text-right rounded-xl bg-background border-border/15 focus-visible:ring-primary/30"

                  disabled={submitting}

                />

              </div>

              <div>

                <label className="block text-xs font-medium text-muted-foreground text-right mb-2">التقييم *</label>

                <div className="flex justify-end">{renderInteractiveStars(newReview.rating)}</div>

              </div>

              <div>

                <label className="block text-xs font-medium text-muted-foreground text-right mb-2">التعليق *</label>

                <Textarea

                  value={newReview.comment}

                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}

                  placeholder="اكتب تعليقك هنا..."

                  className="text-right rounded-xl min-h-[100px] bg-background border-border/15 focus-visible:ring-primary/30"

                  rows={3}

                  disabled={submitting}

                />

              </div>

              <div className="flex gap-2 justify-end">

                <Button variant="ghost" onClick={() => setShowReviewForm(false)} disabled={submitting} className="rounded-xl">

                  إلغاء

                </Button>

                <Button onClick={handleSubmitReview} disabled={submitting} className="rounded-xl bg-primary hover:bg-primary/90">

                  {submitting ? "جاري الإرسال..." : "إرسال التقييم"}

                </Button>

              </div>

            </div>

          </div>

        )}



        <div className="space-y-3">

          {loading ? (

            <div className="text-center py-12 text-muted-foreground text-sm">جاري تحميل التقييمات...</div>

          ) : allReviews.length === 0 ? (

            <div className="text-center py-14 rounded-xl bg-background/40 border border-border/8">

              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">

                <Star className="w-5 h-5 text-primary" />

              </div>

              <p className="text-sm font-medium text-foreground">لا توجد تقييمات بعد</p>

              <p className="text-xs text-muted-foreground mt-1">كن أول من يقيّم هذا المنتج</p>

            </div>

          ) : (

            allReviews.map((review) => (

              <article

                key={review.id}

                className="rounded-xl bg-background/50 p-4 sm:p-5 border border-border/8 hover:border-primary/15 transition-colors"

              >

                <div className="flex items-start gap-3 sm:gap-4">

                  <Avatar className="w-10 h-10 shrink-0 ring-1 ring-border/20">

                    <AvatarImage src={review.avatar} />

                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">

                      {review.name.charAt(0)}

                    </AvatarFallback>

                  </Avatar>

                  <div className="flex-1 min-w-0 text-right space-y-2">

                    <div className="flex flex-wrap items-center justify-between gap-2">

                      <span className="text-[11px] text-muted-foreground tabular-nums">{review.date}</span>

                      <div className="flex flex-wrap items-center gap-2">

                        <h4 className="font-semibold text-foreground text-sm">{review.name}</h4>

                        {review.verified && (

                          <span className="inline-flex items-center gap-0.5 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">

                            <BadgeCheck className="w-3 h-3" />

                            شراء موثّق

                          </span>

                        )}

                        {renderStars(review.rating)}

                      </div>

                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>

                    {review.merchantReply && (

                      <div className="mt-3 rounded-lg bg-primary/5 px-3.5 py-3 text-right border-r-2 border-primary/30">

                        <p className="text-[11px] font-semibold text-primary mb-1">رد المتجر</p>

                        <p className="text-xs text-muted-foreground leading-relaxed">{review.merchantReply}</p>

                      </div>

                    )}

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

