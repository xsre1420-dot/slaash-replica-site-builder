
import { X, Plus, Edit, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
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
    // Load categories from localStorage
    const savedCategories = localStorage.getItem('categories');
    if (savedCategories) {
      try {
        setCategories(JSON.parse(savedCategories));
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    }
  }, []);

  const saveCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
    localStorage.setItem('categories', JSON.stringify(newCategories));
  };

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
    
    const updatedCategories = [...categories, newCategoryObject];
    saveCategories(updatedCategories);
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
    
    const updatedCategories = categories.map((cat) =>
      cat.id === editingCategory.id ? { ...editingCategory } : cat
    );
    
    saveCategories(updatedCategories);
    setIsEditDialogOpen(false);
    setEditingCategory(null);
    
    toast({
      title: "تم بنجاح",
      description: "تم تحديث التصنيف",
    });
  };

  const handleDeleteCategory = () => {
    if (!deletingCategoryId) return;
    
    const updatedCategories = categories.filter((cat) => cat.id !== deletingCategoryId);
    saveCategories(updatedCategories);
    setIsDeleteDialogOpen(false);
    setDeletingCategoryId(null);
    
    toast({
      title: "تم بنجاح",
      description: "تم حذف التصنيف",
    });
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
            <h1 className="text-2xl font-bold text-black">إدارة الأصناف</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-sm p-8">
          <div className="flex justify-between items-center mb-8">
            <Button 
              className="text-white rounded-2xl px-8 py-3 border-0 shadow-lg"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
              }}
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="w-5 h-5 ml-2" />
              إضافة تصنيف جديد
            </Button>
            <h2 className="text-2xl font-bold text-black">الأصناف</h2>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <div className="text-4xl">📋</div>
              </div>
              <h3 className="text-xl font-bold text-black mb-2">لا توجد أصناف بعد</h3>
              <p className="text-gray-500 mb-6">ابدأ بإضافة أول تصنيف لمنتجاتك</p>
              <Button 
                className="text-white rounded-2xl px-8 py-3 border-0 shadow-lg"
                style={{ 
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)'
                }}
                onClick={() => setIsAddDialogOpen(true)}
              >
                <Plus className="w-5 h-5 ml-2" />
                إضافة أول تصنيف
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {categories.map((category) => (
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
                      className="hover:bg-blue-100 hover:text-blue-600 rounded-xl"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <span className="font-medium text-lg text-black">{category.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modern Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px] text-right rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-right text-xl text-black">إضافة تصنيف جديد</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              أدخل اسم التصنيف الجديد الذي سيظهر في القائمة
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="categoryName" className="block mb-2 text-black">اسم التصنيف</Label>
            <Input
              id="categoryName"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              className="text-right rounded-2xl text-black"
              autoFocus
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="rounded-2xl">
              إلغاء
            </Button>
            <Button 
              className="text-white rounded-2xl border-0"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
              }}
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
            <DialogTitle className="text-right text-xl text-black">تعديل التصنيف</DialogTitle>
            <DialogDescription className="text-right text-gray-600">
              قم بتغيير اسم التصنيف
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="editCategoryName" className="block mb-2 text-black">اسم التصنيف</Label>
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
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="rounded-2xl">
              إلغاء
            </Button>
            <Button 
              className="text-white rounded-2xl border-0"
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)'
              }}
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
            <DialogTitle className="text-right text-xl text-black">حذف التصنيف</DialogTitle>
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
