
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
    // Load categories (in a real app, this would come from an API)
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
    
    // Don't allow deleting the "all" category
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
    if (index <= 0) return; // Can't move up the first item
    
    const newCategories = [...categories];
    [newCategories[index], newCategories[index - 1]] = [
      newCategories[index - 1],
      newCategories[index],
    ];
    
    // Update order property
    newCategories.forEach((cat, idx) => {
      cat.order = idx;
    });
    
    setCategories(newCategories);
  };

  const handleMoveDown = (index: number) => {
    if (index >= categories.length - 1) return; // Can't move down the last item
    
    const newCategories = [...categories];
    [newCategories[index], newCategories[index + 1]] = [
      newCategories[index + 1],
      newCategories[index],
    ];
    
    // Update order property
    newCategories.forEach((cat, idx) => {
      cat.order = idx;
    });
    
    setCategories(newCategories);
  };

  return (
    <div className="min-h-screen bg-white font-arabic">
      {/* Header */}
      <div className="bg-slate-800 text-white p-4">
        <div className="flex justify-between items-center">
          <Link to="/builder">
            <X className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold">إدارة الأصناف</h1>
          <div className="w-6"></div> {/* Empty div for alignment */}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-xl mx-auto p-4">
        <div className="bg-white rounded-xl shadow-sm p-4 mt-4 border">
          <div className="flex justify-between items-center mb-4">
            <Button 
              className="bg-slate-800 hover:bg-slate-700 text-white"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="w-4 h-4 ml-1" />
              إضافة تصنيف جديد
            </Button>
            <h2 className="text-xl font-bold text-slate-800">الأصناف</h2>
          </div>

          <div className="space-y-2">
            {categories.map((category, index) => (
              <div 
                key={category.id}
                className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border"
              >
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeletingCategoryId(category.id);
                      setIsDeleteDialogOpen(true);
                    }}
                    disabled={category.id === "all"}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingCategory(category);
                      setIsEditDialogOpen(true);
                    }}
                    disabled={category.id === "all"}
                  >
                    <Edit className="w-4 h-4 text-slate-600" />
                  </Button>
                  
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveDown(index)}
                      disabled={index >= categories.length - 1}
                    >
                      <span>⬇️</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMoveUp(index)}
                      disabled={index <= 0}
                    >
                      <span>⬆️</span>
                    </Button>
                  </div>
                </div>
                
                <span className="font-medium text-slate-800">{category.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right bg-white">
          <DialogHeader>
            <DialogTitle className="text-right text-slate-800">إضافة تصنيف جديد</DialogTitle>
            <DialogDescription className="text-right text-slate-600">
              أدخل اسم التصنيف الجديد الذي سيظهر في القائمة
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="categoryName" className="block mb-1 text-slate-800">اسم التصنيف</Label>
            <Input
              id="categoryName"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              className="text-right bg-white border-gray-300 text-slate-800"
              autoFocus
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="border-gray-300 text-slate-800 hover:bg-gray-50">
              إلغاء
            </Button>
            <Button className="bg-slate-800 hover:bg-slate-700 text-white" onClick={handleAddCategory}>
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right bg-white">
          <DialogHeader>
            <DialogTitle className="text-right text-slate-800">تعديل التصنيف</DialogTitle>
            <DialogDescription className="text-right text-slate-600">
              قم بتغيير اسم التصنيف
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="editCategoryName" className="block mb-1 text-slate-800">اسم التصنيف</Label>
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
              className="text-right bg-white border-gray-300 text-slate-800"
              autoFocus
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-gray-300 text-slate-800 hover:bg-gray-50">
              إلغاء
            </Button>
            <Button className="bg-slate-800 hover:bg-slate-700 text-white" onClick={handleEditCategory}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right bg-white">
          <DialogHeader>
            <DialogTitle className="text-right text-slate-800">حذف التصنيف</DialogTitle>
            <DialogDescription className="text-right text-slate-600">
              هل أنت متأكد من رغبتك في حذف هذا التصنيف؟ هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-gray-300 text-slate-800 hover:bg-gray-50">
              إلغاء
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteCategory}
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
