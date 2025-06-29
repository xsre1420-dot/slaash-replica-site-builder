
import { X, Plus, Edit, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line } from "recharts";

const Categories = () => {
  // Start with empty categories array - manual addition only
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", id: "" });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("7"); // Last 7 days
  
  const { toast } = useToast();

  // Mock statistics data
  const visitorData = [
    { date: "اليوم", visitors: 45, orders: 12 },
    { date: "أمس", visitors: 38, orders: 8 },
    { date: "قبل يومين", visitors: 52, orders: 15 },
    { date: "قبل 3 أيام", visitors: 41, orders: 10 },
    { date: "قبل 4 أيام", visitors: 47, orders: 13 },
    { date: "قبل 5 أيام", visitors: 35, orders: 9 },
    { date: "قبل 6 أيام", visitors: 43, orders: 11 },
  ];

  const totalVisitors = visitorData.reduce((sum, day) => sum + day.visitors, 0);
  const totalOrders = visitorData.reduce((sum, day) => sum + day.orders, 0);

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
    
    setCategories(categories.filter((cat) => cat.id !== deletingCategoryId));
    setIsDeleteDialogOpen(false);
    setDeletingCategoryId(null);
    
    toast({
      title: "تم بنجاح",
      description: "تم حذف التصنيف",
    });
  };

  // New drag and drop style reordering
  const handleMoveUp = (id: string) => {
    const currentIndex = categories.findIndex(cat => cat.id === id);
    if (currentIndex <= 0) return;
    
    const newCategories = [...categories];
    [newCategories[currentIndex], newCategories[currentIndex - 1]] = [
      newCategories[currentIndex - 1],
      newCategories[currentIndex],
    ];
    
    newCategories.forEach((cat, idx) => {
      cat.order = idx;
    });
    
    setCategories(newCategories);
  };

  const handleMoveDown = (id: string) => {
    const currentIndex = categories.findIndex(cat => cat.id === id);
    if (currentIndex >= categories.length - 1) return;
    
    const newCategories = [...categories];
    [newCategories[currentIndex], newCategories[currentIndex + 1]] = [
      newCategories[currentIndex + 1],
      newCategories[currentIndex],
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
            <h1 className="text-2xl font-bold text-black">إدارة الأصناف</h1>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Statistics Cards */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-right text-lg text-black">إجمالي الزوار</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-right">
                  <div className="text-3xl font-bold text-black mb-1">{totalVisitors}</div>
                  <div className="text-sm text-gray-600">خلال آخر {dateFilter} أيام</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-right text-lg text-black">إجمالي الطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-right">
                  <div className="text-3xl font-bold text-black mb-1">{totalOrders}</div>
                  <div className="text-sm text-gray-600">خلال آخر {dateFilter} أيام</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-3xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-right text-lg text-black">فترة الإحصائيات</CardTitle>
              </CardHeader>
              <CardContent>
                <select 
                  value={dateFilter} 
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-xl text-right bg-white text-black"
                >
                  <option value="7">آخر 7 أيام</option>
                  <option value="30">آخر 30 يوم</option>
                  <option value="90">آخر 3 شهور</option>
                </select>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-lg rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right text-black">إحصائيات الزوار والطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    visitors: { label: "الزوار", color: "#3b82f6" },
                    orders: { label: "الطلبات", color: "#10b981" },
                  }}
                  className="h-[300px]"
                >
                  <BarChart data={visitorData}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="visitors" fill="#3b82f6" radius={8} />
                    <Bar dataKey="orders" fill="#10b981" radius={8} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-3xl">
              <CardHeader>
                <CardTitle className="text-right text-black">اتجاه الطلبات</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    orders: { label: "الطلبات", color: "#f59e0b" },
                  }}
                  className="h-[200px]"
                >
                  <LineChart data={visitorData}>
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={3} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Categories Management */}
        <div className="bg-white rounded-3xl shadow-lg p-8">
          <div className="flex justify-between items-center mb-8">
            <Button 
              className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-2xl px-8 py-3"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="w-5 h-5 ml-2" />
              إضافة تصنيف جديد
            </Button>
            <h2 className="text-2xl font-bold text-black">الأصناف</h2>
          </div>

          {categories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-4">لا توجد أصناف حالياً</div>
              <Button 
                className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white rounded-2xl px-6 py-2"
                onClick={() => setIsAddDialogOpen(true)}
              >
                إضافة تصنيف جديد
              </Button>
            </div>
          ) : (
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
                    
                    <div className="flex flex-col space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveUp(category.id)}
                        disabled={index <= 0}
                        className="hover:bg-gray-200 rounded-xl h-8 w-8 p-0"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMoveDown(category.id)}
                        disabled={index >= categories.length - 1}
                        className="hover:bg-gray-200 rounded-xl h-8 w-8 p-0"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
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
