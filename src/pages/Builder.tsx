
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Builder = () => {
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">Create Your Store</h1>
          <p className="text-gray-600">Build your online store with our easy-to-use website builder</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="storeName">Store Name</Label>
            <Input 
              id="storeName" 
              placeholder="Enter your store name"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Store Description</Label>
            <Input 
              id="description" 
              placeholder="Describe your store"
              className="w-full"
            />
          </div>

          <Button className="w-full">
            Create Store
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Builder;
