import { ShopProvider } from '@/features/shop/context/ShopProvider';

export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ShopProvider>{children}</ShopProvider>
      </div>
    </div>
  );
}
