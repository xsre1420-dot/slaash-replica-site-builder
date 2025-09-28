import { useState } from "react";
import { Star, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

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
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({
    name: "",
    rating: 0,
    comment: ""
  });

  // Calculate average rating
  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0;

  // Calculate rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => {
    const count = reviews.filter(review => review.rating === rating).length;
    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
    return { rating, count, percentage };
  });

  const handleSubmitReview = () => {
    if (newReview.name && newReview.comment && newReview.rating > 0) {
      // Here you would typically save to database
      console.log("New review:", newReview);
      setNewReview({ name: "", rating: 0, comment: "" });
      setShowReviewForm(false);
    }
  };

  const renderStars = (rating: number, interactive = false, size = "w-4 h-4") => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${size} ${
              star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
            } ${interactive ? "cursor-pointer hover:text-yellow-400" : ""}`}
            onClick={interactive ? () => setNewReview({...newReview, rating: star}) : undefined}
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
              {renderStars(averageRating, false, "w-5 h-5")}
            </div>
            <div className="text-sm text-gray-600">
              ({reviews.length} مراجعة)
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
                الاسم
              </label>
              <Input
                value={newReview.name}
                onChange={(e) => setNewReview({...newReview, name: e.target.value})}
                placeholder="اكتب اسمك"
                className="text-right"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                التقييم
              </label>
              <div className="flex justify-end">
                {renderStars(newReview.rating, true, "w-8 h-8")}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                التعليق
              </label>
              <Textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
                placeholder="اكتب تعليقك هنا..."
                className="text-right"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowReviewForm(false)}
              >
                إلغاء
              </Button>
              <Button onClick={handleSubmitReview}>
                إرسال التقييم
              </Button>
            </div>
          </div>
        </div>
      )}

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