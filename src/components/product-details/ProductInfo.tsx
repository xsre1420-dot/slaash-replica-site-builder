
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
        <span className="text-2xl font-bold text-primary">
          {price.toLocaleString()} د.ع
        </span>
        <h2 className="text-2xl font-bold text-right">{name}</h2>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg shadow-inner">
        <p className="text-gray-700 text-right leading-relaxed text-lg">{description}</p>
      </div>
    </div>
  );
};

export default ProductInfo;
