
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderImagesManagerProps {
  onImagesChange?: (images: string[]) => void;
}

const HeaderImagesManager = ({ onImagesChange }: HeaderImagesManagerProps) => {
  const [headerImages, setHeaderImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Load saved images from localStorage on mount
  useEffect(() => {
    const savedImages = localStorage.getItem('headerImages');
    if (savedImages) {
      try {
        const parsedImages = JSON.parse(savedImages);
        setHeaderImages(parsedImages);
      } catch (error) {
        console.error('Error loading header images:', error);
      }
    }
  }, []);

  // Save images to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('headerImages', JSON.stringify(headerImages));
    onImagesChange?.(headerImages);
  }, [headerImages, onImagesChange]);

  // Auto-rotate images every 5 seconds
  useEffect(() => {
    if (headerImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % headerImages.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [headerImages.length]);

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setHeaderImages(prev => [...prev, imageUrl]);
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    const newImages = headerImages.filter((_, i) => i !== index);
    setHeaderImages(newImages);
    if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(0);
    }
  };

  // If no images, show add button
  if (headerImages.length === 0) {
    return (
      <div className="p-4 bg-white border-b">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <Button className="w-full bg-primary hover:bg-primary/90">
            <Plus className="w-4 h-4 ml-2" />
            إضافة صورة للرأس
          </Button>
        </label>
      </div>
    );
  }

  // Show image carousel
  return (
    <div className="relative">
      <div className="relative h-56 overflow-hidden">
        <img
          src={headerImages[currentImageIndex]}
          alt="Header"
          className="w-full h-full object-cover"
        />
        
        {/* Image Navigation Dots */}
        {headerImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
            {headerImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  currentImageIndex === index ? "bg-white" : "bg-white/50"
                }`}
              />
            ))}
          </div>
        )}

        {/* Image Management Buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <Button size="sm" className="bg-primary/80 hover:bg-primary">
              <Plus className="w-4 h-4 ml-1" />
              إضافة صورة
            </Button>
          </label>
          
          {headerImages.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => removeImage(currentImageIndex)}
              className="bg-primary/80 hover:bg-primary"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default HeaderImagesManager;
