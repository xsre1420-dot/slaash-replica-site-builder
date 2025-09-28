import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Eye, EyeOff, Award } from "lucide-react";
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

  const toggleApproval = async (reviewId: string, currentStatus: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('product_reviews')
        .update({ is_approved: !currentStatus })
        .eq('id', reviewId)
        .eq('owner_id', user.id);

      if (error) throw error;

      setReviews(reviews.map(review => 
        review.id === reviewId 
          ? { ...review, is_approved: !currentStatus }
          : review
      ));

      toast({
        title: currentStatus ? "تم إخفاء التعليق" : "تم إظهار التعليق",
        description: currentStatus 
          ? "لن يظهر هذا التعليق للعملاء"
          : "سيظهر هذا التعليق للعملاء",
      });
    } catch (error) {
      console.error('Error toggling approval:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في تغيير حالة التعليق",
        variant: "destructive",
      });
    }
  };

  const toggleFeatured = async (reviewId: string, currentStatus: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('product_reviews')
        .update({ is_featured: !currentStatus })
        .eq('id', reviewId)
        .eq('owner_id', user.id);

      if (error) throw error;

      setReviews(reviews.map(review => 
        review.id === reviewId 
          ? { ...review, is_featured: !currentStatus }
          : review
      ));

      toast({
        title: currentStatus ? "تم إلغاء التمييز" : "تم تمييز التعليق",
        description: currentStatus 
          ? "لم يعد هذا التعليق مميزاً"
          : "سيظهر هذا التعليق كتعليق مميز",
      });
    } catch (error) {
      console.error('Error toggling featured:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في تغيير حالة التمييز",
        variant: "destructive",
      });
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  const approvedReviews = reviews.filter(review => review.is_approved);
  const pendingReviews = reviews.filter(review => !review.is_approved);

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
              {reviews.length} تعليق - {approvedReviews.length} ظاهر
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
            {/* Pending Reviews */}
            {pendingReviews.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-orange-600 text-right">
                  تعليقات في انتظار المراجعة ({pendingReviews.length})
                </h3>
                {pendingReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onDelete={deleteReview}
                    onToggleApproval={toggleApproval}
                    onToggleFeatured={toggleFeatured}
                    renderStars={renderStars}
                  />
                ))}
              </div>
            )}

            {/* Approved Reviews */}
            {approvedReviews.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-green-600 text-right">
                  التعليقات المنشورة ({approvedReviews.length})
                </h3>
                {approvedReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onDelete={deleteReview}
                    onToggleApproval={toggleApproval}
                    onToggleFeatured={toggleFeatured}
                    renderStars={renderStars}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ReviewCardProps {
  review: ProductReview;
  onDelete: (id: string) => void;
  onToggleApproval: (id: string, currentStatus: boolean) => void;
  onToggleFeatured: (id: string, currentStatus: boolean) => void;
  renderStars: (rating: number) => React.ReactNode;
}

const ReviewCard = ({ 
  review, 
  onDelete, 
  onToggleApproval, 
  onToggleFeatured, 
  renderStars 
}: ReviewCardProps) => {
  return (
    <div className={`border rounded-lg p-4 ${
      !review.is_approved ? 'bg-orange-50 border-orange-200' : 'bg-white'
    }`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleApproval(review.id, review.is_approved)}
            className={review.is_approved ? "text-green-600" : "text-orange-600"}
          >
            {review.is_approved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleFeatured(review.id, review.is_featured)}
            className={review.is_featured ? "text-yellow-600" : "text-gray-400"}
          >
            <Award className="w-4 h-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-red-600">
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

        <div className="text-right space-y-2">
          <div className="flex items-center gap-2 justify-end">
            <div className="flex gap-1">
              {review.is_featured && (
                <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">
                  مميز
                </Badge>
              )}
              <Badge variant={review.is_approved ? "default" : "secondary"}>
                {review.is_approved ? "منشور" : "في انتظار المراجعة"}
              </Badge>
            </div>
            {renderStars(review.rating)}
          </div>
          <div className="font-semibold">{review.reviewer_name}</div>
          <div className="text-sm text-gray-500">
            {new Date(review.created_at).toLocaleDateString('ar-EG')}
          </div>
        </div>
      </div>

      <div className="text-right text-gray-700 leading-relaxed">
        {review.comment}
      </div>

      {review.helpful_count > 0 && (
        <div className="text-sm text-gray-500 mt-2 text-right">
          {review.helpful_count} شخص وجد هذا التعليق مفيداً
        </div>
      )}
    </div>
  );
};

export default ProductReviewsManager;