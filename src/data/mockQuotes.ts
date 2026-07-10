import { QuoteData, QuoteItem } from "../types";

// Static realistic mock quotes
export const MOCK_QUOTES: Record<string, QuoteData> = {
  "1001": {
    id: "1001",
    quoteNumber: "QT_1001",
    customer: {
      name: "David Hasselhoff",
      phone: "0491 570 156",
      email: "dhasselhoff@beachwatch.org",
      company: "Baywatch Lifesavers Pty Ltd"
    },
    address: {
      street: "45 Baywatch Towers, Pacific Drive",
      suburb: "Malibu",
      state: "VIC",
      postcode: "3999",
      fullAddress: "45 Baywatch Towers, Pacific Drive, Malibu VIC 3999"
    },
    plannedWorksDate: "2026-06-15",
    items: [
      {
        id: "item_01",
        name: "2.4m Timber Posts 125x75 Rough Sawn",
        quantity: 12,
        unit: "pcs",
        supplier: "Fencing Depot",
        notes: "H4 Treated Pine, heavy duty in-ground"
      },
      {
        id: "item_02",
        name: "1.8m Timber Palings 100x12 Overlap Grade",
        quantity: 180,
        unit: "pcs",
        supplier: "Fencing Depot",
        notes: "Wet-sawn kiln dried, premium straightness"
      },
      {
        id: "item_03",
        name: "5.4m Timber Rails 75x50 Structural H3",
        quantity: 15,
        unit: "pcs",
        supplier: "Fencing Depot",
        notes: "Standard mid-rail and top-rail caps"
      },
      {
        id: "item_04",
        name: "LokkLatch Deluxe S3 Magnetic Security Latch",
        quantity: 2,
        unit: "sets",
        supplier: "D&D Technologies",
        notes: "Keyed alike with stainless steel components"
      },
      {
        id: "item_05",
        name: "TruClose Heavy Duty Self-Closing Gate Hinges",
        quantity: 4,
        unit: "pcs",
        supplier: "D&D Technologies",
        notes: "Model TCHD1, adjustable tension safety hinges"
      },
      {
        id: "item_06",
        name: "Colorbond Steel Rail 2400mm - Slate Grey",
        quantity: 6,
        unit: "pcs",
        supplier: "Colorbond Steel",
        notes: "Domain series bottom tracks"
      },
      {
        id: "item_07",
        name: "Colorbond Steel Trimclad Infill Sheet 1800mm",
        quantity: 18,
        unit: "pcs",
        supplier: "Colorbond Steel",
        notes: "Slate Grey panels, 0.35mpt thickness"
      }
    ]
  },
  "1002": {
    id: "1002",
    quoteNumber: "QT_1002",
    customer: {
      name: "Olivia Newton-John",
      phone: "0491 570 112",
      email: "olivia@summernights.com.au"
    },
    address: {
      street: "12 Summer Nights Lane",
      suburb: "Sandy Bay",
      state: "TAS",
      postcode: "7005",
      fullAddress: "12 Summer Nights Lane, Sandy Bay TAS 7005"
    },
    plannedWorksDate: "2026-06-18",
    items: [
      {
        id: "item_10",
        name: "Rapid-Set Concrete 20kg Bags",
        quantity: 24,
        unit: "bags",
        supplier: "Fencing Depot",
        notes: "High strength, 15 minute set"
      },
      {
        id: "item_11",
        name: "Galvanised Wire Spool 2.5mm High-Tensile",
        quantity: 1,
        unit: "roll",
        supplier: "Fencing Depot",
        notes: "500m length wire for boundary line tension"
      },
      {
        id: "item_12",
        name: "1.8m Treated Pine Plinth Boards 150x25",
        quantity: 10,
        unit: "pcs",
        supplier: "Fencing Depot",
        notes: "H4 Rated for soil containment contact"
      },
      {
        id: "item_13",
        name: "Colorbond Fence Post 2400mm C-Post - Surfmist",
        quantity: 20,
        unit: "pcs",
        supplier: "Colorbond Steel",
        notes: "High-wind rated posts"
      },
      {
        id: "item_14",
        name: "Colorbond Post Caps - Surfmist",
        quantity: 20,
        unit: "pcs",
        supplier: "Colorbond Steel",
        notes: "Pressed steel caps with spring-clips"
      }
    ]
  },
  "1003": {
    id: "1003",
    quoteNumber: "QT_1003",
    customer: {
      name: "Hugh Jackman",
      phone: "03 9821 4455",
      email: "wolverine@adamantium-fencing.co",
      company: "Claw Contracting"
    },
    address: {
      street: "3 Wolverine Way",
      suburb: "Steel Valley",
      state: "NSW",
      postcode: "2500",
      fullAddress: "3 Wolverine Way, Steel Valley NSW 2500"
    },
    plannedWorksDate: "2026-06-22",
    items: [
      {
        id: "item_20",
        name: "Premium Plinth Boards H4 150x38 4.8m",
        quantity: 8,
        unit: "pcs",
        supplier: "Fencing Depot",
        notes: "Heavy-duty retaining plinths"
      },
      {
        id: "item_21",
        name: "100mm Galv Coach Screws & Washers (Hex)",
        quantity: 50,
        unit: "pcs",
        supplier: "Fencing Depot",
        notes: "For mounting post-brackets"
      },
      {
        id: "item_22",
        name: "MagnaLatch Alert Gateway Safety Latch",
        quantity: 1,
        unit: "set",
        supplier: "D&D Technologies",
        notes: "Wired battery dual warning alert system"
      },
      {
        id: "item_23",
        name: "TruClose regular automatic self-closer hinges",
        quantity: 2,
        unit: "pcs",
        supplier: "D&D Technologies",
        notes: "Molded polymer, no-rust hinges"
      }
    ]
  }
};

