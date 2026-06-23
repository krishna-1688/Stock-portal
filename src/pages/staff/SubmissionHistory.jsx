import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell'
import Spinner from '../../components/ui/Spinner'
import { getStaffSubmissionHistory } from '../../services/stockService'

export default function SubmissionHistory() {
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await getStaffSubmissionHistory()
        setHistory(data || [])
      } catch (e) {
        console.error('Error loading history:', e)
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  return (
    <PageShell>
      <div className="min-h-screen pb-20" style={{ background: '#f8fafc' }}>
        
        {/* Header */}
        <div className="bg-white sticky top-0 z-30 shadow-sm border-b border-gray-100">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/staff/agencies')}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-black text-gray-900 leading-tight">Submission History</h1>
              <p className="text-xs text-gray-500 font-medium">Your recent stock entries</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 pt-6">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 font-medium text-sm">No submissions found.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((record) => (
                <button 
                  key={record.id} 
                  onClick={() => navigate(`/staff/history/${record.id}`)}
                  className="w-full text-left bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all active:scale-95 flex items-center justify-between group"
                >
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[15px] font-bold text-gray-900">{record.agency_name}</p>
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded-md">
                        {new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span className="font-semibold">{record.total_items} items entered</span>
                    </div>
                  </div>
                  
                  {/* Arrow Icon indicating it is clickable */}
                  <div className="shrink-0 ml-4 w-8 h-8 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-brand-50 group-hover:text-brand-600 flex items-center justify-center transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}