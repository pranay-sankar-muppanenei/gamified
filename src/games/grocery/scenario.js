/**
 * Scenario definition for Game 1 — Grocery Planning.
 * Decontextualised: the player only manages a list, a budget, and time.
 * No domain knowledge (cooking, household routines) is required.
 */

export const GROCERY_CONFIG = {
  timeLimit: 150, // seconds
  initialBudget: 800,
};

export const REQUIREMENTS = [
  {
    id: "rice", label: "Staple grain", essential: true,
    products: [
      { id: "rice_01", name: "Premium Basmati", price: 220, quality: 5 },
      { id: "rice_02", name: "Long Grain Rice", price: 150, quality: 4 },
      { id: "rice_03", name: "Budget Rice", price: 90, quality: 2 },
    ],
  },
  {
    id: "milk", label: "Dairy", essential: true,
    products: [
      { id: "milk_01", name: "Organic Milk", price: 140, quality: 5 },
      { id: "milk_02", name: "Whole Milk", price: 95, quality: 4 },
      { id: "milk_03", name: "Value Milk", price: 60, quality: 2 },
    ],
  },
  {
    id: "veg", label: "Fresh produce", essential: true,
    products: [
      { id: "veg_01", name: "Fresh Mixed Veg", price: 160, quality: 5 },
      { id: "veg_02", name: "Frozen Veg Pack", price: 100, quality: 3 },
      { id: "veg_03", name: "Canned Veg", price: 55, quality: 2 },
    ],
  },
  {
    id: "bread", label: "Bakery", essential: true,
    products: [
      { id: "bread_01", name: "Artisan Loaf", price: 120, quality: 5 },
      { id: "bread_02", name: "Sandwich Loaf", price: 70, quality: 3 },
      { id: "bread_03", name: "Day-old Bread", price: 40, quality: 2 },
    ],
  },
  {
    id: "protein", label: "Protein staple", essential: true,
    products: [
      { id: "prot_01", name: "Organic Lentils", price: 130, quality: 5 },
      { id: "prot_02", name: "Standard Lentils", price: 85, quality: 4 },
      { id: "prot_03", name: "Bulk Lentils", price: 55, quality: 3 },
    ],
  },
  {
    id: "snack", label: "Treat (optional)", essential: false,
    products: [
      { id: "snack_01", name: "Dark Chocolate", price: 110, quality: 4 },
      { id: "snack_02", name: "Biscuits", price: 60, quality: 3 },
      { id: "snack_03", name: "Chips", price: 45, quality: 2 },
    ],
  },
  {
    id: "clean", label: "Supplies (optional)", essential: false,
    products: [
      { id: "clean_01", name: "Eco Cleaner", price: 125, quality: 4 },
      { id: "clean_02", name: "Standard Cleaner", price: 80, quality: 3 },
      { id: "clean_03", name: "Basic Cleaner", price: 40, quality: 2 },
    ],
  },
];

/** Requirement that appears mid-game. */
export const LATE_REQUIREMENT = {
  id: "eggs", label: "Protein (new request)", essential: true,
  products: [
    { id: "egg_01", name: "Free-range Eggs", price: 130, quality: 5 },
    { id: "egg_02", name: "Barn Eggs", price: 85, quality: 4 },
    { id: "egg_03", name: "Value Eggs", price: 55, quality: 3 },
  ],
};

/** Scripted disruptions (seconds from start). Identical for every player. */
export const UNEXPECTED_EVENTS = [
  { id: "ev1", t: 25, type: "PRICE_INCREASE", productId: "milk_02", newPrice: 150,
    text: "Price increase: Whole Milk now costs $150 (was $95)." },
  { id: "ev2", t: 50, type: "ITEM_UNAVAILABLE", productId: "veg_02",
    text: "Stock-out: Frozen Veg Pack is no longer available." },
  { id: "ev3", t: 75, type: "NEW_REQUIREMENT", requirement: LATE_REQUIREMENT,
    text: "New requirement: an extra essential item (Protein – new request) was added to your list." },
  { id: "ev4", t: 100, type: "BUDGET_CHANGE", delta: -200,
    text: "Budget change: your available budget was reduced by $200." },
];
