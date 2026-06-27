import type { ComponentType, ReactNode } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  authHintClass,
  authInputClass,
  authInputWithIconClass,
  authLabelClass,
  authPasswordInputClass,
  authToggleButtonClass,
} from './authFormStyles';

interface AuthFieldProps {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
}

export const AuthField = ({ id, label, children, hint }: AuthFieldProps) => (
  <div>
    <label htmlFor={id} className={authLabelClass}>
      {label}
    </label>
    {children}
    {hint && <p className={authHintClass}>{hint}</p>}
  </div>
);

interface AuthEmailFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}

export const AuthEmailField = ({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder = 'name@example.com',
  required,
}: AuthEmailFieldProps) => (
  <AuthField id={id} label={label}>
    <div className="relative">
      <Input
        id={id}
        type="email"
        autoComplete="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={authInputWithIconClass}
        dir="ltr"
        disabled={disabled}
        required={required}
      />
      <Mail
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  </AuthField>
);

interface AuthTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
  dir?: 'ltr' | 'rtl';
  icon?: ComponentType<{ className?: string }>;
  hint?: string;
  required?: boolean;
}

export const AuthTextField = ({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  autoComplete,
  dir = 'rtl',
  icon: Icon,
  hint,
  required,
}: AuthTextFieldProps) => (
  <AuthField id={id} label={label} hint={hint}>
    <div className="relative">
      <Input
        id={id}
        type="text"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={Icon ? authInputWithIconClass : authInputClass}
        dir={dir}
        disabled={disabled}
        required={required}
      />
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      )}
    </div>
  </AuthField>
);

interface AuthPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  disabled?: boolean;
  hint?: string;
  match?: boolean;
  strength?: number;
  strengthLabel?: string;
  strengthColor?: string;
  autoComplete?: string;
}

export const AuthPasswordField = ({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  disabled,
  hint,
  match,
  strength,
  strengthLabel,
  strengthColor,
  autoComplete = 'new-password',
}: AuthPasswordFieldProps) => (
  <div>
    <label htmlFor={id} className={authLabelClass}>
      {label}
    </label>
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          authPasswordInputClass,
          match === false && 'border-destructive focus-visible:ring-destructive/15 focus-visible:border-destructive',
          match === true && 'border-primary/40 focus-visible:ring-primary/15'
        )}
        disabled={disabled}
        minLength={8}
        required
      />
      <button
        type="button"
        onClick={onToggle}
        className={authToggleButtonClass}
        aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
        aria-pressed={show}
      >
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
    {hint && <p className={authHintClass}>{hint}</p>}
    {strength !== undefined && value && strengthLabel && strengthColor && (
      <div className="mt-2 space-y-1.5">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn('h-1 flex-1 rounded-full', i <= strength ? strengthColor : 'bg-border')}
            />
          ))}
        </div>
        <p className={authHintClass}>قوة كلمة المرور: {strengthLabel}</p>
      </div>
    )}
    {match === false && (
      <p className="text-xs text-destructive mt-1.5 text-right">كلمات المرور غير متطابقة</p>
    )}
  </div>
);

export const AuthPageHeader = ({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
}) => (
  <div className="mb-8 text-center sm:text-right">
    <h1 className="text-2xl sm:text-[1.625rem] font-semibold tracking-tight text-foreground">
      {title}
    </h1>
    {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
    {meta}
  </div>
);
