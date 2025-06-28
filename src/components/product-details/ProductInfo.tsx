
interface ProductInfoProps {
  name: string;
  price: number;
  description: string;
  category: string;
  sizes?: string[];
  colors?: string[];
}

const ProductInfo = ({ name, price, description, category, sizes, colors }: ProductInfoProps) => {
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

      {/* Sizes Section */}
      {sizes && sizes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-right text-gray-800">القياسات المتاحة:</h3>
          <div className="flex flex-wrap gap-2 justify-end">
            {sizes.map((size, index) => (
              <span
                key={index}
                className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium"
              >
                {size}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Colors Section */}
      {colors && colors.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-right text-gray-800">الألوان المتاحة:</h3>
          <div className="flex flex-wrap gap-2 justify-end">
            {colors.map((color, index) => (
              <span
                key={index}
                className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-sm font-medium"
              >
                {color}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductInfo;
