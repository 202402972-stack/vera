import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

export function Toaster() {
  const { t } = useLanguage();
  const { toasts } = useToast();

  return (
    <ToastProvider label={t("Notification")}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{t(title)}</ToastTitle>}
              {description && (
                <ToastDescription>
                  {typeof description === "string"
                    ? t(description)
                    : description}
                </ToastDescription>
              )}
            </div>
            {action}
            <ToastClose aria-label={t("Close")} />
          </Toast>
        );
      })}
      <ToastViewport label={t("Notifications ({hotkey})")} />
    </ToastProvider>
  );
}
