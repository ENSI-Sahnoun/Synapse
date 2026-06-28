'use client'

import { useState } from 'react'
import { useAction } from 'next-safe-action/hooks'
import { toast } from 'sonner'
import { createPurchaseAction } from '@/actions/employee/purchases'
import { Button } from '@/components/ui/button'
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

export function PosClient({ products }: { products: Product[] }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [student, setStudent] = useState<StudentInfo | null>(null)

  const totalDt = cart.reduce(
    (sum, item) => sum + item.product.price_dt * item.quantity,
    0
  )
  const pointsPreview = student ? Math.floor(totalDt) : 0

  const { execute, status } = useAction(createPurchaseAction, {
    onSuccess: ({ data }) => {
      const msg =
        data?.studentLinked && data.pointsEarned > 0
          ? `Vente enregistrée — ${data.pointsEarned} pts Synapse attribués`
          : 'Vente enregistrée'
      toast.success(msg)
      setCart([])
      setStudent(null)
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

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    )
  }

  function confirmPurchase() {
    if (cart.length === 0) return
    execute({
      student_id: student?.studentId ?? null,
      items: cart.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price_dt: i.product.price_dt,
      })),
    })
  }

  const categories = [...new Set(products.map((p) => p.category))]

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      {/* Product grid */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        <h1 className="text-2xl font-semibold sticky top-0 bg-background py-2">
          Point de vente
        </h1>
        {categories.map((category) => (
          <div key={category} className="space-y-2">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {category}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {products
                .filter((p) => p.category === category)
                .map((product) => {
                  const outOfStock = product.stock_quantity === 0
                  const cartItem = cart.find((i) => i.product.id === product.id)
                  return (
                    <button
                      key={product.id}
                      disabled={outOfStock}
                      onClick={() => addToCart(product)}
                      className={`border rounded-lg p-3 text-left transition-colors relative ${
                        outOfStock
                          ? 'opacity-40 cursor-not-allowed bg-muted'
                          : 'hover:border-primary hover:bg-primary/5 active:scale-95'
                      } ${cartItem ? 'border-primary bg-primary/5' : ''}`}
                    >
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-primary font-semibold text-sm mt-0.5">
                        {product.price_dt} DT
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {outOfStock ? 'Rupture de stock' : `Stock: ${product.stock_quantity}`}
                      </p>
                      {cartItem && (
                        <span className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                          {cartItem.quantity}
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun produit actif. Ajoutez des produits depuis l&apos;administration.
          </p>
        )}
      </div>

      {/* Cart sidebar */}
      <div className="w-72 shrink-0 border-l pl-4 flex flex-col gap-4 overflow-y-auto">
        <div className="sticky top-0 bg-background py-2">
          <h2 className="font-semibold">Panier</h2>
        </div>

        {/* Student identification */}
        <div className="space-y-2">
          {student ? (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <p className="text-sm font-medium">{student.fullName}</p>
              {student.phone && (
                <p className="text-xs text-muted-foreground">{student.phone}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Solde actuel: {student.loyaltyBalance} pts
              </p>
              <button
                onClick={() => setStudent(null)}
                className="text-xs text-destructive mt-1 hover:underline"
              >
                Retirer l&apos;étudiant
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <QrScanDialog onStudentScanned={setStudent} />
              <p className="text-xs text-muted-foreground">
                Optionnel — ignorez pour un achat anonyme.
              </p>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 space-y-2">
          {cart.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sélectionnez des produits dans la grille.
            </p>
          )}
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.product.price_dt} DT × {item.quantity} ={' '}
                  {(item.product.price_dt * item.quantity).toFixed(3)} DT
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => changeQty(item.product.id, -1)}
                >
                  –
                </Button>
                <span className="w-5 text-center">{item.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => changeQty(item.product.id, 1)}
                  disabled={item.quantity >= item.product.stock_quantity}
                >
                  +
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={() => removeFromCart(item.product.id)}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary + confirm */}
        {cart.length > 0 && (
          <div className="sticky bottom-0 bg-background py-2 border-t space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{totalDt.toFixed(3)} DT</span>
              </div>
              {student && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Points à gagner</span>
                  <span>+{pointsPreview} pts</span>
                </div>
              )}
              {!student && (
                <p className="text-xs text-muted-foreground">
                  Achat anonyme — aucun point attribué
                </p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={status === 'executing'}
              onClick={confirmPurchase}
            >
              {status === 'executing' ? 'Enregistrement...' : 'Confirmer la vente (espèces)'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
