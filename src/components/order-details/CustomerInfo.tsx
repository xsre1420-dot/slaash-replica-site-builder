
import { CustomerInfo as CustomerInfoType } from "@/types";

interface CustomerInfoProps {
  customerInfo: CustomerInfoType;
}

const CustomerInfo = ({ customerInfo }: CustomerInfoProps) => {
  return (
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
      {customerInfo.governorate && (
        <div className="flex justify-between">
          <span>{customerInfo.governorate}</span>
          <span className="font-medium">المحافظة:</span>
        </div>
      )}
      {customerInfo.notes && (
        <div className="flex justify-between">
          <span>{customerInfo.notes}</span>
          <span className="font-medium">ملاحظات:</span>
        </div>
      )}
    </div>
  );
};

export default CustomerInfo;
