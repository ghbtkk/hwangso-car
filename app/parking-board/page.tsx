import { supabase } from "@/lib/supabase";
import ParkingBoard from "@/components/ParkingBoard";

export const revalidate = 0;

export default async function ParkingBoardPage() {
  const { data: cars } = await supabase.from("car").select("*");
  const { data: locations } = await supabase
    .from("parkinglocation")
    .select("*");

  return (
    <ParkingBoard initialCars={cars || []} initialLocations={locations || []} />
  );
}
