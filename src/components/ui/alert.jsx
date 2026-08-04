export default function Alert({ type = 'error', message }) {
  if (!message) return null
  const styles = {
    error:   'bg-red-50 text-red-700 border border-red-100',
    success: 'bg-brand-50 text-brand-700 border border-brand-100',
    info:    'bg-blue-50 text-blue-700 border border-blue-100',
  }
  return <div className={`rounded-xl px-4 py-3 text-sm font-medium ${styles[type]}`}>{message}</div>
}
