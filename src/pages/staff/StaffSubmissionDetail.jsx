import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getStaffSubmissionDetail } from '../../services/stockService'
import Spinner from '../../components/ui/Spinner'

export default function StaffSubmissionDetail() {
  const { submissionId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // 👇 DIAGNOSTIC LOG 1: Check what ID we are grabbing from the URL
    console.log("1. URL submissionId is:", submissionId);
    console.log("2. Type of submissionId:", typeof submissionId);

    getStaffSubmissionDetail(submissionId)
      .then(data => {
        // 👇 DIAGNOSTIC LOG 2: Check what the database actually returned
        console.log("3. Database returned data:", data);

        if (!data || data.length === 0) {
          setError('Submission not found.')
          return
        }
        setDetail({
          agency_name: data[0].agency_name,
          submitted_by_name: data[0].submitted_by_name,
          submitted_at: data[0].submitted_at,
          items: data.map(row => ({
            product_name: row.product_name,
            quantity: row.quantity,
          }))
        })
      })
      .catch(e => {
        // 👇 DIAGNOSTIC LOG 3: Check the exact error if it fails
        console.error("🚨 API Error:", e);
        setError(e.message)
      })
      .finally(() => setLoading(false))
  }, [submissionId])

  const dateStr = detail?.submitted_at
    ? new Date(detail.submitted_at).toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      })
    : ''
  const timeStr = detail?.submitted_at
    ? new Date(detail.submitted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : ''

  const totalQty = detail?.items?.reduce((sum, i) => sum + (i.quantity ?? 0), 0) ?? 0

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <p className="text-sm font-black text-gray-900 leading-none">Submission Detail</p>
            <p className="text-xs text-gray-400 leading-none mt-0.5">{detail?.agency_name ?? '...'}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-16 pt-5">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 gap-3">
            <div className="w-14 h-14 rounded-3xl bg-red-50 flex items-center justify-center text-3xl">⚠️</div>
            <p className="text-red-500 font-medium text-sm">{error}</p>
            <button
              onClick={() => navigate(-1)}
              className="mt-2 px-5 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-bold"
            >
              Go Back
            </button>
          </div>
        ) : (
          <>
            {/* Meta Card */}
            <div
              className="relative overflow-hidden rounded-[24px] p-5 mb-5 shadow-lg"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)' }}
            >
              <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/10" />
              <div className="absolute right-4 -bottom-6 w-20 h-20 rounded-full bg-white/5" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-xl shrink-0">
                    🏪
                  </div>
                  <div>
                    <p className="text-white font-black text-base leading-tight">{detail?.agency_name}</p>
                    <p className="text-white/60 text-xs">Stock Submission</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/10 backdrop-blur rounded-2xl p-3 text-center">
                    <p className="text-xl font-black text-white">{detail?.items?.length ?? 0}</p>
                    <p className="text-white/60 text-xs mt-0.5">Products</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-2xl p-3 text-center">
                    <p className="text-xl font-black text-white">{totalQty}</p>
                    <p className="text-white/60 text-xs mt-0.5">Total Qty</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-2xl p-3 text-center">
                    <p className="text-base font-black text-white">{timeStr}</p>
                    <p className="text-white/60 text-xs mt-0.5">Time</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Submitted by */}
            <div className="bg-white rounded-[20px] border border-gray-100 px-4 py-4 flex items-center gap-3 mb-5 shadow-sm">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-lg shrink-0">
                👤
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold">Submitted by</p>
                <p className="text-sm font-bold text-gray-900">{detail?.submitted_by_name}</p>
                <p className="text-xs text-gray-400">{dateStr} at {timeStr}</p>
              </div>
            </div>

            {/* Items */}
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
              Stock Items ({detail?.items?.length ?? 0})
            </p>
            <div className="flex flex-col gap-2.5">
              {(detail?.items ?? []).map((item, i) => (
                <div
                  key={i}
                  className="bg-white rounded-[18px] border border-gray-100 px-4 py-3.5 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-base shrink-0">
                      📦
                    </div>
                    <p className="text-sm font-bold text-gray-900">{item.product_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-brand-600">{item.quantity}</p>
                    <p className="text-xs text-gray-400">qty</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}