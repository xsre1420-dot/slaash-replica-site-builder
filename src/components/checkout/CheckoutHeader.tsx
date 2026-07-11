import { ShoppingBag } from "lucide-react";

import { RtlHeaderBar } from "@/components/layout/RtlHeaderBar";

import ProgressSteps from "@/components/checkout/ProgressSteps";

import { resolveMediaDeliveryUrl } from "@/utils/cdnMediaUtils";



interface CheckoutHeaderProps {

  cartCount: number;

  backTo?: string;

  storeName?: string;

  storeLogo?: string;

  currentStep?: number;

  showProgress?: boolean;

}



const CheckoutHeader = ({

  cartCount,

  backTo = "/preview",

  storeName = "",

  storeLogo = "",

  currentStep = 0,

  showProgress = false,

}: CheckoutHeaderProps) => {

  const logoUrl = storeLogo ? resolveMediaDeliveryUrl(storeLogo, { variant: "thumbnail" }) : "";



  return (

    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 font-arabic shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">

      <div className="w-full md:max-w-2xl md:mx-auto pt-2.5 px-4 sm:px-6 pb-1">

        <RtlHeaderBar

          title={

            <div className="flex flex-col items-center justify-center gap-0.5 min-w-0">

              <div className="flex items-center justify-center gap-2.5 min-w-0">

                {logoUrl ? (

                  <div className="relative shrink-0">

                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-[3px]" aria-hidden />

                    <img

                      src={logoUrl}

                      alt=""

                      className="relative h-9 w-9 rounded-full object-cover ring-2 ring-primary/25 shadow-sm"

                    />

                  </div>

                ) : (

                  <div className="icon-badge h-9 w-9 shadow-sm">

                    <ShoppingBag className="h-4 w-4" strokeWidth={2.35} />

                  </div>

                )}

                <span className="truncate text-sm font-bold text-gray-900 sm:text-base">

                  {storeName.trim() || "إتمام الطلب"}

                </span>

              </div>

              {storeName.trim() && (

                <span className="text-[10px] font-semibold text-gray-500">إتمام الطلب</span>

              )}

            </div>

          }

          titleClassName="font-bold"

          backTo={backTo}

          backLabel="العودة للمتجر"

          endSlot={

            <div className="relative icon-badge h-10 w-10 shadow-sm">

              <ShoppingBag className="h-[18px] w-[18px]" strokeWidth={2.35} />

              {cartCount > 0 && (

                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-md ring-2 ring-white">

                  {cartCount > 99 ? "99+" : cartCount}

                </span>

              )}

            </div>

          }

        />

      </div>

      {showProgress && <ProgressSteps currentStep={currentStep} />}

    </div>

  );

};



export default CheckoutHeader;

