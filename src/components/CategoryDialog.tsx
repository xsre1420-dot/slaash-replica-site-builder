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
import { addCategory, updateCategory, deleteCategory } from "@/data/dummyData";

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
    const newCategoryObject: Category = { id: crypto.randomUUID(), name: newCategory.name.trim(), order: categories.length };
    const result = await addCategory(newCategoryObject);
    if (result.success) {
      onCategoryChange();
      setNewCategory({ name: "" });
      setIsAddDialogOpen(false);
      toast({ title: "تم بنجاح", description: "تمت إضافة الفئة الجديدة" });
      setTimeout(() => onCategoryChange(), 500);
    } else if (onAddLocalCategory) {
      onAddLocalCategory(newCategoryObject);
      setNewCategory({ name: "" });
      setIsAddDialogOpen(false);
      toast({ title: "تم بنجاح", description: "تمت إضافة الفئة الجديدة" });
    } else {
      toast({ title: "خطأ", description: "فشل في إضافة الفئة", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleEditCategory = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({ title: "خطأ", description: "يرجى إدخال اسم للفئة", variant: "destructive" });
      return;
    }
    setLoading(true);
    const result = await updateCategory(editingCategory.id, editingCategory);
    if (result.success) {
      onCategoryChange();
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      toast({ title: "تم بنجاح", description: "تم تحديث الفئة" });
    } else {
      toast({ title: "خطأ", description: result.error || "فشل في تحديث الفئة", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setLoading(true);
    const result = await deleteCategory(deletingCategory.id);
    if (result.success) {
      onCategoryChange();
      setIsDeleteDialogOpen(false);
      setDeletingCategory(null);
      toast({ title: "تم بنجاح", description: "تم حذف الفئة" });
    } else {
      toast({ title: "خطأ", description: result.error || "فشل في حذف الفئة", variant: "destructive" });
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
                        <Button type="button" variant="ghost" size="sm"
                          onClick={() => { setDeletingCategory(category); setIsDeleteDialogOpen(true); }}
                          className="hover:bg-destructive/10 hover:text-destructive rounded-lg p-1 h-8 w-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm"
                          onClick={() => { setEditingCategory(category); setIsEditDialogOpen(true); }}
                          className="hover:bg-accent rounded-lg p-1 h-8 w-8"
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
              <div className="text-center py-8 text-muted-foreground">لا توجد فئات. أضف فئة جديدة للبدء.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-foreground">إضافة فئة جديدة</DialogTitle>
            <DialogDescription className="text-right text-muted-foreground">أدخل اسم الفئة الجديدة</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="categoryName" className="block mb-2 text-foreground">اسم الفئة</Label>
            <Input id="categoryName" value={newCategory.name} onChange={(e) => setNewCategory({ name: e.target.value })} className="text-right rounded-xl" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); setNewCategory({ name: "" }); }} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleAddCategory} disabled={loading} className="rounded-xl">
              {loading ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-foreground">تعديل الفئة</DialogTitle>
            <DialogDescription className="text-right text-muted-foreground">قم بتغيير اسم الفئة</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="editCategoryName" className="block mb-2 text-foreground">اسم الفئة</Label>
            <Input id="editCategoryName" value={editingCategory?.name || ""}
              onChange={(e) => setEditingCategory(editingCategory ? { ...editingCategory, name: e.target.value } : null)}
              className="text-right rounded-xl" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setEditingCategory(null); }} className="rounded-xl">إلغاء</Button>
            <Button onClick={handleEditCategory} disabled={loading} className="rounded-xl">
              {loading ? "جاري التحديث..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-foreground">حذف الفئة</DialogTitle>
            <DialogDescription className="text-right text-muted-foreground">
              هل أنت متأكد من رغبتك في حذف فئة "{deletingCategory?.name}"؟ هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setDeletingCategory(null); }} className="rounded-xl">إلغاء</Button>
            <Button variant="destructive" onClick={handleDeleteCategory} disabled={loading} className="rounded-xl">
              {loading ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryDialog;
