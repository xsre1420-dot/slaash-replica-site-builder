interface FormSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

const FormSection = ({ icon, title, children }: FormSectionProps) => {
  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <div className="p-2 rounded-xl bg-primary/10 text-primary">{icon}</div>
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
};

export default FormSection;
