import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Category } from "@/types";
import { generateUUID } from "@/lib/uuid";
import { addCategory, updateCategory, deleteCategory } from "@/services/productService";

interface CategoryDialogProps {
  categories: Category[];
  onCategoryChange: () => void;
  onAddLocalCategory?: (category: Category) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CategoryDialog = ({ categories, onCategoryChange, onAddLocalCategory, open, onOpenChange }: CategoryDialogProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "" });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم للفئة", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await addCategory({
        id: generateUUID(),
        name: newCategory.name.trim(),
        order: categories.length,
      });
      if (!result.success) throw new Error(result.error);

      onCategoryChange();
      setNewCategory({ name: "" });
      setIsAddDialogOpen(false);
      toast({ title: "تم بنجاح", description: "تمت إضافة الفئة الجديدة" });
    } catch {
      if (onAddLocalCategory) {
        const newCat: Category = { id: generateUUID(), name: newCategory.name.trim(), order: categories.length };
        onAddLocalCategory(newCat);
        setNewCategory({ name: "" });
        setIsAddDialogOpen(false);
        toast({ title: "تم بنجاح", description: "تمت إضافة الفئة محلياً" });
      } else {
        toast({ title: "خطأ", description: "فشل في إضافة الفئة", variant: "destructive" });
      }
    }
    setLoading(false);
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم للفئة", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await updateCategory(editingCategory.id, {
        ...editingCategory,
        name: editingCategory.name.trim(),
      });
      if (!result.success) throw new Error(result.error);

      onCategoryChange();
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      toast({ title: "تم بنجاح", description: "تم تحديث الفئة" });
    } catch {
      toast({ title: "خطأ", description: "فشل في تحديث الفئة", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setLoading(true);
    try {
      const result = await deleteCategory(deletingCategory.id);
      if (!result.success) throw new Error(result.error);

      onCategoryChange();
      setIsDeleteDialogOpen(false);
      setDeletingCategory(null);
      toast({ title: "تم بنجاح", description: "تم حذف الفئة" });
    } catch (err: unknown) {
      console.error('Error deleting category:', err);
      toast({ title: "خطأ", description: "فشل في حذف الفئة، تحقق من اتصال الإنترنت", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] text-right rounded-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-foreground">إدارة الفئات</DialogTitle>
            <DialogDescription className="text-right text-muted-foreground">
              إضافة وتعديل وحذف فئات المنتجات
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <Button 
                type="button" variant="outline"
                onClick={() => setIsAddDialogOpen(true)}
                className="border-border hover:bg-accent rounded-xl px-6 gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة فئة جديدة
              </Button>
            </div>

            {categories.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-right block text-foreground font-medium">الفئات الموجودة</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {categories.map((category) => (
                    <div key={category.id} className="flex justify-between items-center p-3 bg-muted border border-border rounded-xl hover:bg-accent transition-colors">
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon"
                          onClick={() => { setDeletingCategory(category); setIsDeleteDialogOpen(true); }}
                          aria-label={`حذف فئة ${category.name}`}
                          className="hover:bg-destructive/10 hover:text-destructive rounded-lg min-h-[44px] min-w-[44px]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon"
                          onClick={() => { setEditingCategory(category); setIsEditDialogOpen(true); }}
                          aria-label={`تعديل فئة ${category.name}`}
                          className="hover:bg-accent rounded-lg min-h-[44px] min-w-[44px]"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                      <span className="font-medium text-foreground">{category.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">لا توجد فئات بعد</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[400px] text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right">إضافة فئة جديدة</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-category" className="text-right block mb-2">اسم الفئة</Label>
            <Input
              id="new-category"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ name: e.target.value })}
              className="text-right rounded-xl"
              placeholder="مثال: ملابس"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button type="button" onClick={handleAddCategory} disabled={loading} className="rounded-xl">إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px] text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right">تعديل الفئة</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="edit-category" className="text-right block mb-2">اسم الفئة</Label>
            <Input
              id="edit-category"
              value={editingCategory?.name || ""}
              onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
              className="text-right rounded-xl"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button type="button" onClick={handleEditCategory} disabled={loading} className="rounded-xl">حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right">حذف الفئة</DialogTitle>
            <DialogDescription className="text-right">
              هل أنت متأكد من حذف فئة &quot;{deletingCategory?.name}&quot;؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl">إلغاء</Button>
            <Button type="button" variant="destructive" onClick={handleDeleteCategory} disabled={loading} className="rounded-xl">حذف</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryDialog;
