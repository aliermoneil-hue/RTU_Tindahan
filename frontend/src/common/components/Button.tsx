   import type { ButtonHTMLAttributes } from 'react'

   interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
     variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'yellow'
     size?: 'sm' | 'md' | 'lg'
     isLoading?: boolean
   }

   const variantClasses: Record<string, string> = {
     primary: 'bg-blue-600 text-white hover:bg-blue-700',
     secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
     outline: 'border border-slate-300 bg-transparent hover:bg-slate-50',
     ghost: 'text-slate-600 hover:bg-slate-100',
     yellow: 'bg-[#f4b63a] text-[#3a2a00] hover:bg-[#ffcb80]',
   }

   const sizeClasses: Record<string, string> = {
     sm: 'px-3 py-1.5 text-sm',
     md: 'px-4 py-2 text-base',
     lg: 'px-6 py-3 text-lg',
   }

   export function Button({
     children,
     className = '',
     variant = 'primary',
     size = 'md',
     isLoading = false,
     disabled,
     ...props
   }: ButtonProps) {
     return (
       <button
         className={[
           'inline-flex items-center justify-center rounded-md font-medium transition-colors',
           variantClasses[variant],
           sizeClasses[size],
           isLoading || disabled ? 'opacity-60 cursor-not-allowed' : '',
           className,
         ].join(' ').trim()}
         disabled={disabled || isLoading}
         {...props}
       >
         {isLoading && <span className="mr-2">Loading...</span>}
         {children}
       </button>
     )
   }