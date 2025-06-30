
interface OrderTotalProps {
  total: number;
}

const OrderTotal = ({ total }: OrderTotalProps) => {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-3xl p-8 shadow-xl">
      <div className="flex justify-between items-center">
        <div className="text-right">
          <span className="text-3xl font-bold text-white">
            {total.toLocaleString()} د.ع
          </span>
          <p className="text-lg text-blue-100 mt-2 font-medium">المبلغ الإجمالي</p>
        </div>
        <div className="text-left">
          <span className="text-xl font-bold text-blue-100">المجموع الكلي:</span>
        </div>
      </div>
    </div>
  );
};

export default OrderTotal;
