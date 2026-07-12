'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { createPurchaseAction } from '@/actions/employee/purchases'
import { createEmployeeChargeAction } from '@/actions/admin/employee-charge'
import { searchStudentsByNameAction } from '@/actions/employee/search-students-by-name'
import { lookupStudentByQrAction } from '@/actions/employee/lookup-student-by-qr'
import {
  addCashMovementAction,
  closeCashSessionAction,
} from '@/actions/employee/cash-sessions'
import { QrScanDialog } from './qr-scan-dialog'
import { type Product } from '@/data/employee/products'
import { type OpenCashSession } from '@/data/employee/cash-sessions'

interface CartItem {
  product: Product
  quantity: number
}

interface StudentInfo {
  studentId: string
  fullName: string
  phone: string | null
  loyaltyBalance: number
}

type AssignStep = 'choose' | 'scan' | 'name' | 'confirm'

function formatDt(amount: number) {
  return amount.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT'
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function PosClient({
  products,
  categoryEmojis,
  categoryOrder,
  currentUser,
  cashSession,
  isAdmin,
}: {
  products: Product[]
  categoryEmojis: Record<string, string>
  categoryOrder: string[]
  currentUser: { id: string; fullName: string }
  cashSession: OpenCashSession
  isAdmin: boolean
}) {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignStep, setAssignStep] = useState<AssignStep>('choose')
  const [pendingStudent, setPendingStudent] = useState<StudentInfo | null>(null)
  const [receiptData, setReceiptData] = useState<{ totalDt: number; studentName: string | null; items: CartItem[] } | null>(null)
  const [nameQuery, setNameQuery] = useState('')
  const [nameResults, setNameResults] = useState<StudentInfo[]>([])
  const [search, setSearch] = useState('')

  const [movementOpen, setMovementOpen] = useState(false)
  const [movementType, setMovementType] = useState<'in' | 'out'>('in')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementReason, setMovementReason] = useState('')

  const [chargeCart, setChargeCart] = useState<CartItem[]>([])
  const [chargeSearch, setChargeSearch] = useState('')

  const [closeOpen, setCloseOpen] = useState(false)
  const [closingAmount, setClosingAmount] = useState('')
  const [closingNotes, setClosingNotes] = useState('')
  const [closeResult, setCloseResult] = useState<{
    countedDt: number
    expectedDt: number
    discrepancyDt: number
  } | null>(null)

  const { execute: executeMovement, status: movementStatus } = useAction(addCashMovementAction, {
    onSuccess: () => {
      toast.success('Mouvement de caisse enregistré')
      setMovementOpen(false)
      setMovementAmount('')
      setMovementReason('')
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const { execute: executeClose, status: closeStatus } = useAction(closeCashSessionAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setCloseResult({
        countedDt: Number(data.closing_amount_dt ?? 0),
        expectedDt: Number(data.expected_amount_dt ?? 0),
        discrepancyDt: Number(data.discrepancy_dt ?? 0),
      })
      setCloseOpen(false)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  function submitMovement(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(movementAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error('Montant invalide')
      return
    }
    if (movementReason.trim() === '') {
      toast.error('Motif requis')
      return
    }
    executeMovement({
      session_id: cashSession.id,
      type: movementType,
      amount_dt: amount,
      reason: movementReason.trim(),
    })
  }

  function submitClose(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(closingAmount)
    if (Number.isNaN(amount) || amount < 0) {
      toast.error('Montant invalide')
      return
    }
    executeClose({
      session_id: cashSession.id,
      closing_amount_dt: amount,
      notes: closingNotes.trim() || null,
    })
  }

  function finishClosing() {
    setCloseResult(null)
    setClosingAmount('')
    setClosingNotes('')
    router.refresh()
  }

  const { execute: searchByName, status: searchStatus } = useAction(searchStudentsByNameAction, {
    onSuccess: ({ data }) => setNameResults(data ?? []),
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur de recherche'),
  })

  const totalDt = cart.reduce((sum, item) => sum + item.product.price_dt * item.quantity, 0)

  const { execute, status } = useAction(createPurchaseAction, {
    onSuccess: ({ data }) => {
      const msg =
        data?.studentLinked && data.pointsEarned > 0
          ? `Vente enregistrée — ${data.pointsEarned} pts Synapse attribués`
          : 'Vente enregistrée'
      toast.success(msg)
      setReceiptData({ totalDt, studentName: pendingStudent?.fullName ?? null, items: cart })
      setCart([])
      setAssignOpen(false)
      setAssignStep('choose')
      setPendingStudent(null)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  const chargeTotalDt = chargeCart.reduce((sum, item) => sum + item.product.price_dt * item.quantity, 0)

  const { execute: executeCharge, status: chargeStatus } = useAction(createEmployeeChargeAction, {
    onSuccess: ({ data }) => {
      toast.success(`Charge employés enregistrée — ${formatDt(data?.totalDt ?? 0)} en dépenses`)
      setChargeCart([])
      setChargeSearch('')
      router.refresh()
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'Erreur'),
  })

  function addToChargeCart(product: Product) {
    if (product.stock_quantity === 0) return
    setChargeCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error(`Stock max: ${product.stock_quantity}`)
          return prev
        }
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function changeChargeQty(productId: string, delta: number) {
    setChargeCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: Math.min(i.quantity + delta, delta > 0 ? i.product.stock_quantity : Infinity) }
            : i
        )
        .filter((i) => i.quantity > 0)
    )
  }

  function submitCharge() {
    if (chargeCart.length === 0) return
    executeCharge({
      items: chargeCart.map((i) => ({ product_id: i.product.id, quantity: i.quantity })),
    })
  }

  function addToCart(product: Product) {
    if (product.stock_quantity === 0) return
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error(`Stock max: ${product.stock_quantity}`)
          return prev
        }
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: Math.min(i.quantity + delta, delta > 0 ? i.product.stock_quantity : Infinity) }
            : i
        )
        .filter((i) => i.quantity > 0)
    )
  }

  function confirmPurchase(studentId: string | null) {
    if (cart.length === 0) return
    execute({
      student_id: studentId,
      items: cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price_dt: i.product.price_dt,
      })),
    })
  }

  function handleStudentScanned(student: StudentInfo) {
    setPendingStudent(student)
    setAssignStep('confirm')
  }

  function openAssign() {
    setAssignStep('choose')
    setPendingStudent(null)
    setNameQuery('')
    setNameResults([])
    setAssignOpen(true)
  }

  function pickStudent(student: StudentInfo) {
    setPendingStudent(student)
    setAssignStep('confirm')
  }

  const { execute: lookupAirdroppedStudent } = useAction(lookupStudentByQrAction, {
    onSuccess: ({ data }) => {
      if (!data) return
      setAssignOpen(true)
      setPendingStudent(data)
      setAssignStep('confirm')
      toast.success(`Étudiant identifié: ${data.fullName}`)
    },
    onError: ({ error }) => toast.error(error.serverError ?? 'QR non reconnu'),
  })

  useEffect(() => {
    function onAirdropToken(e: Event) {
      const token = (e as CustomEvent<string>).detail
      if (token) lookupAirdroppedStudent({ qr_token: token })
    }
    window.addEventListener('pos-airdrop-token', onAirdropToken)
    return () => window.removeEventListener('pos-airdrop-token', onAirdropToken)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function purchaseForSelf() {
    setPendingStudent({ studentId: currentUser.id, fullName: currentUser.fullName, phone: null, loyaltyBalance: 0 })
    confirmPurchase(currentUser.id)
  }

  if (closeResult) {
    const hasDiscrepancy = Math.abs(closeResult.discrepancyDt) > 0.001
    return (
      <div style={{ padding: '16px 16px 100px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: '100%',
          maxWidth: 380,
          marginTop: 40,
          background: '#fff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Caisse clôturée</h2>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Résultat du comptage</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>Compté</span>
              <span style={{ fontWeight: 700 }}>{formatDt(closeResult.countedDt)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>Attendu</span>
              <span style={{ fontWeight: 700 }}>{formatDt(closeResult.expectedDt)}</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              paddingTop: 10,
              borderTop: '1px solid var(--border-subtle)',
            }}>
              <span>Écart</span>
              <span style={{ fontWeight: 700, color: hasDiscrepancy ? '#dc2626' : 'var(--accent-brand)' }}>
                {closeResult.discrepancyDt > 0 ? '+' : ''}
                {formatDt(closeResult.discrepancyDt)}
              </span>
            </div>
          </div>
          <button
            onClick={finishClosing}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--accent-brand)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Nouvelle session
          </button>
        </div>
      </div>
    )
  }

  if (receiptData) {
    return (
      <div style={{ padding: '16px 16px 100px' }}>
        <div style={{
          background: '#fff',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'var(--synapse-green-50, #f0faf4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="var(--synapse-green-500, #22c55e)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-brand)' }}>
              Payé {formatDt(receiptData.totalDt)}
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 4 }}>
              {receiptData.studentName ?? 'Transaction anonyme'}
            </div>
          </div>
          <div style={{ width: '100%', borderTop: '1px solid var(--border-subtle)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {receiptData.items.map((item) => (
              <div key={item.product.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>{item.product.name} × {item.quantity}</span>
                <span style={{ color: 'var(--accent-brand)', fontWeight: 600 }}>{formatDt(item.product.price_dt * item.quantity)}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setReceiptData(null)}
            style={{
              width: '100%',
              padding: '14px 0',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--accent-brand)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              border: 'none',
              cursor: 'pointer',
              marginTop: 8,
            }}
          >
            Nouvelle transaction
          </button>
        </div>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const visibleProducts = q
    ? products.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    : products
  const catRank = new Map(categoryOrder.map((name, i) => [name, i]))
  const categories = [...new Set(visibleProducts.map((p) => p.category))].sort(
    (a, b) => (catRank.get(a) ?? 999) - (catRank.get(b) ?? 999)
  )

  function renderCard(product: Product) {
    const outOfStock = product.stock_quantity === 0
    const cartItem = cart.find((i) => i.product.id === product.id)
    return (
      <button
        key={product.id}
        disabled={outOfStock}
        onClick={() => addToCart(product)}
        style={{
          background: '#fff',
          border: cartItem ? '1px solid var(--accent-brand)' : '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          position: 'relative',
          opacity: outOfStock ? 0.4 : 1,
          cursor: outOfStock ? 'default' : 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <div style={{
          aspectRatio: '1/1',
          background: 'var(--synapse-cream-100, #f5f0eb)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : categoryEmojis[product.category] ? (
            <span style={{ fontSize: 40, lineHeight: 1 }}>{categoryEmojis[product.category]}</span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', padding: '0 8px', textAlign: 'center' }}>
              {product.name}
            </span>
          )}
        </div>
        <div style={{ padding: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{product.name}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-brand)', marginTop: 2 }}>{product.price_dt.toFixed(3)} DT</div>
        </div>
        {cartItem && (
          <span style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'var(--accent-brand)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {cartItem.quantity}
          </span>
        )}
      </button>
    )
  }

  return (
    <div style={{ padding: '16px 16px 100px' }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          background: 'var(--synapse-green-50, #f0faf4)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
        }}
      >
        <span style={{ fontWeight: 600 }}>
          Caisse ouverte · fond initial {formatDt(cashSession.openingAmountDt)} · depuis{' '}
          {formatTime(cashSession.openedAt)} ({cashSession.openedByName})
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setMovementOpen(true)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Mouvement de caisse
          </button>
          <button
            onClick={() => setCloseOpen(true)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--accent-brand)',
              background: 'transparent',
              color: 'var(--accent-brand)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Clôturer la caisse
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un article…"
            style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', fontSize: 14 }}
          />

          {categories.map((category) => (
            <div key={category}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontWeight: 700, fontSize: 15 }}>
                <span style={{ fontSize: 20 }}>{categoryEmojis[category] ?? '📦'}</span>
                <span>{category}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(108px, 1fr))', gap: 10 }}>
                {visibleProducts.filter((p) => p.category === category).map(renderCard)}
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14, padding: '32px 0' }}>
              Aucun produit actif. Ajoutez des produits depuis l&apos;administration.
            </p>
          )}
          {products.length > 0 && visibleProducts.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14, padding: '32px 0' }}>
              Aucun résultat
            </p>
          )}

          {isAdmin && (
            <div style={{
              marginTop: 8,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 'var(--radius-xl)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🎁</span>
                  <span>Charges — Employés</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 2 }}>
                  Articles offerts aux employés : 0 revenu, comptabilisés en dépenses (Charge Employés) au prix coûtant.
                </p>
              </div>

              <input
                value={chargeSearch}
                onChange={(e) => setChargeSearch(e.target.value)}
                placeholder="Ajouter un article existant…"
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #fde68a', borderRadius: 'var(--radius-lg)', fontSize: 14, background: '#fff' }}
              />

              {chargeSearch.trim() !== '' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {products
                    .filter((p) => p.name.toLowerCase().includes(chargeSearch.trim().toLowerCase()))
                    .slice(0, 6)
                    .map((p) => (
                      <button
                        key={p.id}
                        disabled={p.stock_quantity === 0}
                        onClick={() => addToChargeCart(p)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '10px 12px',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          background: '#fff',
                          cursor: p.stock_quantity === 0 ? 'not-allowed' : 'pointer',
                          opacity: p.stock_quantity === 0 ? 0.4 : 1,
                          fontSize: 14,
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {categoryEmojis[p.category] ?? '📦'} {p.name}
                        </span>
                        <span style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>
                          {formatDt(p.price_dt)} · stock {p.stock_quantity} · + Ajouter
                        </span>
                      </button>
                    ))}
                  {products.filter((p) => p.name.toLowerCase().includes(chargeSearch.trim().toLowerCase())).length === 0 && (
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', padding: '4px 0' }}>
                      Aucun article trouvé
                    </p>
                  )}
                </div>
              )}

              {chargeCart.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {chargeCart.map((item) => (
                      <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <span style={{ flex: 1, fontWeight: 500 }}>{item.product.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            onClick={() => changeChargeQty(item.product.id, -1)}
                            style={{ width: 28, height: 28, border: '1px solid var(--border-subtle)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}
                          >–</button>
                          <span style={{ width: 24, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                          <button
                            onClick={() => changeChargeQty(item.product.id, 1)}
                            disabled={item.quantity >= item.product.stock_quantity}
                            style={{ width: 28, height: 28, border: '1px solid var(--border-subtle)', borderRadius: 6, background: '#fff', cursor: item.quantity >= item.product.stock_quantity ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 16, opacity: item.quantity >= item.product.stock_quantity ? 0.4 : 1 }}
                          >+</button>
                        </div>
                        <span style={{ color: '#b45309', fontWeight: 600, minWidth: 72, textAlign: 'right' }}>
                          {formatDt(item.product.price_dt * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 14 }}>
                    <span>Valeur de vente (dépense réelle = coût, calculée à l&apos;enregistrement)</span>
                    <span style={{ color: '#b45309' }}>{formatDt(chargeTotalDt)}</span>
                  </div>
                </div>
              )}

              {chargeCart.length > 0 && (
                <button
                  disabled={chargeStatus === 'executing'}
                  onClick={submitCharge}
                  style={{
                    width: '100%',
                    padding: '13px 0',
                    borderRadius: 'var(--radius-lg)',
                    background: '#b45309',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 15,
                    border: 'none',
                    cursor: chargeStatus === 'executing' ? 'not-allowed' : 'pointer',
                    opacity: chargeStatus === 'executing' ? 0.7 : 1,
                  }}
                >
                  {chargeStatus === 'executing' ? 'Enregistrement...' : 'Enregistrer la charge'}
                </button>
              )}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <aside className="w-full lg:w-80 lg:sticky lg:top-4 flex flex-col gap-3">
            <div style={{
              background: '#fff',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, fontSize: 15 }}>
                Panier
              </div>
              <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cart.map((item) => (
                  <div key={item.product.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                    <span style={{ flex: 1, fontWeight: 500 }}>{item.product.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={() => changeQty(item.product.id, -1)}
                        style={{ width: 28, height: 28, border: '1px solid var(--border-subtle)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}
                      >–</button>
                      <span style={{ width: 24, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                      <button
                        onClick={() => changeQty(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock_quantity}
                        style={{ width: 28, height: 28, border: '1px solid var(--border-subtle)', borderRadius: 6, background: '#fff', cursor: item.quantity >= item.product.stock_quantity ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 16, opacity: item.quantity >= item.product.stock_quantity ? 0.4 : 1 }}
                      >+</button>
                    </div>
                    <span style={{ color: 'var(--accent-brand)', fontWeight: 600, minWidth: 72, textAlign: 'right' }}>
                      {formatDt(item.product.price_dt * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: 15 }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-brand)' }}>{formatDt(totalDt)}</span>
              </div>
            </div>

            <button
              onClick={openAssign}
              style={{
                width: '100%',
                padding: '16px 0',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-brand)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {`Valider — ${formatDt(totalDt)}`}
            </button>
          </aside>
        )}
      </div>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 50,
          display: assignOpen ? 'block' : 'none',
        }}
        onClick={() => setAssignOpen(false)}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100%',
        maxWidth: 440,
        maxHeight: '85vh',
        overflowY: 'auto',
        background: '#fff',
        borderRadius: 'var(--radius-xl)',
        zIndex: 51,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        transform: `translate(-50%, -50%) scale(${assignOpen ? 1 : 0.95})`,
        opacity: assignOpen ? 1 : 0,
        pointerEvents: assignOpen ? 'auto' : 'none',
      }}>
        {assignStep === 'choose' && (
          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Attribuer &amp; Valider</span>
              <span style={{ color: 'var(--accent-brand)', fontWeight: 700, fontSize: 16 }}>{formatDt(totalDt)}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20 }}>Choisissez comment identifier l&apos;étudiant</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => setAssignStep('scan')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  background: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Scanner le QR étudiant
              </button>
              <button
                onClick={() => setAssignStep('name')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  background: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Rechercher par nom
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  disabled={status === 'executing'}
                  onClick={() => confirmPurchase(null)}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    border: '1.5px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'transparent',
                    color: 'var(--muted-foreground)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  {status === 'executing' ? 'Enregistrement...' : 'Valider anonymement'}
                </button>
                <button
                  disabled={status === 'executing'}
                  onClick={purchaseForSelf}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    border: '1.5px solid var(--accent-brand)',
                    borderRadius: 'var(--radius-lg)',
                    background: 'transparent',
                    color: 'var(--accent-brand)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Pour moi
                </button>
              </div>
            </div>
          </div>
        )}

        {assignStep === 'scan' && (
          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => setAssignStep('choose')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 14, padding: 0 }}
              >
                ← Retour
              </button>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Scanner le QR</span>
            </div>
            <QrScanDialog onStudentScanned={handleStudentScanned} />
          </div>
        )}

        {assignStep === 'name' && (
          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => setAssignStep('choose')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 14, padding: 0 }}
              >
                ← Retour
              </button>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Rechercher par nom</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (nameQuery.trim().length >= 2) searchByName({ query: nameQuery.trim() })
              }}
              style={{ display: 'flex', gap: 8 }}
            >
              <input
                autoFocus
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="Nom de l'étudiant"
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
              />
              <button
                type="submit"
                disabled={nameQuery.trim().length < 2 || searchStatus === 'executing'}
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: nameQuery.trim().length < 2 ? 'var(--border-subtle)' : 'var(--accent-brand)',
                  color: nameQuery.trim().length < 2 ? 'var(--muted-foreground)' : '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: nameQuery.trim().length < 2 ? 'not-allowed' : 'pointer',
                }}
              >
                {searchStatus === 'executing' ? '...' : 'Trouver'}
              </button>
            </form>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              {nameResults.map((student) => (
                <button
                  key={student.studentId}
                  onClick={() => pickStudent(student)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)',
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--accent-brand)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                  }}>
                    {initials(student.fullName)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{student.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                      Solde: {student.loyaltyBalance} pts
                      {student.phone && ` · ${student.phone}`}
                    </div>
                  </div>
                </button>
              ))}
              {searchStatus === 'hasSucceeded' && nameResults.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', textAlign: 'center', padding: '8px 0' }}>
                  Aucun étudiant trouvé
                </p>
              )}
            </div>
          </div>
        )}

        {assignStep === 'confirm' && pendingStudent && (
          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => setAssignStep('choose')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 14, padding: 0 }}
              >
                ← Retour
              </button>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Confirmer</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: 'var(--synapse-green-50, #f0faf4)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 20,
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--accent-brand)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 15,
                flexShrink: 0,
              }}>
                {initials(pendingStudent.fullName)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{pendingStudent.fullName}</div>
                <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  Solde: {pendingStudent.loyaltyBalance} pts
                  {pendingStudent.phone && ` · ${pendingStudent.phone}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                disabled={status === 'executing'}
                onClick={() => confirmPurchase(pendingStudent.studentId)}
                style={{
                  padding: '14px 0',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--accent-brand)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  border: 'none',
                  cursor: status === 'executing' ? 'not-allowed' : 'pointer',
                  opacity: status === 'executing' ? 0.7 : 1,
                }}
              >
                {status === 'executing' ? 'Enregistrement...' : `Valider ${formatDt(totalDt)}`}
              </button>
              <button
                disabled={status === 'executing'}
                onClick={() => confirmPurchase(null)}
                style={{
                  padding: '12px 0',
                  border: '1.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  background: 'transparent',
                  color: 'var(--muted-foreground)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Valider anonymement
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mouvement de caisse dialog */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 50,
          display: movementOpen ? 'block' : 'none',
        }}
        onClick={() => setMovementOpen(false)}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100%',
        maxWidth: 380,
        background: '#fff',
        borderRadius: 'var(--radius-xl)',
        zIndex: 51,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        transform: `translate(-50%, -50%) scale(${movementOpen ? 1 : 0.95})`,
        opacity: movementOpen ? 1 : 0,
        pointerEvents: movementOpen ? 'auto' : 'none',
      }}>
        <form onSubmit={submitMovement} style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Mouvement de caisse</span>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setMovementType('in')}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 'var(--radius-md)',
                border: movementType === 'in' ? '1.5px solid var(--accent-brand)' : '1px solid var(--border-default)',
                background: movementType === 'in' ? 'var(--synapse-green-50, #f0faf4)' : '#fff',
                color: movementType === 'in' ? 'var(--accent-brand)' : 'inherit',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Entrée
            </button>
            <button
              type="button"
              onClick={() => setMovementType('out')}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 'var(--radius-md)',
                border: movementType === 'out' ? '1.5px solid var(--accent-brand)' : '1px solid var(--border-default)',
                background: movementType === 'out' ? 'var(--synapse-green-50, #f0faf4)' : '#fff',
                color: movementType === 'out' ? 'var(--accent-brand)' : 'inherit',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Sortie
            </button>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Montant (DT)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              value={movementAmount}
              onChange={(e) => setMovementAmount(e.target.value)}
              placeholder="0.000"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Motif</label>
            <input
              value={movementReason}
              onChange={(e) => setMovementReason(e.target.value)}
              placeholder="Ex: dépôt en banque, paiement fournisseur…"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setMovementOpen(false)}
              style={{
                flex: 1,
                padding: '12px 0',
                border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                background: 'transparent',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={movementStatus === 'executing'}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-brand)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: movementStatus === 'executing' ? 'not-allowed' : 'pointer',
                opacity: movementStatus === 'executing' ? 0.7 : 1,
              }}
            >
              {movementStatus === 'executing' ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Clôturer la caisse dialog */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 50,
          display: closeOpen ? 'block' : 'none',
        }}
        onClick={() => setCloseOpen(false)}
      />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: '100%',
        maxWidth: 380,
        background: '#fff',
        borderRadius: 'var(--radius-xl)',
        zIndex: 51,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        transform: `translate(-50%, -50%) scale(${closeOpen ? 1 : 0.95})`,
        opacity: closeOpen ? 1 : 0,
        pointerEvents: closeOpen ? 'auto' : 'none',
      }}>
        <form onSubmit={submitClose} style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Clôturer la caisse</span>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>
              Comptez le contenu du tiroir-caisse et indiquez le total.
            </p>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Total compté (DT)</label>
            <input
              autoFocus
              type="number"
              step="0.001"
              min="0"
              inputMode="decimal"
              value={closingAmount}
              onChange={(e) => setClosingAmount(e.target.value)}
              placeholder="0.000"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes (optionnel)</label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 14, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setCloseOpen(false)}
              style={{
                flex: 1,
                padding: '12px 0',
                border: '1.5px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                background: 'transparent',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={closeStatus === 'executing'}
              style={{
                flex: 1,
                padding: '12px 0',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--accent-brand)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                border: 'none',
                cursor: closeStatus === 'executing' ? 'not-allowed' : 'pointer',
                opacity: closeStatus === 'executing' ? 0.7 : 1,
              }}
            >
              {closeStatus === 'executing' ? 'Clôture...' : 'Clôturer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
