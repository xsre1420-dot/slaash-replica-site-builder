import { ShoppingBag, ClipboardList, CircleCheckBig, Check } from "lucide-react";

import { cn } from "@/lib/utils";



interface ProgressStepsProps {

  /** Active step: 0=cart, 1=details, 2=ready to confirm */

  currentStep: number;

}



const steps = [

  { icon: ShoppingBag, label: "السلة" },

  { icon: ClipboardList, label: "البيانات" },

  { icon: CircleCheckBig, label: "تأكيد" },

] as const;



const ProgressSteps = ({ currentStep }: ProgressStepsProps) => (

  <div

    className="w-full px-4 sm:px-6 pb-3 md:max-w-2xl md:mx-auto"

    dir="rtl"

    aria-label="مراحل إتمام الطلب"

  >

    <div className="flex w-full items-center">

      {steps.map((step, index) => {

        const Icon = step.icon;

        const isCompleted = index < currentStep;

        const isCurrent = index === currentStep;



        return (

          <div key={step.label} className="contents">

            <div className="flex min-w-[3.75rem] shrink-0 flex-col items-center gap-1.5">

              <div

                className={cn(

                  "relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300",

                  isCompleted &&

                    "bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.45)]",

                  isCurrent &&

                    !isCompleted &&

                    "bg-primary/12 text-primary ring-2 ring-primary/40 shadow-sm",

                  !isCompleted &&

                    !isCurrent &&

                    "bg-gray-100 text-gray-400 border border-gray-200/80"

                )}

              >

                {isCompleted ? (

                  <Check className="h-4 w-4" strokeWidth={2.75} />

                ) : (

                  <Icon className="h-4 w-4" strokeWidth={2.35} />

                )}

                {isCurrent && !isCompleted && (

                  <span

                    className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"

                    aria-hidden

                  />

                )}

              </div>

              <span

                className={cn(

                  "text-[10px] font-bold leading-none whitespace-nowrap",

                  isCurrent ? "text-primary" : isCompleted ? "text-gray-800" : "text-gray-400"

                )}

              >

                {step.label}

              </span>

            </div>



            {index < steps.length - 1 && (

              <div

                className={cn(

                  "mx-2 mb-5 h-[2px] flex-1 rounded-full transition-colors duration-300",

                  index < currentStep ? "bg-primary/70" : "bg-gray-200"

                )}

                aria-hidden

              />

            )}

          </div>

        );

      })}

    </div>

  </div>

);



export default ProgressSteps;

