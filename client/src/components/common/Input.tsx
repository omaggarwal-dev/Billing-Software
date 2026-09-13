import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  variant?: "light" | "dark";
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  variant = "light",
  className = "",
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  const themeClasses =
    variant === "dark"
      ? error
        ? "border-rose-500 text-rose-200 placeholder-rose-400/50 bg-slate-800 focus:ring-rose-500 focus:border-rose-500"
        : "border-slate-700 text-slate-100 placeholder-slate-500 bg-slate-800/90 focus:border-indigo-500 focus:ring-indigo-500"
      : error
      ? "border-rose-400 text-rose-900 placeholder-rose-300 bg-white focus:ring-rose-500 focus:border-rose-500"
      : "border-gray-300 text-gray-900 placeholder-gray-400 bg-white focus:border-indigo-500 focus:ring-indigo-500";

  const labelColor = variant === "dark" ? "text-slate-300" : "text-gray-700";

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-xs font-semibold ${labelColor} uppercase tracking-wider mb-1`}
        >
          {label}
        </label>
      )}
      <div className="relative rounded-lg shadow-sm">
        {leftIcon && (
          <div
            className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none ${
              variant === "dark" ? "text-slate-400" : "text-gray-400"
            }`}
          >
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`block w-full rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 ${
            leftIcon ? "pl-9" : "pl-3"
          } ${rightIcon ? "pr-9" : "pr-3"} py-2.5 ${themeClasses} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div
            className={`absolute inset-y-0 right-0 pr-3 flex items-center ${
              variant === "dark" ? "text-slate-400" : "text-gray-400"
            }`}
          >
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>}
      {helperText && !error && (
        <p className={`mt-1 text-xs ${variant === "dark" ? "text-slate-400" : "text-gray-500"}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};
