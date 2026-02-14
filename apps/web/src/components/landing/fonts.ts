import { Bricolage_Grotesque, Newsreader } from "next/font/google";

export const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
