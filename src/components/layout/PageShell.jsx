import Navbar from './Navbar'
import BottomNav from './BottomNav'

export default function PageShell({ title, children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title={title} />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}