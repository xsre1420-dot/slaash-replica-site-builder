import { X, Plus, Edit, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { categories as initialCategories } from "@/data/dummyData";
import { Category } from "@/types";
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
import { useToast } from "@/components/ui/use-toast";

const Categories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", id: "" });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    setCategories([...initialCategories]);
  }, []);

  const handleAddCategory = () => {
    if (!newCategory.name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم للتصنيف",
        variant: "destructive",
      });
      return;
    }
    
    const categoryId = newCategory.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    
    const newCategoryObject: Category = {
      id: categoryId,
      name: newCategory.name.trim(),
      order: categories.length,
    };
    
    setCategories([...categories, newCategoryObject]);
    setNewCategory({ name: "", id: "" });
    setIsAddDialogOpen(false);
    
    toast({
      title: "تم بنجاح",
      description: "تمت إضافة التصنيف الجديد",
    });
  };

  const handleEditCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال اسم للتصنيف",
        variant: "destructive",
      });
      return;
    }
    
    setCategories(
      categories.map((cat) =>
        cat.id === editingCategory.id ? { ...editingCategory } : cat
      )
    );
    
    setIsEditDialogOpen(false);
    setEditingCategory(null);
    
    toast({
      title: "تم بنجاح",
      description: "تم تحديث التصنيف",
    });
  };

  const handleDeleteCategory = () => {
    if (!deletingCategoryId) return;
    
    if (deletingCategoryId === "all") {
      toast({
        title: "غير مسموح",
        description: "لا يمكن حذف تصنيف 'الكل'",
        variant: "destructive",
      });
      return;
    }
    
    setCategories(categories.filter((cat) => cat.id !== deletingCategoryId));
    setIsDeleteDialogOpen(false);
    setDeletingCategoryId(null);
    
    toast({
      title: "تم بنجاح",
      description: "تم حذف التصنيف",
    });
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    
    const newCategories = [...categories];
    [newCategories[index], newCategories[index - 1]] = [
      newCategories[index - 1],
      newCategories[index],
    ];
    
    newCategories.forEach((cat, idx) => {
      cat.order = idx;
    });
    
    setCategories(newCategories);
  };

  const handleMoveDown = (index: number) => {
    if (index >= categories.length - 1) return;
    
    const newCategories = [...categories];
    [newCategories[index], newCategories[index + 1]] = [
      newCategories[index + 1],
      newCategories[index],
    ];
    
    newCategories.forEach((cat, idx) => {
      cat.order = idx;
    });
    
    setCategories(newCategories);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-arabic">
      {/* Modern Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <Link to="/builder">
              <Button variant="ghost" className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">إدارة الأصناف</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8">
          <div className="flex justify-between items-center mb-8">
            <Button 
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-2xl px-8 py-3"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="w-5 h-5 ml-2" />
              إضافة تصنيف جديد
            </Button>
            <h2 className="text-2xl font-bold text-gray-800">الأصناف</h2>
          </div>

          <div className="space-y-4">
            {categories.map((category, index) => (
              <div 
                key={category.id}
                className="flex justify-between items-center p-6 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeletingCategoryId(category.id);
                      setIsDeleteDialogOpen(true);
                    }}
                    disabled={category.id === "all"}
                    className="hover:bg-red-100 hover:text-red-600 rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingCategory(category);
                      setIsEditDialogOpen(true);
                    }}
                    disabled={category.id === "all"}
                    className="hover:bg-blue-100 hover:text-blue-600 rounded-xl"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveDown(index)}
                      disabled={index >= categories.length - 1}
                      className="hover:bg-gray-200 rounded-xl"
                    >
                      ⬇️
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveUp(index)}
                      disabled={index <= 0}
                      className="hover:bg-gray-200 rounded-xl"
                    >
                      ⬆️
                    </Button>
                  </div>
                </div>
                
                <span className="font-medium text-lg text-gray-800">{category.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modern Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">إضافة تصنيف جديد</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              أدخل اسم التصنيف الجديد الذي سيظهر في القائمة
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="categoryName" className="block mb-2 text-gray-700">اسم التصنيف</Label>
            <Input
              id="categoryName"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              className="text-right rounded-2xl"
              autoFocus
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-2xl">
              إلغاء
            </Button>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-2xl" 
              onClick={handleAddCategory}
            >
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modern Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">تعديل التصنيف</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              قم بتغيير اسم التصنيف
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="editCategoryName" className="block mb-2 text-gray-700">اسم التصنيف</Label>
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
              className="text-right rounded-2xl"
              autoFocus
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-2xl">
              إلغاء
            </Button>
            <Button 
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-2xl" 
              onClick={handleEditCategory}
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modern Delete Category Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl">حذف التصنيف</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              هل أنت متأكد من رغبتك في حذف هذا التصنيف؟ هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-2xl">
              إلغاء
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteCategory}
              className="rounded-2xl"
            >
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Categories;
