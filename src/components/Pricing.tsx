
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const plans = [
  {
    name: "Starter",
    price: "$0",
    description: "Perfect for testing the waters",
    features: ["1 Website", "Basic Analytics", "Community Support"],
  },
  {
    name: "Pro",
    price: "$29",
    description: "Best for professionals",
    features: ["Unlimited Websites", "Advanced Analytics", "Priority Support", "Custom Domain"],
  },
];

export const Pricing = () => {
  return (
    <div className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Simple, <span className="text-gradient">Transparent</span> Pricing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <Card key={plan.name} className="card-gradient border-0 shadow-lg">
              <CardHeader className="text-center">
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <div className="text-4xl font-bold my-4">{plan.price}</div>
                <p className="text-gray-600">{plan.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.name === "Pro" ? "default" : "outline"}>
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
