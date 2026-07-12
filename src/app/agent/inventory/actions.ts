"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface DBProject {
  id: string;
  name: string;
  location: string;
  builder: string;
  price: string;
  availableUnits: number;
  type: "Plot" | "Villa" | "Apartment" | "Commercial";
  isPremium: boolean;
  roadWidth?: string;
  facing?: string;
  fencing?: boolean;
  pool?: boolean;
  builtUp?: string;
  smartHome?: boolean;
  balconyCount?: number;
  tower?: string;
  frontage?: string;
  parking?: string;
}

export interface Unit {
  unitNumber: string;
  bhk: string;
  sqft: number;
  price: string;
  status: "Available" | "Blocked" | "Sold";
  facing: string;
}

export interface ProjectDetail {
  id: string;
  name: string;
  location: string;
  city: string;
  builder: string;
  rera: string;
  priceRange: string;
  startingPrice: string;
  config: string;
  possession: string;
  totalLand: string;
  structures: string;
  overview: string;
  amenities: string[];
  floorplans: { name: string; size: string; rooms: string }[];
  pricing: { configuration: string; size: string; price: string }[];
  units: Unit[];
  brochureUrl?: string;
}

const PROJECTS_MOCK: Record<string, ProjectDetail> = {
  "skyline-heights": {
    id: "skyline-heights",
    name: "Skyline Heights",
    location: "Kokapet",
    city: "Hyderabad",
    builder: "Prestige Group",
    rera: "P02400003512",
    priceRange: "₹1.82 Cr - ₹2.75 Cr",
    startingPrice: "₹1.82 Cr*",
    config: "3 & 4 BHK",
    possession: "Dec 2026",
    totalLand: "8.5 Acres",
    structures: "4 Towers (G+32)",
    overview:
      "Skyline Heights in Kokapet, Hyderabad is a premium gated community designed for modern luxury living. Featuring high-end 3 and 4 BHK residential apartments, the development offers world-class amenities, excellent connectivity to the financial district, and gorgeous views of the Gandipet lake. Built using advanced Mivan technology for superior construction quality.",
    amenities: [
      "Clubhouse", "Swimming Pool", "Gymnasium", "Children Play Area",
      "24/7 Multi-tier Security", "100% Power Backup", "Indoor Games Room",
      "Jogging Track", "Multipurpose Hall", "Landscaped Gardens",
    ],
    floorplans: [
      { name: "3 BHK Type A", size: "1850 Sqft", rooms: "3 BHK + 3 Baths" },
      { name: "3 BHK Type B", size: "2150 Sqft", rooms: "3 BHK + 3 Baths + Servant" },
      { name: "4 BHK Type A", size: "2600 Sqft", rooms: "4 BHK + 4 Baths + Home Theatre" },
    ],
    pricing: [
      { configuration: "3 BHK", size: "1850 Sqft", price: "₹1.82 Cr Onwards" },
      { configuration: "3 BHK + Lounge", size: "2150 Sqft", price: "₹2.12 Cr Onwards" },
      { configuration: "4 BHK", size: "2600 Sqft", price: "₹2.55 Cr Onwards" },
    ],
    units: [
      { unitNumber: "A-302", bhk: "3 BHK", sqft: 1850, price: "₹1.82 Cr", status: "Available", facing: "East" },
      { unitNumber: "A-504", bhk: "3 BHK", sqft: 1850, price: "₹1.84 Cr", status: "Available", facing: "West" },
      { unitNumber: "A-801", bhk: "3 BHK", sqft: 2150, price: "₹2.15 Cr", status: "Blocked", facing: "North" },
      { unitNumber: "B-204", bhk: "4 BHK", sqft: 2600, price: "₹2.55 Cr", status: "Available", facing: "East" },
      { unitNumber: "B-1202", bhk: "4 BHK", sqft: 2600, price: "₹2.62 Cr", status: "Sold", facing: "North-East" },
    ],
  },
  "green-meadows": {
    id: "green-meadows",
    name: "Green Meadows Plots",
    location: "Gachibowli",
    city: "Hyderabad",
    builder: "GMR Infra",
    rera: "P02400004210",
    priceRange: "₹1.40 Cr - ₹1.95 Cr",
    startingPrice: "₹1.40 Cr*",
    config: "Open Plots",
    possession: "Ready",
    totalLand: "12 Acres",
    structures: "Gated layout, 84 plots",
    overview:
      "Green Meadows is a fully-developed plotted layout in Gachibowli with concrete roads, perimeter fencing, underground electrical cabling, and 24/7 security. Located 6 km from the Financial District, with multiple corner and east-facing options available.",
    amenities: [
      "Concrete Roads", "Underground Electricity", "Perimeter Fencing",
      "24/7 Security", "Children's Park", "Avenue Plantation",
    ],
    floorplans: [
      { name: "200 Sq Yards", size: "1800 Sqft", rooms: "Standard plot" },
      { name: "267 Sq Yards", size: "2400 Sqft", rooms: "Premium plot" },
      { name: "333 Sq Yards", size: "3000 Sqft", rooms: "Corner plot" },
    ],
    pricing: [
      { configuration: "200 Sq Yards", size: "1800 Sqft", price: "₹1.40 Cr Onwards" },
      { configuration: "267 Sq Yards", size: "2400 Sqft", price: "₹1.65 Cr Onwards" },
      { configuration: "333 Sq Yards", size: "3000 Sqft", price: "₹1.95 Cr Onwards" },
    ],
    units: [
      { unitNumber: "Plot 18", bhk: "Plot", sqft: 3000, price: "₹1.95 Cr", status: "Available", facing: "North" },
      { unitNumber: "Plot 42", bhk: "Plot", sqft: 2400, price: "₹1.65 Cr", status: "Available", facing: "East" },
      { unitNumber: "Plot 51", bhk: "Plot", sqft: 1800, price: "₹1.40 Cr", status: "Blocked", facing: "South" },
    ],
  },
  "luxury-haven": {
    id: "luxury-haven",
    name: "Prestige Villa Haven",
    location: "Jubilee Hills",
    city: "Hyderabad",
    builder: "Prestige Group",
    rera: "P02400005891",
    priceRange: "₹4.50 Cr - ₹7.20 Cr",
    startingPrice: "₹4.50 Cr*",
    config: "4 & 5 BHK Villas",
    possession: "Mar 2027",
    totalLand: "5.2 Acres",
    structures: "24 Independent Villas",
    overview:
      "Ultra-luxury villas in Jubilee Hills with private pools, smart home automation, and 4200+ sqft built-up areas. Each villa includes a private garden, dedicated lift, and home theatre.",
    amenities: [
      "Private Pool per Villa", "Smart Home Automation", "Dedicated Villa Lift",
      "Home Theatre", "Private Garden", "Concierge Services",
    ],
    floorplans: [
      { name: "4 BHK Villa", size: "4200 Sqft", rooms: "4 BHK + 5 Baths + Theatre" },
      { name: "5 BHK Villa", size: "5800 Sqft", rooms: "5 BHK + 6 Baths + Pool" },
    ],
    pricing: [
      { configuration: "4 BHK Villa", size: "4200 Sqft", price: "₹4.50 Cr Onwards" },
      { configuration: "5 BHK Villa", size: "5800 Sqft", price: "₹7.20 Cr Onwards" },
    ],
    units: [
      { unitNumber: "Villa 04", bhk: "4 BHK", sqft: 4200, price: "₹4.50 Cr", status: "Available", facing: "East" },
      { unitNumber: "Villa 11", bhk: "5 BHK", sqft: 5800, price: "₹7.20 Cr", status: "Blocked", facing: "North" },
      { unitNumber: "Villa 18", bhk: "5 BHK", sqft: 5800, price: "₹7.40 Cr", status: "Sold", facing: "East" },
    ],
  },
  "hitech-square": {
    id: "hitech-square",
    name: "Hitech Square Commercial",
    location: "Hitech City",
    city: "Hyderabad",
    builder: "L&T Realty",
    rera: "P02400007021",
    priceRange: "₹5.50 Cr - ₹12.00 Cr",
    startingPrice: "₹5.50 Cr*",
    config: "Office Floors & Retail",
    possession: "Sep 2026",
    totalLand: "3.8 Acres",
    structures: "1 Tower (G+22) + Retail Podium",
    overview:
      "Grade-A commercial tower in the heart of Hitech City with 60-foot frontage, 25 dedicated parking bays per floor, LEED Gold certification, and high-speed elevators.",
    amenities: [
      "Grade-A Lobby", "25 Parking Bays / Floor", "LEED Gold Certified",
      "High-speed Elevators", "Backup Power", "F&B Podium",
    ],
    floorplans: [
      { name: "Office Floor", size: "12,000 Sqft", rooms: "Open-plan office" },
      { name: "Retail Unit", size: "1,200 Sqft", rooms: "Ground-floor retail" },
    ],
    pricing: [
      { configuration: "Retail Unit", size: "1,200 Sqft", price: "₹5.50 Cr Onwards" },
      { configuration: "Office Floor", size: "12,000 Sqft", price: "₹12.00 Cr Onwards" },
    ],
    units: [
      { unitNumber: "GF-04", bhk: "Retail", sqft: 1200, price: "₹5.50 Cr", status: "Available", facing: "East" },
      { unitNumber: "L-08", bhk: "Office Floor", sqft: 12000, price: "₹12.00 Cr", status: "Available", facing: "North" },
    ],
  },
};

