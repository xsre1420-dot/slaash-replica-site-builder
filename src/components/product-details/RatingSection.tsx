import { useEffect, useState } from "react";
import { Star, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
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

  // Review submission removed to ensure only real customer reviews are shown

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
      <h2 className="text-2xl font-bold text-right">التقييمات والمراجعات</h2>

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
              ({reviews.length} مراجعة)
            </div>
          </div>
        </div>
      </div>

      {/** Review form removed to keep only real customer reviews */}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="flex-1 text-right">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-gray-500">
                      <ThumbsUp className="w-4 h-4 ml-1" />
                      {review.helpful}
                    </Button>
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
        ))}
      </div>
    </div>
  );
};

export default RatingSection;