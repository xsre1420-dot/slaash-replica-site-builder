
import { X } from "lucide-react";
import { Link } from "react-router-dom";

const PreviewStore = () => {
  // This will be replaced with real data once we have backend integration
  const sampleProducts = [
    {
      id: 1,
      name: "نصف دجاجة مشوية",
      description: "دجاجة كاملة مشوية + مقبلات + خبز",
      category: "الوجبات السريعة",
      price: "IQD 6,000",
      image: "/lovable-uploads/59c215d6-809e-4764-90cd-41fd1213f286.png"
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white p-4 rounded-b-3xl">
        <div className="flex justify-between items-center mb-4">
          <Link to="/builder">
            <X className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-bold">دجاج العريش</h1>
          <div className="w-6" /> {/* Spacer for alignment */}
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <input
            type="search"
            placeholder="ابحث عن وجبة..."
            className="w-full p-2 pl-10 pr-4 rounded-full text-right text-gray-900"
          />
          <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex justify-end gap-2 p-4 overflow-x-auto">
        <button className="px-4 py-2 rounded-full bg-red-600 text-white">الكل</button>
        <button className="px-4 py-2 rounded-full bg-white text-gray-600">الوجبات السريعة</button>
        <button className="px-4 py-2 rounded-full bg-white text-gray-600">الوجبات الرئيسية</button>
        <button className="px-4 py-2 rounded-full bg-white text-gray-600">المقبلات</button>
      </div>

      {/* Products List */}
      <div className="p-4 space-y-4">
        {sampleProducts.map((product) => (
          <div key={product.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="flex flex-col items-end text-right flex-1">
                <h3 className="text-xl font-bold mb-1">{product.name}</h3>
                <p className="text-gray-600 text-sm mb-2">{product.description}</p>
                <span className="text-red-600 font-bold">{product.price}</span>
                <span className="inline-block px-3 py-1 bg-teal-100 text-teal-800 rounded-full text-sm mt-2">
                  {product.category}
                </span>
              </div>
              <img
                src={product.image}
                alt={product.name}
                className="w-24 h-24 rounded-lg object-cover ml-4"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Shopping Cart Button */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <button className="bg-red-600 text-white p-4 rounded-full shadow-lg relative">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="absolute -top-2 -right-2 bg-white text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            0
          </span>
        </button>
      </div>
    </div>
  );
};

export default PreviewStore;