export async function getAgentInventoryProjects(): Promise<DBProject[]> {
  try {
    // 1. Fetch all projects with developer profiles
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from("projects")
      .select(`
        id,
        name,
        location,
        price_range,
        type,
        details,
        profiles!projects_developer_id_fkey (
          name,
          agency_name
        )
      `)
      .order("created_at", { ascending: false });

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      return [];
    }

    if (!projects || projects.length === 0) return [];

    // 2. Fetch all inventory units to compute available counts and extract details
    const { data: units, error: unitsError } = await supabaseAdmin
      .from("inventory_units")
      .select("id, project_id, status, details");

    if (unitsError) {
      console.error("Error fetching inventory units:", unitsError);
    }

    const unitsByProject = new Map<string, any[]>();
    (units || []).forEach((u: any) => {
      if (!unitsByProject.has(u.project_id)) {
        unitsByProject.set(u.project_id, []);
      }
      unitsByProject.get(u.project_id)!.push(u);
    });

    const typeMap: Record<string, "Plot" | "Villa" | "Apartment" | "Commercial"> = {
      plot: "Plot",
      villa: "Villa",
      apartment: "Apartment",
      commercial: "Commercial"
    };

    return projects.map((p: any) => {
      const projectUnits = unitsByProject.get(p.id) || [];
      const availableUnitsCount = projectUnits.filter((u: any) => u.status === "available").length;

      // Extract details from the first unit as representative template details
      const firstUnit = projectUnits[0];
      const ud = firstUnit?.details || {};

      // Fallback details from project itself or first unit details
      const pd = p.details || {};
      const rawType = (p.type || "apartment").toLowerCase();
      const type: "Plot" | "Villa" | "Apartment" | "Commercial" = typeMap[rawType] || "Apartment";

      // Detect premium status (if price exceeds 1.5 Cr or explicitly premium)
      const isPremium = pd.isPremium ?? pd.is_premium ?? (p.price_range && (p.price_range.includes("Cr") || p.price_range.includes("cr")));

      return {
        id: p.id,
        name: p.name,
        location: p.location,
        builder: (p as any).profiles?.agency_name || (p as any).profiles?.name || "Prestige Group",
        price: p.price_range || "Contact for Price",
        availableUnits: availableUnitsCount,
        type,
        isPremium: !!isPremium,

        // Plots
        roadWidth: ud.road_width || ud.roadWidth || "30 Feet",
        facing: ud.facing || "East",
        fencing: ud.fencing !== undefined ? ud.fencing : true,

        // Villas
        pool: ud.pool !== undefined ? ud.pool : true,
        builtUp: ud.built_up || ud.builtUp || ud.size || "3500 Sqft",
        smartHome: ud.smart_home !== undefined ? ud.smart_home : true,

        // Apartments
        balconyCount: ud.balcony_count || ud.balconyCount || 2,
        tower: ud.tower || "Tower A",

        // Commercial
        frontage: ud.frontage || "50 Feet",
        parking: ud.parking || "10 Bays"
      };
    });
  } catch (err) {
    console.error("Failed to get agent inventory projects:", err);
    return [];
  }
}

