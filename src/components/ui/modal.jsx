import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
        {title && (
          <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
        )}
        {children}
      </div>
    </div>
  )
}