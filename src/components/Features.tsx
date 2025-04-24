
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "AI-Powered Design",
    description: "Let our AI create stunning designs tailored to your brand",
  },
  {
    title: "No-Code Building",
    description: "Build your website visually, no coding knowledge required",
  },
  {
    title: "Fast Deployment",
    description: "Launch your website instantly with one click deployment",
  },
  {
    title: "SEO Optimized",
    description: "Built-in SEO tools to help your website rank higher",
  },
];

export const Features = () => {
  return (
    <div className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
          Everything You Need to <span className="text-gradient">Succeed</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="card-gradient border-0 shadow-lg hover:scale-105 transition-transform duration-300">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
