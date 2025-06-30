
interface OrderTotalProps {
  total: number;
}

const OrderTotal = ({ total }: OrderTotalProps) => {
  return (
    <div className="bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl p-6 mt-6 border border-blue-200">
      <div className="flex justify-between items-center">
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-blue-600">د.ع</span>
            <span className="text-3xl font-bold text-blue-900">
              {total.toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-blue-600 mt-2">المبلغ الإجمالي</p>
        </div>
        <div className="text-left">
          <span className="text-lg font-semibold text-blue-800">المجموع الكلي:</span>
        </div>
      </div>
    </div>
  );
};

export default OrderTotal;
