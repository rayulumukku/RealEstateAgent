"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface InventoryUnit {
  id: string;
  project_id: string;
  project_name?: string;
  unit_name: string;
  status: string;
  floor_number: number | null;
  tower: string | null;
  facing: string | null;
  carpet_area_sqft: number | null;
  price: number | null;
  bhk_type: string | null;
  possession_date: string | null;
  details: Record<string, any>;
}

export interface BuilderProject {
  id: string;
  name: string;
  location: string;
}

export async function getBuilderProjects(phone: string): Promise<BuilderProject[]> {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", formattedPhone)
    .single();

  if (!profile) return [];

  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name, location")
    .eq("developer_id", profile.id)
    .order("created_at", { ascending: false });

  return projects || [];
}

export async function getInventoryUnits(phone: string): Promise<InventoryUnit[]> {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.slice(-10);
  const formattedPhone = `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", formattedPhone)
    .single();

  if (!profile) return [];

  const { data: projects } = await supabaseAdmin
    .from("projects")
    .select("id, name")
    .eq("developer_id", profile.id);

  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p: any) => p.id);
  const projectMap = new Map(projects.map((p: any) => [p.id, p.name]));

  const { data: units } = await supabaseAdmin
    .from("inventory_units")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  return (units || []).map((u: any) => ({
    id: u.id,
    project_id: u.project_id,
    project_name: projectMap.get(u.project_id) || "Unknown",
    unit_name: u.unit_name,
    status: u.status,
    floor_number: u.floor_number,
    tower: u.tower,
    facing: u.facing,
    carpet_area_sqft: u.carpet_area_sqft,
    price: u.price,
    bhk_type: u.bhk_type,
    possession_date: u.possession_date,
    details: u.details || {},
  }));
}

export interface AddUnitInput {
  phone: string;
  project_id: string;
  unit_name: string;
  status: string;
  floor_number?: number;
  tower?: string;
  facing?: string;
  carpet_area_sqft?: number;
  price?: number;
  bhk_type?: string;
  possession_date?: string;
}

export async function addInventoryUnit(input: AddUnitInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.from("inventory_units").insert([
      {
        project_id: input.project_id,
        unit_name: input.unit_name,
        status: input.status || "available",
        floor_number: input.floor_number || null,
        tower: input.tower || null,
        facing: input.facing || null,
        carpet_area_sqft: input.carpet_area_sqft || null,
        price: input.price || null,
        bhk_type: input.bhk_type || null,
        possession_date: input.possession_date || null,
        details: {},
      },
    ]);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateUnitStatus(
  unitId: string,
  status: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("inventory_units")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", unitId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
