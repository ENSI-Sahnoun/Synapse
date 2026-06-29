'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { createPurchaseAction } from '@/actions/employee/purchases'
import { QrScanDialog } from './qr-scan-dialog'
import { type Product } from '@/data/employee/products'

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

type AssignStep = 'choose' | 'scan' | 'id' | 'confirm'

function formatDt(amount: number) {
  return amount.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' DT'
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function PosClient({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignStep, setAssignStep] = useState<AssignStep>('choose')
  const [pendingStudent, setPendingStudent] = useState<StudentInfo | null>(null)
  const [receiptData, setReceiptData] = useState<{ totalDt: number; studentName: string | null; items: CartItem[] } | null>(null)

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
    setAssignOpen(true)
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

  const categories = [...new Set(products.map((p) => p.category))]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 16px 100px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {categories.map((category) => (
          <div key={category} style={{ display: 'contents' }}>
            {products.filter((p) => p.category === category).map((product) => {
              const outOfStock = product.stock_quantity === 0
              const cartItem = cart.find((i) => i.product.id === product.id)
              return (
                <button
                  key={product.id}
                  disabled={outOfStock}
                  onClick={() => addToCart(product)}
                  style={{
                    background: '#fff',
                    border: cartItem ? '1.5px solid var(--accent-brand)' : '1px solid var(--border-subtle)',
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
                    aspectRatio: '4/3',
                    background: 'repeating-linear-gradient(-45deg, var(--synapse-cream-100, #f5f0eb) 0px 6px, var(--synapse-cream-200, #e8e0d6) 6px 12px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', fontFamily: 'monospace', padding: '0 8px', textAlign: 'center' }}>
                      {product.name}
                    </span>
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{product.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-brand)', marginTop: 2 }}>{product.price_dt.toFixed(3)} DT</div>
                  </div>
                  {cartItem && (
                    <span style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
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
            })}
          </div>
        ))}
        {products.length === 0 && (
          <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 14, padding: '32px 0' }}>
            Aucun produit actif. Ajoutez des produits depuis l&apos;administration.
          </p>
        )}
      </div>

      {cart.length > 0 && (
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
      )}

      <button
        disabled={cart.length === 0}
        onClick={openAssign}
        style={{
          width: '100%',
          padding: '16px 0',
          borderRadius: 'var(--radius-lg)',
          background: cart.length === 0 ? 'var(--border-subtle)' : 'var(--accent-brand)',
          color: cart.length === 0 ? 'var(--muted-foreground)' : '#fff',
          fontWeight: 700,
          fontSize: 16,
          border: 'none',
          cursor: cart.length === 0 ? 'default' : 'pointer',
          transition: 'background 0.2s',
        }}
      >
        {cart.length === 0 ? 'Ajouter des articles' : `Valider — ${formatDt(totalDt)}`}
      </button>

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
        bottom: 0,
        left: '50%',
        width: '100%',
        maxWidth: 480,
        background: '#fff',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        zIndex: 51,
        padding: '0 0 env(safe-area-inset-bottom, 20px)',
        transition: 'transform 0.25s ease',
        transform: `translateX(-50%) translateY(${assignOpen ? '0' : '100%'})`,
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-default)', margin: '12px auto 0' }} />

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
                onClick={() => setAssignStep('id')}
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
                Saisir l&apos;identifiant
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
                {status === 'executing' ? 'Enregistrement...' : 'Valider anonymement'}
              </button>
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

        {assignStep === 'id' && (
          <div style={{ padding: '20px 20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => setAssignStep('choose')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 14, padding: 0 }}
              >
                ← Retour
              </button>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Saisir l&apos;identifiant</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Numéro étudiant ou téléphone"
                style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
              />
              <button
                disabled
                style={{ padding: '10px 16px', borderRadius: 'var(--radius-md)', background: 'var(--border-subtle)', color: 'var(--muted-foreground)', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'not-allowed' }}
              >
                Trouver
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary, var(--muted-foreground))', marginTop: 8 }}>
              Recherche manuelle non disponible sur cette version
            </p>
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
    </div>
  )
}
