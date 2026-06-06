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

  // Fetch owned projects
  let combined: (BuilderProject & { created_at?: string })[] = [];
  const { data: owned } = await supabaseAdmin
    .from("projects")
    .select("id, name, location, created_at")
    .eq("developer_id", profile.id);

  if (owned) {
    combined = owned.map((p: any) => ({
      id: p.id,
      name: p.name,
      location: p.location,
      created_at: p.created_at
    }));
  }

  // Fetch projects shared by Super Builder
  const { data: shared } = await supabaseAdmin
    .from("project_shares")
    .select("project_id, projects(id, name, location, created_at)")
    .eq("builder_id", profile.id)
    .eq("status", "active");

  if (shared) {
    shared.forEach((s: any) => {
      if (s.projects && !combined.some(p => p.id === s.projects.id)) {
        combined.push({
          id: s.projects.id,
          name: s.projects.name,
          location: s.projects.location,
          created_at: s.projects.created_at
        });
      }
    });
  }

  // Sort combined projects by created_at desc
  combined.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return combined.map(p => ({ id: p.id, name: p.name, location: p.location }));
}

export async function getInventoryUnits(phone: string): Promise<InventoryUnit[]> {
  const projects = await getBuilderProjects(phone);
  if (!projects || projects.length === 0) return [];

  const projectIds = projects.map((p: any) => p.id);
  const projectMap = new Map(projects.map((p: any) => [p.id, p.name]));

  const { data: units } = await supabaseAdmin
    .from("inventory_units")
    .select("*")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  return (units || []).map((u: any) => {
    const d = u.details || {};
    return {
      id: u.id,
      project_id: u.project_id,
      project_name: projectMap.get(u.project_id) || "Unknown",
      unit_name: u.unit_name,
      status: u.status,
      floor_number: u.floor_number !== undefined && u.floor_number !== null ? u.floor_number : (d.floor_number ?? null),
      tower: u.tower !== undefined && u.tower !== null ? u.tower : (d.tower ?? null),
      facing: u.facing !== undefined && u.facing !== null ? u.facing : (d.facing ?? null),
      carpet_area_sqft: u.carpet_area_sqft !== undefined && u.carpet_area_sqft !== null ? u.carpet_area_sqft : (d.carpet_area_sqft ?? null),
      price: u.price !== undefined && u.price !== null ? u.price : (d.price ?? null),
      bhk_type: u.bhk_type !== undefined && u.bhk_type !== null ? u.bhk_type : (d.bhk_type ?? d.bhk ?? null),
      possession_date: u.possession_date !== undefined && u.possession_date !== null ? u.possession_date : (d.possession_date ?? null),
      details: d,
    };
  });
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
        details: {
          floor_number: input.floor_number || null,
          tower: input.tower || null,
          facing: input.facing || null,
          carpet_area_sqft: input.carpet_area_sqft || null,
          price: input.price || null,
          bhk_type: input.bhk_type || null,
          bhk: input.bhk_type || null,
          possession_date: input.possession_date || null,
        },
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
      .update({ status })
      .eq("id", unitId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function getProjectInventoryUnits(
  projectId: string
): Promise<InventoryUnit[]> {
  const { data: units } = await supabaseAdmin
    .from("inventory_units")
    .select("*")
    .eq("project_id", projectId)
    .order("unit_name", { ascending: true });

  return (units || []).map((u: any) => {
    const d = u.details || {};
    return {
      id: u.id,
      project_id: u.project_id,
      unit_name: u.unit_name,
      status: u.status,
      floor_number: u.floor_number !== undefined && u.floor_number !== null ? u.floor_number : (d.floor_number ?? null),
      tower: u.tower !== undefined && u.tower !== null ? u.tower : (d.tower ?? null),
      facing: u.facing !== undefined && u.facing !== null ? u.facing : (d.facing ?? null),
      carpet_area_sqft: u.carpet_area_sqft !== undefined && u.carpet_area_sqft !== null ? u.carpet_area_sqft : (d.carpet_area_sqft ?? null),
      price: u.price !== undefined && u.price !== null ? u.price : (d.price ?? null),
      bhk_type: u.bhk_type !== undefined && u.bhk_type !== null ? u.bhk_type : (d.bhk_type ?? d.bhk ?? null),
      possession_date: u.possession_date !== undefined && u.possession_date !== null ? u.possession_date : (d.possession_date ?? null),
      details: d,
    };
  });
}

export interface UpdateUnitInput {
  id: string;
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

export async function updateInventoryUnit(input: UpdateUnitInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("inventory_units")
      .update({
        unit_name: input.unit_name,
        status: input.status,
        details: {
          floor_number: input.floor_number || null,
          tower: input.tower || null,
          facing: input.facing || null,
          carpet_area_sqft: input.carpet_area_sqft || null,
          price: input.price || null,
          bhk_type: input.bhk_type || null,
          bhk: input.bhk_type || null,
          possession_date: input.possession_date || null,
        },
      })
      .eq("id", input.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateProjectUnitsFromExcel(
  projectId: string,
  units: any[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Delete existing units
    const { error: deleteError } = await supabaseAdmin
      .from("inventory_units")
      .delete()
      .eq("project_id", projectId);

    if (deleteError) {
      return { ok: false, error: "Failed to clear existing units: " + deleteError.message };
    }

    // Insert new units
    const unitsToInsert = units.map(u => {
      const detailsMerged = {
        ...(u.details || {}),
        floor_number: u.floor_number || null,
        tower: u.tower || null,
        facing: u.facing || null,
        carpet_area_sqft: u.carpet_area_sqft || null,
        price: u.price || null,
        bhk_type: u.bhk_type || null,
        bhk: u.bhk_type || null,
        possession_date: u.possession_date || null,
      };
      return {
        project_id: projectId,
        unit_name: u.unit_name,
        status: (u.status || "available").toLowerCase(),
        details: detailsMerged
      };
    });

    if (unitsToInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("inventory_units")
        .insert(unitsToInsert);

      if (insertError) {
        return { ok: false, error: "Failed to insert new units: " + insertError.message };
      }
    }

    return { ok: true };
  } catch (err) {
    console.error("Bulk Excel update error:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
