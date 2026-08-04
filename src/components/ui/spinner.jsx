export default function Spinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-7 h-7 border-2', lg: 'w-10 h-10 border-2' }
  return <div className={`${sizes[size]} border-brand-600 border-t-transparent rounded-full animate-spin`} />
}