export async function getAgentInventoryProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  // Hardcoded project detail fallback for existing mock ids
  const hardcoded = PROJECTS_MOCK[projectId];
  if (hardcoded) return hardcoded;

  try {
    // 1. Fetch project with developer profile
    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .select(`
        id,
        name,
        location,
        price_range,
        type,
        details,
        profiles!projects_developer_id_fkey (
          name,
          agency_name
        )
      `)
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("Error fetching project detail:", projectError);
      return null;
    }

    // 2. Fetch inventory units for this project
    const { data: units, error: unitsError } = await supabaseAdmin
      .from("inventory_units")
      .select("*")
      .eq("project_id", projectId)
      .order("unit_name", { ascending: true });

    if (unitsError) {
      console.error("Error fetching project units:", unitsError);
    }

    const pd = project.details || {};
    const city = pd.city || project.location.split(",")[1]?.trim() || "Hyderabad";
    const loc = project.location.split(",")[0]?.trim() || project.location;

    // Build the mapped units array
    const mappedUnits: Unit[] = (units || []).map((u: any) => {
      const ud = u.details || {};
      const statusCapitalized = u.status === "available" ? "Available" : u.status === "booked" ? "Blocked" : "Sold";
      const priceVal = u.price !== undefined && u.price !== null ? u.price : (ud.price ?? null);
      
      let priceStr = "Contact for Price";
      if (priceVal) {
        if (priceVal >= 10000000) {
          priceStr = `₹${(priceVal / 10000000).toFixed(2)} Cr`;
        } else {
          priceStr = `₹${(priceVal / 100000).toFixed(2)} L`;
        }
      }

      return {
        unitNumber: u.unit_name,
        bhk: u.bhk_type !== undefined && u.bhk_type !== null ? u.bhk_type : (ud.bhk_type ?? ud.bhk ?? "3 BHK"),
        sqft: u.carpet_area_sqft !== undefined && u.carpet_area_sqft !== null ? u.carpet_area_sqft : (ud.carpet_area_sqft ?? 1800),
        price: priceStr,
        status: statusCapitalized,
        facing: u.facing !== undefined && u.facing !== null ? u.facing : (ud.facing ?? "East")
      };
    });

    // Derive configurations and pricing dynamically from units
    const configs = Array.from(new Set(mappedUnits.map(u => u.bhk)));
    const configStr = configs.length > 0 ? configs.join(" & ") : (project.type === "plot" ? "Open Plots" : "3 BHK");

    // Build floorplans and pricing
    const floorplans = configs.map(cfg => {
      const sample = mappedUnits.find(u => u.bhk === cfg);
      const sizeStr = sample ? `${sample.sqft} Sqft` : "1800 Sqft";
      return {
        name: `${cfg} Type A`,
        size: sizeStr,
        rooms: project.type === "plot" ? "Standard plot" : `${cfg} + 3 Baths`
      };
    });

    const pricing = configs.map(cfg => {
      const sample = mappedUnits.find(u => u.bhk === cfg);
      const priceStr = sample ? `${sample.price} Onwards` : `${project.price_range}`;
      const sizeStr = sample ? `${sample.sqft} Sqft` : "1800 Sqft";
      return {
        configuration: cfg,
        size: sizeStr,
        price: priceStr
      };
    });

    return {
      id: project.id,
      name: project.name,
      location: loc,
      city: city,
      builder: (project as any).profiles?.agency_name || (project as any).profiles?.name || "Builder",
      rera: pd.rera || "P02400003512",
      priceRange: project.price_range || "Contact for Price",
      startingPrice: project.price_range?.split("-")?.[0]?.trim() || project.price_range || "Contact for Price",
      config: configStr,
      possession: pd.possession || "Dec 2026",
      totalLand: pd.totalLand || pd.total_land || "10 Acres",
      structures: pd.structures || "Gated layout",
      overview: pd.overview || `${project.name} is a premium development located in ${loc}, ${city}. Designed for high-end luxury living with modern architecture, premium amenities, and excellent connectivity.`,
      amenities: pd.amenities || [
        "Clubhouse", "Swimming Pool", "Gymnasium", "Children Play Area",
        "24/7 Multi-tier Security", "100% Power Backup"
      ],
      floorplans,
      pricing,
      units: mappedUnits,
      brochureUrl: pd.brochureUrl || pd.brochure_url || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    };
  } catch (err) {
    console.error("Error in getAgentInventoryProjectDetail:", err);
    return null;
  }
}
