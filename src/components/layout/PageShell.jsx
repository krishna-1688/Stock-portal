import BottomNav from './BottomNav'
export default function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <main>{children}</main>
      <BottomNav />
    </div>
  )
}
