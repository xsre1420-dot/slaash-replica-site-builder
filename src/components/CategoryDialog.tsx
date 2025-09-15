import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CategoryDialogProps {
  onCategoryAdded: () => void;
}

const CategoryDialog = ({ onCategoryAdded }: CategoryDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryName.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم الفئة",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "خطأ",
          description: "يجب تسجيل الدخول أولاً",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('categories')
        .insert({
          name: categoryName.trim(),
          owner_id: user.id,
          display_order: 0
        });

      if (error) {
        throw error;
      }

      console.log('CategoryDialog: تم إضافة الفئة بنجاح');
      toast({
        title: "تم بنجاح",
        description: "تمت إضافة الفئة بنجاح",
      });

      setCategoryName("");
      setIsOpen(false);
      // إضافة تأخير قصير للتأكد من حفظ البيانات
      setTimeout(() => {
        onCategoryAdded();
      }, 100);
    } catch (error: any) {
      console.error('Error adding category:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في إضافة الفئة",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          type="button"
          variant="outline" 
          className="border-dashed border-2 text-blue-600 hover:bg-blue-50 hover:border-blue-300"
        >
          <Plus className="w-4 h-4 ml-2" />
          إضافة فئة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] font-arabic">
        <DialogHeader className="text-right">
          <DialogTitle className="text-right">إضافة فئة جديدة</DialogTitle>
          <DialogDescription className="text-right">
            أضف فئة جديدة لتنظيم منتجاتك بشكل أفضل
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="categoryName" className="text-right block">اسم الفئة</Label>
            <Input
              id="categoryName"
              placeholder="أدخل اسم الفئة"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="text-right"
              disabled={isSubmitting}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              إلغاء
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting || !categoryName.trim()}
              className="text-white"
              style={{ 
                background: 'linear-gradient(135deg, #5b47f5, #4c3ef7)',
              }}
            >
              {isSubmitting ? "جاري الإضافة..." : "إضافة الفئة"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryDialog;