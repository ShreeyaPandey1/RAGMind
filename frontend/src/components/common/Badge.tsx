import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'outline' | 'indigo';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const variantStyles = {
    default: 'bg-muted text-muted-foreground border-transparent',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    error: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    outline: 'border-border text-foreground bg-transparent',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium tracking-tight',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border transition-colors ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | string;
  className?: string;
}> = ({ status, className = '' }) => {
  const map: Record<string, { variant: 'default' | 'success' | 'warning' | 'error'; label: string }> = {
    READY: { variant: 'success', label: 'READY' },
    PROCESSING: { variant: 'warning', label: 'PROCESSING' },
    PENDING: { variant: 'default', label: 'PENDING' },
    FAILED: { variant: 'error', label: 'FAILED' },
  };
  const conf = map[status] || { variant: 'default', label: status };
  return (
    <Badge variant={conf.variant} size="sm" className={className}>
      {conf.label}
    </Badge>
  );
};
