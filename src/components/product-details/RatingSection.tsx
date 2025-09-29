import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  reviews?: Review[];
}

const RatingSection = ({ productId, reviews = [] }: RatingSectionProps) => {
  const [dbReviews, setDbReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newReview, setNewReview] = useState({
    name: "",
    rating: 0,
    comment: ""
  });
  const { toast } = useToast();

  const fetchReviews = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('product_reviews')
      .select('id, reviewer_name, rating, comment, created_at, helpful_count')
      .eq('product_id', productId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((r: any) => ({
        id: r.id,
        name: r.reviewer_name,
        rating: r.rating,
        comment: r.comment,
        date: new Date(r.created_at).toLocaleDateString('ar-EG'),
        helpful: r.helpful_count ?? 0,
        avatar: "",
      }));
      setDbReviews(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const allReviews = reviews.length > 0 ? reviews : dbReviews;

  // Calculate average rating
  const averageRating = allReviews.length > 0 
    ? allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length 
    : 0;

  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const count = allReviews.filter(review => review.rating === rating).length;
    const percentage = allReviews.length > 0 ? (count / allReviews.length) * 100 : 0;
    return { rating, count, percentage };
  });

  const handleSubmitReview = async () => {
    if (!newReview.name.trim() || !newReview.comment.trim() || newReview.rating === 0) {
      toast({
        title: "خطأ",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    if (newReview.comment.trim().length < 2) {
      toast({
        title: "خطأ",
        description: "يجب أن يحتوي التعليق على حرفين على الأقل",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);
    try {
      // First get the product owner to associate the review with
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('owner_id')
        .eq('id', productId)
        .single();

      if (productError || !productData) {
        throw new Error('لم يتم العثور على المنتج');
      }

      const { error } = await supabase
        .from('product_reviews')
        .insert({
          product_id: productId,
          owner_id: productData.owner_id,
          reviewer_name: newReview.name.trim(),
          reviewer_email: null,
          rating: newReview.rating,
          comment: newReview.comment.trim(),
          is_approved: true // Add directly to product
        });

      if (error) throw error;

      toast({
        title: "تم إضافة التقييم",
        description: "شكراً لك على تقييمك!"
      });

      setNewReview({ name: "", rating: 0, comment: "" });
      setShowReviewForm(false);
      
      // Refresh reviews to show the new one
      fetchReviews();
      setShowReviewForm(false);

    } catch (error) {
      console.error('Error submitting review:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في إرسال التقييم. يرجى المحاولة مرة أخرى",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const renderInteractiveStars = (rating: number, size = "w-8 h-8") => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} cursor-pointer transition-colors ${
              star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 hover:text-yellow-200"
            }`}
            onClick={() => setNewReview({...newReview, rating: star})}
          />
        ))}
      </div>
    );
  };

  const renderStars = (rating: number, size = "w-4 h-4") => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setShowReviewForm(!showReviewForm)}
          className="text-sm"
        >
          أضف تقييم
        </Button>
        <h2 className="text-2xl font-bold text-right">التقييمات والمراجعات</h2>
      </div>

      {/* Overall Rating */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="space-y-2">
              {ratingDistribution.map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center gap-2 text-sm">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-gray-600 w-8">{count}</span>
                  <div className="flex items-center">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 ml-1" />
                    <span className="text-gray-700">{rating}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-center">
            <div className="text-6xl font-bold text-gray-900">
              {averageRating.toFixed(1)}
            </div>
            <div className="flex justify-center mb-2">
              {renderStars(averageRating, "w-5 h-5")}
            </div>
            <div className="text-sm text-gray-600">
              ({allReviews.length === 0 ? "لا توجد مراجعات" : 
                allReviews.length === 1 ? "مراجعة واحدة" :
                allReviews.length === 2 ? "مراجعتان" :
                `${allReviews.length} مراجعة${allReviews.length > 10 ? "" : "ات"}`})
            </div>
          </div>
        </div>
      </div>

      {/* Review Form */}
      {showReviewForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <h3 className="text-lg font-semibold text-right">أضف تقييمك</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                الاسم *
              </label>
              <Input
                value={newReview.name}
                onChange={(e) => setNewReview({...newReview, name: e.target.value})}
                placeholder="اكتب اسمك"
                className="text-right"
                disabled={submitting}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                التقييم *
              </label>
              <div className="flex justify-end">
                {renderInteractiveStars(newReview.rating)}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                التعليق *
              </label>
              <Textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
                placeholder="اكتب تعليقك هنا..."
                className="text-right"
                rows={3}
                disabled={submitting}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowReviewForm(false)}
                disabled={submitting}
              >
                إلغاء
              </Button>
              <Button 
                onClick={handleSubmitReview}
                disabled={submitting}
              >
                {submitting ? "جاري الإرسال..." : "إرسال التقييم"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/** Review form removed to keep only real customer reviews */}

      {/* Reviews List */}
      <div className="space-y-4">
        {allReviews.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            لا توجد تقييمات لهذا المنتج حتى الآن
          </div>
        ) : (
          allReviews.map((review) => (
            <div key={review.id} className="bg-white border border-gray-200 rounded-2xl p-6">
              <div className="flex items-start gap-4">
              <div className="flex-1 text-right">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{review.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderStars(review.rating)}
                    <h4 className="font-semibold text-gray-900">{review.name}</h4>
                  </div>
                </div>
                  <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                </div>
                <Avatar className="w-12 h-12">
                  <AvatarImage src={review.avatar} />
                  <AvatarFallback>{review.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RatingSection;