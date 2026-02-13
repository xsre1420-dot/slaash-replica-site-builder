import { useState } from "react";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
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
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم للفئة",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    const newCategoryObject: Category = {
      id: crypto.randomUUID(),
      name: newCategory.name.trim(),
      order: categories.length,
    };
    
    // Try Supabase first, fallback to local
    const result = await addCategory(newCategoryObject);
    
    if (result.success) {
      onCategoryChange();
      setNewCategory({ name: "" });
      setIsAddDialogOpen(false);
      toast({ title: "تم بنجاح", description: "تمت إضافة الفئة الجديدة" });
      setTimeout(() => onCategoryChange(), 500);
    } else if (onAddLocalCategory) {
      // Fallback: add locally
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
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم للفئة",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    const result = await updateCategory(editingCategory.id, editingCategory);
    
    if (result.success) {
      onCategoryChange();
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      
      toast({
        title: "تم بنجاح",
        description: "تم تحديث الفئة",
      });
    } else {
      toast({
        title: "خطأ",
        description: result.error || "فشل في تحديث الفئة",
        variant: "destructive",
      });
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
      
      toast({
        title: "تم بنجاح",
        description: "تم حذف الفئة",
      });
    } else {
      toast({
        title: "خطأ",
        description: result.error || "فشل في حذف الفئة",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  return (
    <>
      {/* Main Category Management Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] text-right rounded-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-black">إدارة الفئات</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              إضافة وتعديل وحذف فئات المنتجات
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Add New Category Button */}
            <div className="flex justify-center">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setIsAddDialogOpen(true)}
                className="text-blue-600 border-blue-200 hover:bg-blue-50 rounded-2xl px-6"
              >
                <Plus className="w-4 h-4 ml-2" />
                إضافة فئة جديدة
              </Button>
            </div>

            {/* Existing Categories List */}
            {categories.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-right block text-black font-medium">الفئات الموجودة</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {categories.map((category) => (
                    <div 
                      key={category.id}
                      className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100"
                    >
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingCategory(category);
                            setIsDeleteDialogOpen(true);
                          }}
                          className="hover:bg-red-100 hover:text-red-600 rounded-lg p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingCategory(category);
                            setIsEditDialogOpen(true);
                          }}
                          className="hover:bg-blue-100 hover:text-blue-600 rounded-lg p-1"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <span className="font-medium text-black">{category.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                لا توجد فئات. أضف فئة جديدة للبدء.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-black">إضافة فئة جديدة</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              أدخل اسم الفئة الجديدة التي ستظهر في القائمة
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="categoryName" className="block mb-2 text-black">اسم الفئة</Label>
            <Input
              id="categoryName"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ name: e.target.value })}
              className="text-right rounded-2xl text-black"
              autoFocus
            />
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsAddDialogOpen(false);
                setNewCategory({ name: "" });
              }} 
              className="rounded-2xl"
            >
              إلغاء
            </Button>
            <Button 
              className="text-white rounded-2xl border-0"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
              }}
              onClick={handleAddCategory}
              disabled={loading}
            >
              {loading ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-black">تعديل الفئة</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              قم بتغيير اسم الفئة
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="editCategoryName" className="block mb-2 text-black">اسم الفئة</Label>
            <Input
              id="editCategoryName"
              value={editingCategory?.name || ""}
              onChange={(e) => 
                setEditingCategory(
                  editingCategory 
                    ? { ...editingCategory, name: e.target.value }
                    : null
                )
              }
              className="text-right rounded-2xl text-black"
              autoFocus
            />
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingCategory(null);
              }} 
              className="rounded-2xl"
            >
              إلغاء
            </Button>
            <Button 
              className="text-white rounded-2xl border-0"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
              }}
              onClick={handleEditCategory}
              disabled={loading}
            >
              {loading ? "جاري التحديث..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-black">حذف الفئة</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              هل أنت متأكد من رغبتك في حذف فئة "{deletingCategory?.name}"؟ 
              هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingCategory(null);
              }} 
              className="rounded-2xl"
            >
              إلغاء
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteCategory}
              className="rounded-2xl"
              disabled={loading}
            >
              {loading ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CategoryDialog;
