
interface OrderTotalProps {
  total: number;
}

const OrderTotal = ({ total }: OrderTotalProps) => {
  return (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-6 mt-6">
      <div className="flex justify-between items-center">
        <div className="text-right">
          <span className="text-2xl font-bold text-blue-900">
            {total.toLocaleString()} د.ع
          </span>
          <p className="text-sm text-blue-600 mt-1">المبلغ الإجمالي</p>
        </div>
        <div className="text-left">
          <span className="text-lg font-semibold text-blue-800">المجموع الكلي:</span>
        </div>
      </div>
    </div>
  );
};

export default OrderTotal;
