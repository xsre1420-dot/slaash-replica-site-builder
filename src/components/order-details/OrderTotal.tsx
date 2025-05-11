
interface OrderTotalProps {
  total: number;
}

const OrderTotal = ({ total }: OrderTotalProps) => {
  return (
    <div className="border-t pt-3">
      <div className="flex justify-between items-center text-lg">
        <span className="font-bold">{total.toLocaleString()} د.ع</span>
        <span className="font-bold">المجموع الكلي:</span>
      </div>
    </div>
  );
};

export default OrderTotal;