// Generates a mock quote deterministically based on any quote number so that the app never crashes
// and always populates a beautiful, structured picking slip regardless of the quote input.
export function generateDeterministicQuote(quoteInput: string): QuoteData {
  // Strip non-digits to get a numerical seed
  const cleanedNo = quoteInput.replace(/[^0-9]/g, "");
  const seed = cleanedNo ? parseInt(cleanedNo, 10) : 1004;

  const names = ["Chris Pratt", "Liam Hemsworth", "Margot Robbie", "Russell Crowe", "Nicole Kidman", "Cate Blanchett", "Paul Hogan"];
  const streets = ["74 Wallaby Way", "88 Koala Ridge Drive", "102 Billabong Cresent", "42 Eucalyptus Avenue", "15 Wattle Street", "202 Great Ocean Rd"];
  const suburbs = ["Sydney", "Melbourne", "Brisbane", "Adelaide", "Perth", "Hobart", "Darwin", "Geelong", "Newcastle"];
  const states = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT"];
  
  const seedIndex = seed % 100;
  const customerName = names[seedIndex % names.length];
  const streetName = `${((seed * 7) % 180) + 1} ${streets[seedIndex % streets.length]}`;
  const suburbName = suburbs[seedIndex % suburbs.length];
  const stateCode = states[seedIndex % states.length];
  const postcodeValue = String(((seed * 13) % 7000) + 2000);

  // Derive a realistic date relative to current 2026-06-02
  const offsetDays = ((seed * 3) % 25) + 1;
  const plannedDate = new Date(2026, 5, 2 + offsetDays).toISOString().split("T")[0]; // June 2026

  // Generate deterministic items
  const items: QuoteItem[] = [];
  
  // Always include some standard post & palings
  items.push({
    id: `det_item_${seed}_1`,
    name: "1.8m Treated Pine Timber Posts 100x75",
    quantity: ((seed * 2) % 15) + 8,
    unit: "pcs",
    supplier: "Fencing Depot",
    notes: "H4 Sawn pine post for perimeter"
  });

  items.push({
    id: `det_item_${seed}_2`,
    name: "Rapid-Set Concrete Premix 20kg",
    quantity: ((seed * 4) % 30) + 12,
    unit: "bags",
    supplier: "Fencing Depot",
    notes: "Fast setting cement mix"
  });

  // Conditionally add D&D tech or Colorbond
  if (seed % 2 === 0) {
    items.push({
      id: `det_item_${seed}_3`,
      name: "MagnaLatch Series 3 Safety Gate Latch",
      quantity: (seed % 2) + 1,
      unit: "set",
      supplier: "D&D Technologies",
      notes: "Magnetic child safety pool latch"
    });
    items.push({
      id: `det_item_${seed}_4`,
      name: "TruClose Adjustable Heavy Duty Hinges",
      quantity: ((seed % 2) + 1) * 2,
      unit: "pcs",
      supplier: "D&D Technologies",
      notes: "Self-closing dynamic safety hinges"
    });
  }

  if (seed % 3 === 0 || seed % 2 !== 0) {
    items.push({
      id: `det_item_${seed}_5`,
      name: "Colorbond Fence Track Rails 2400mm - Wilderness Green",
      quantity: ((seed * 3) % 8) + 4,
      unit: "pcs",
      supplier: "Colorbond Steel",
      notes: "Tension track capping rails"
    });
    items.push({
      id: `det_item_${seed}_6`,
      name: "Colorbond Infill Ribbed Steel Sheet 1800mm",
      quantity: ((seed * 5) % 24) + 12,
      unit: "pcs",
      supplier: "Colorbond Steel",
      notes: "Neat double-sided powdercoated sheet steel"
    });
  }

  const quoteNoStr = quoteInput.startsWith("QT_") ? quoteInput : `QT_${quoteInput}`;

  return {
    id: seed,
    quoteNumber: quoteNoStr,
    customer: {
      name: customerName,
      phone: `0491 570 ${String((seed * 17) % 900).padStart(3, "0")}`,
      email: `${customerName.toLowerCase().replace(" ", ".")}@gmail.com`
    },
    address: {
      street: streetName,
      suburb: suburbName,
      state: stateCode,
      postcode: postcodeValue,
      fullAddress: `${streetName}, ${suburbName} ${stateCode} ${postcodeValue}`
    },
    plannedWorksDate: plannedDate,
    items
  };
}

export function getQuoteData(quoteInput: string): QuoteData {
  // Try matching directly
  const cleanedNum = quoteInput.trim().toUpperCase().replace("QT_", "");
  if (MOCK_QUOTES[cleanedNum]) {
    return MOCK_QUOTES[cleanedNum];
  }
  // Try lookup with full string
  if (MOCK_QUOTES[quoteInput]) {
    return MOCK_QUOTES[quoteInput];
  }
  // Generate deterministic if not found static
  return generateDeterministicQuote(quoteInput);
}
