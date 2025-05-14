
interface ProductInfoProps {
  name: string;
  price: number;
  description: string;
  category: string;
}

const ProductInfo = ({ name, price, description, category }: ProductInfoProps) => {
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-start">
        <span className="text-2xl font-bold text-red-600">
          {price.toLocaleString()} د.ع
        </span>
        <h2 className="text-2xl font-bold text-right">{name}</h2>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg shadow-inner">
        <p className="text-gray-700 text-right leading-relaxed text-lg">{description}</p>
      </div>

      <div className="text-right">
        <span className="inline-block bg-gray-100 text-gray-600 text-sm px-3 py-1 rounded-full">
          {category}
        </span>
      </div>
    </div>
  );
};

export default ProductInfo;
