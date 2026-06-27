import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  approveProductReview,
  deleteProductReview,
  fetchMerchantProductReviews,
  type MerchantProductReview,
} from "@/services/reviewService";

interface ProductReviewsManagerProps {
  productId: string;
  productName: string;
}

const ProductReviewsManager = ({ productId, productName }: ProductReviewsManagerProps) => {
  const [reviews, setReviews] = useState<MerchantProductReview[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchReviews = useCallback(async () => {
    if (!user?.id || !productId) return;

    setLoading(true);
    try {
      const rows = await fetchMerchantProductReviews(productId, user.id);
      setReviews(rows);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في تحميل التعليقات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [productId, user?.id, toast]);

  useEffect(() => {
    void fetchReviews();
  }, [fetchReviews]);

  const handleApprove = async (reviewId: string) => {
    if (!user?.id) return;
    const result = await approveProductReview(reviewId, user.id);
    if (result.success) {
      setReviews((prev) =>
        prev.map((r) => (r.id === reviewId ? { ...r, is_approved: true } : r))
      );
      toast({ title: "تمت الموافقة", description: "سيظهر التعليق في المتجر" });
    } else {
      toast({
        title: "خطأ",
        description: result.error || "تعذر الموافقة على التعليق",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!user?.id) return;
    const result = await deleteProductReview(reviewId, user.id);
    if (result.success) {
      setReviews((prev) => prev.filter((review) => review.id !== reviewId));
      toast({ title: "تم الحذف", description: "تم حذف التعليق بنجاح" });
    } else {
      toast({
        title: "خطأ",
        description: result.error || "حدث خطأ في حذف التعليق",
        variant: "destructive",
      });
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 ${
            star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 fill-gray-300"
          }`}
        />
      ))}
    </div>
  );

  const approvedCount = reviews.filter((r) => r.is_approved).length;
  const pendingCount = reviews.length - approvedCount;
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">جاري التحميل...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-6">
        <div className="flex flex-col items-center gap-4">
          <CardTitle className="text-2xl font-bold text-center">إدارة التعليقات</CardTitle>
          <p className="text-sm text-muted-foreground text-center">{productName}</p>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              {renderStars(averageRating)}
              <span className="text-2xl font-bold">{averageRating.toFixed(1)}</span>
            </div>
            <div className="text-sm text-muted-foreground text-center">
              {reviews.length === 0
                ? "لا توجد تعليقات"
                : `${reviews.length} تعليق — ${approvedCount} منشور${pendingCount > 0 ? ` · ${pendingCount} بانتظار الموافقة` : ""}`}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            لا توجد تعليقات لهذا المنتج حتى الآن
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onApprove={handleApprove}
                onDelete={handleDelete}
                renderStars={renderStars}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ReviewCardProps {
  review: MerchantProductReview;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  renderStars: (rating: number) => React.ReactNode;
}

const ReviewCard = ({ review, onApprove, onDelete, renderStars }: ReviewCardProps) => (
  <div className="border rounded-lg p-6 bg-card shadow-sm hover:shadow-md transition-shadow duration-200">
    <div className="flex justify-between items-start gap-6">
      <div className="flex flex-col gap-2 shrink-0">
        {!review.is_approved && (
          <Button
            size="sm"
            className="rounded-lg gap-1"
            onClick={() => onApprove(review.id)}
          >
            <Check className="w-4 h-4" />
            موافقة
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-right">تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription className="text-right">
                هل أنت متأكد من حذف هذا التعليق؟ لن يمكن استرجاعه بعد الحذف.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(review.id)}
                className="bg-destructive hover:bg-destructive/90"
              >
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex-1 text-right space-y-4">
        <div className="flex items-center justify-end gap-3 flex-wrap">
          <div className="font-bold text-lg">{review.reviewer_name}</div>
          {renderStars(review.rating)}
          {!review.is_approved ? (
            <Badge variant="secondary">بانتظار الموافقة</Badge>
          ) : (
            <Badge variant="outline" className="text-emerald-600 border-emerald-200">
              منشور
            </Badge>
          )}
        </div>

        <div className="text-sm text-muted-foreground">
          {new Date(review.created_at).toLocaleDateString("ar-EG", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>

        <div className="text-foreground leading-relaxed text-base">{review.comment}</div>

        {review.helpful_count > 0 && (
          <div className="text-sm text-muted-foreground">
            {review.helpful_count} شخص وجد هذا التعليق مفيداً
          </div>
        )}
      </div>
    </div>
  </div>
);

export default ProductReviewsManager;
