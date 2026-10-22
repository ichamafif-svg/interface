import { redirect } from "next/navigation";
import { defaultProduct } from "@/lib/api/config";

export default function Home() {
  redirect(`/${defaultProduct()}/run`);
}
