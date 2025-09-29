import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Trash2 } from "lucide-react";
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

interface ProductReview {
  id: string;
  reviewer_name: string;
  reviewer_email?: string;
  rating: number;
  comment: string;
  is_approved: boolean;
  is_featured: boolean;
  helpful_count: number;
  created_at: string;
}

interface ProductReviewsManagerProps {
  productId: string;
  productName: string;
}

const ProductReviewsManager = ({ productId, productName }: ProductReviewsManagerProps) => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && productId) {
      fetchReviews();
    }
  }, [user, productId]);

  const fetchReviews = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
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
  };

  const deleteReview = async (reviewId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('product_reviews')
        .delete()
        .eq('id', reviewId)
        .eq('owner_id', user.id);

      if (error) throw error;

      setReviews(reviews.filter(review => review.id !== reviewId));
      toast({
        title: "تم الحذف",
        description: "تم حذف التعليق بنجاح",
      });
    } catch (error) {
      console.error('Error deleting review:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في حذف التعليق",
        variant: "destructive",
      });
    }
  };


  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
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
  };

  const averageRating = reviews.length > 0 
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
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <CardTitle className="text-right">إدارة تعليقات المنتج</CardTitle>
            <div className="text-sm text-gray-600 text-right">
              {productName}
            </div>
          </div>
          <div className="text-left space-y-1">
            <div className="flex items-center gap-2">
              {renderStars(averageRating)}
              <span className="text-lg font-bold">
                {averageRating.toFixed(1)}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              {reviews.length === 0 ? "لا توجد تعليقات" : 
                reviews.length === 1 ? "تعليق واحد" :
                reviews.length === 2 ? "تعليقان" :
                reviews.length >= 3 && reviews.length <= 10 ? `${reviews.length} تعليقات` :
                `${reviews.length} تعليق`}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {reviews.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            لا توجد تعليقات لهذا المنتج حتى الآن
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                onDelete={deleteReview}
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
  review: ProductReview;
  onDelete: (id: string) => void;
  renderStars: (rating: number) => React.ReactNode;
}

const ReviewCard = ({ 
  review, 
  onDelete, 
  renderStars 
}: ReviewCardProps) => {
  return (
    <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start gap-4">
        {/* Delete Button - Left Side */}
        <div className="flex-shrink-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-red-600 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-2"
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
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => onDelete(review.id)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  حذف
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Review Content - Right Side */}
        <div className="flex-1 text-right space-y-3">
          {/* Stars */}
          <div className="flex justify-end">
            {renderStars(review.rating)}
          </div>

          {/* Reviewer Name */}
          <div className="font-bold text-lg text-gray-800">
            {review.reviewer_name}
          </div>

          {/* Date */}
          <div className="text-sm text-gray-500">
            {new Date(review.created_at).toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric'
            })}
          </div>

          {/* Comment */}
          <div className="text-gray-700 leading-relaxed text-base mt-4">
            {review.comment}
          </div>

          {/* Helpful Count */}
          {review.helpful_count > 0 && (
            <div className="text-sm text-gray-500 mt-3">
              {review.helpful_count} شخص وجد هذا التعليق مفيداً
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductReviewsManager;