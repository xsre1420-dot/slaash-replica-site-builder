import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group z-[100]"
      closeButton={true}
      richColors={true}
      position="top-center"
      expand={true}
      visibleToasts={4}
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/60 group-[.toaster]:shadow-lg group-[.toaster]:rounded-2xl group-[.toaster]:font-arabic",
          title: "group-[.toast]:font-semibold group-[.toast]:text-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:font-medium",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:bg-muted/50 group-[.toast]:text-muted-foreground group-[.toast]:border-0 group-[.toast]:hover:bg-muted group-[.toast]:absolute group-[.toast]:left-2 group-[.toast]:top-2 group-[.toast]:rounded-lg group-[.toast]:p-1 group-[.toast]:h-6 group-[.toast]:w-6 group-[.toast]:flex group-[.toast]:items-center group-[.toast]:justify-center",
          success: "group-[.toast]:border-success/20",
          error: "group-[.toast]:border-destructive/20",
          warning: "group-[.toast]:border-warning/20",
          info: "group-[.toast]:border-primary/20",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
