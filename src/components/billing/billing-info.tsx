import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SEAT_PRICE_SEK } from "@/lib/subscription";

interface BillingInfoProps {
  usedSeats: number;
  seatsPurchased: number;
}

export function BillingInfo({ usedSeats, seatsPurchased }: BillingInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Fakturering</CardTitle>
        <CardDescription>
          {SEAT_PRICE_SEK} kr per mäklare och månad, inklusive moms. Fakturor skickas
          separat utanför BergLabs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Aktiva platser</span>
          <span className="font-medium">{usedSeats}</span>
        </div>
        {seatsPurchased > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Avtalade platser</span>
            <span className="font-medium">{seatsPurchased}</span>
          </div>
        )}
        <p className="pt-2 text-muted-foreground">
          Frågor om fakturor? Kontakta BergLabs så hjälper vi er.
        </p>
      </CardContent>
    </Card>
  );
}
