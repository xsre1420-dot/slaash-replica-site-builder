
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductsList } from '@/components/ProductsList';

const PreviewStore = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-red-600 text-white p-4 flex justify-between items-center">
        <Link to="/builder">
          <Button variant="ghost" className="text-white hover:bg-red-500">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">معاينة المتجر</h1>
        <div className="w-10" /> {/* Spacer for alignment */}
      </div>

      {/* Store Content */}
      <div className="max-w-xl mx-auto p-4">
        <ProductsList />
      </div>
    </div>
  );
};

export default PreviewStore;
