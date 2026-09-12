"use client";

import { CreditCard, Heart, Package, UserRound } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountEmptySection } from "@/modules/profile/components/account-empty-section";
import { OrderHistorySection } from "@/modules/profile/components/order-history-section";
import { ProfileSummaryCard } from "@/modules/profile/components/profile-summary-card";
import { SavedCardsSection } from "@/modules/profile/components/saved-cards-section";
import type { AccountTab } from "@/modules/profile/constants";

type AccountTabsProps = {
  imageUrl: string;
  displayName: string;
  email: string;
  username: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  /** Pestaña inicial resuelta en el servidor desde `?tab=`. */
  defaultTab: AccountTab;
  /** `session_id` del retorno de Stripe, para la pestaña de tarjetas (010 AC3). */
  setupSessionId: string | null;
};

/**
 * Frontera de cliente de `/account` (007 T5): Radix Tabs necesita estado, así
 * que `"use client"` baja hasta aquí y la página se queda como Server
 * Component. Solo recibe primitivas ya derivadas del `User` de Clerk (AC6).
 */
export function AccountTabs({
  imageUrl,
  displayName,
  email,
  username,
  createdAt,
  lastSignInAt,
  defaultTab,
  setupSessionId,
}: AccountTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="gap-6">
      <TabsList>
        <TabsTrigger value="profile">
          <UserRound />
          Mi perfil
        </TabsTrigger>
        <TabsTrigger value="favorites">
          <Heart />
          Mis favoritos
        </TabsTrigger>
        <TabsTrigger value="orders">
          <Package />
          Mis compras
        </TabsTrigger>
        <TabsTrigger value="cards">
          <CreditCard />
          Mis tarjetas
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileSummaryCard
          imageUrl={imageUrl}
          displayName={displayName}
          email={email}
          username={username}
          createdAt={createdAt}
          lastSignInAt={lastSignInAt}
        />
      </TabsContent>

      <TabsContent value="favorites">
        <AccountEmptySection
          icon={<Heart />}
          title="Aún no tienes favoritos"
          description="Guarda los productos que te interesan y los encontrarás aquí la próxima vez."
          ctaLabel="Explorar catálogo"
        />
      </TabsContent>

      <TabsContent value="orders">
        <OrderHistorySection />
      </TabsContent>

      <TabsContent value="cards">
        <SavedCardsSection setupSessionId={setupSessionId} />
      </TabsContent>
    </Tabs>
  );
}
