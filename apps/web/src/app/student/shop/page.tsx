import { GraduationCap, Lock, ShoppingBag } from '@phosphor-icons/react/dist/ssr'
import { getShopSubscriptionPlans, getShopLockerFee, getShopProductsByCategory } from '@/data/student/shop'
import { LiveRefresher } from '@/components/live/LiveRefresher'

function formatDt(amount: number) {
  return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} DT`
}

export default async function StudentShopPage() {
  const [plans, lockerFee, categories] = await Promise.all([
    getShopSubscriptionPlans(),
    getShopLockerFee(),
    getShopProductsByCategory(),
  ])

  return (
    <div className="space-y-6">
      <LiveRefresher tables={['subscription_plans', 'settings', 'products', 'product_categories']} />

      <div>
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          Boutique
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Tous nos tarifs, en un coup d&apos;œil
        </p>
      </div>

      {/* Subscriptions */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: 'var(--synapse-blue-100, #dbeafe)' }}
          >
            <GraduationCap size={16} style={{ color: 'var(--synapse-blue-600, #2563eb)' }} weight="bold" />
          </div>
          <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--synapse-blue-600, #2563eb)' }}>
            Abonnements
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl border p-4 flex items-center justify-between"
              style={{ background: 'white', borderColor: 'var(--synapse-blue-100, #dbeafe)' }}
            >
              <div>
                <p className="font-semibold text-sm">{plan.name}</p>
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  {plan.duration_days} jours
                </p>
              </div>
              <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-display)', color: 'var(--synapse-blue-600, #2563eb)' }}>
                {formatDt(plan.price_dt)}
              </p>
            </div>
          ))}
          {plans.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Aucun abonnement disponible</p>
          )}
        </div>
      </section>

      {/* Lockers */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: 'var(--synapse-orange-100, #ffedd5)' }}
          >
            <Lock size={16} style={{ color: 'var(--synapse-orange-600)' }} weight="bold" />
          </div>
          <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--synapse-orange-600)' }}>
            Casiers
          </h2>
        </div>
        <div
          className="rounded-xl border p-4 flex items-center justify-between"
          style={{ background: 'white', borderColor: 'var(--synapse-orange-100, #ffedd5)' }}
        >
          <div>
            <p className="font-semibold text-sm">Location casier</p>
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Durée minimale : {lockerFee.min_duration_days} jours
            </p>
          </div>
          <p className="font-bold text-lg" style={{ fontFamily: 'var(--font-display)', color: 'var(--synapse-orange-600)' }}>
            {formatDt(lockerFee.fee_dt)}
          </p>
        </div>
      </section>

      {/* Shop products */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: 'var(--synapse-purple-100, #f3e8ff)' }}
          >
            <ShoppingBag size={16} style={{ color: 'var(--synapse-purple-600, #9333ea)' }} weight="bold" />
          </div>
          <h2 className="font-semibold text-sm uppercase tracking-wide" style={{ color: 'var(--synapse-purple-600, #9333ea)' }}>
            Boutique
          </h2>
        </div>

        {categories.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Aucun article disponible</p>
        )}

        {categories.map((cat) => (
          <div key={cat.id} className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              {cat.emoji ? `${cat.emoji} ` : ''}
              {cat.name}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {cat.products.map((p) => {
                const outOfStock = p.stock_quantity === 0
                return (
                  <div
                    key={p.id}
                    className="relative rounded-lg border overflow-hidden flex flex-col"
                    style={{
                      background: 'white',
                      borderColor: 'var(--synapse-purple-100, #f3e8ff)',
                      opacity: outOfStock ? 0.6 : 1,
                    }}
                  >
                    <div
                      className="aspect-square flex items-center justify-center"
                      style={{ background: 'var(--synapse-purple-50, #faf5ff)' }}
                    >
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl leading-none">{cat.emoji ?? '🛍️'}</span>
                      )}
                      {outOfStock && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-white text-center px-1">
                            Rupture de stock
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 flex flex-col gap-0.5">
                      <p className="text-[11px] font-medium leading-tight truncate">{p.name}</p>
                      <p
                        className="text-xs font-bold"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--synapse-purple-600, #9333ea)' }}
                      >
                        {formatDt(p.price_dt)}
                      </p>
                      {!outOfStock && (
                        <p className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                          {p.stock_quantity} en stock
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
