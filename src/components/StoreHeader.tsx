
interface StoreHeaderProps {
  storeLogo: string;
  storeName: string;
  onUpdateStore: (logo: string, name: string) => void;
}

const StoreHeader = ({ storeLogo, storeName, onUpdateStore }: StoreHeaderProps) => {

  return (
    <div className="bg-white text-gray-800 py-3 px-4 flex justify-between items-center border-b border-gray-100">
      <div className="flex items-center gap-3">
      </div>
      
      <div className="flex items-center gap-3">
        {storeLogo && (
          <img src={storeLogo} alt={storeName} className="w-8 h-8 rounded-full object-cover" />
        )}
      </div>
    </div>
  );
};

export default StoreHeader;
