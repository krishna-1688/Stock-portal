import Spinner from './spinner'

export default function Button({ children, onClick, type = 'button', variant = 'primary', loading = false, disabled = false, fullWidth = false, size = 'md' }) {
  const base = 'inline-flex items-center justify-center font-medium rounded-xl transition-all focus:outline-none active:scale-[0.98]'
  const variants = {
    primary:   'bg-brand-600 hover:bg-brand-700 text-white',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    danger:    'bg-red-500 hover:bg-red-600 text-white',
    ghost:     'bg-transparent hover:bg-slate-100 text-slate-600',
  }
  const sizes = { sm: 'px-3 py-2 text-sm', md: 'px-5 py-3 text-sm', lg: 'px-6 py-3.5 text-base' }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {loading ? <Spinner size="sm" /> : children}
    </button>
  )
}
