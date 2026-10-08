export interface Plan {
  id: string;
  name: string;
  credits: number;
  amountPaise: number;
  desc: string;
}

export const PLANS: Record<string, Plan> = {
  credits_20: {
    id: "credits_20",
    name: "20 Credits",
    credits: 20,
    amountPaise: 19900, // ₹199
    desc: "20 decks, never expire",
  },
  credits_50: {
    id: "credits_50",
    name: "50 Credits",
    credits: 50,
    amountPaise: 39900, // ₹399
    desc: "50 decks, best value",
  },
};
