import Spinner from './Spinner'

export default function Button({
  children, onClick, type = 'button', variant = 'primary',
  loading = false, disabled = false, fullWidth = false, size = 'md'
}) {
  const base = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2'

  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white focus:ring-brand-500',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 focus:ring-gray-400',
    danger: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400',
    ghost: 'bg-transparent hover:bg-gray-100 text-gray-600 focus:ring-gray-300'
  }

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-5 py-3 text-base',
    lg: 'px-6 py-4 text-lg'
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${base} ${variants[variant]} ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {loading ? <Spinner size="sm" /> : children}
    </button>
  )
}