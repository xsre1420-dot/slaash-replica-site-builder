
import { CustomerInfo as CustomerInfoType } from "@/types";

interface CustomerInfoProps {
  customerInfo: CustomerInfoType;
}

const CustomerInfo = ({ customerInfo }: CustomerInfoProps) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-2 text-right">معلومات العميل</h3>
      <div className="space-y-2 text-right">
        <div className="flex justify-between">
          <span>{customerInfo.name}</span>
          <span className="font-medium">الاسم:</span>
        </div>
        <div className="flex justify-between">
          <span dir="ltr">{customerInfo.phone}</span>
          <span className="font-medium">رقم الهاتف:</span>
        </div>
        <div className="flex justify-between">
          <span>{customerInfo.address}</span>
          <span className="font-medium">العنوان:</span>
        </div>
        {customerInfo.notes && (
          <div className="flex justify-between">
            <span>{customerInfo.notes}</span>
            <span className="font-medium">ملاحظات:</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerInfo;
