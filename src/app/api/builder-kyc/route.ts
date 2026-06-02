import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "verification-docs";

// GET /api/builder-kyc — get builder KYC data (self or admin viewing any)
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let builderId = searchParams.get("builder_id") || session.sub;

  // Only admin can view other builders' KYC
  if (session.role === "agent" || (session.role === "builder" && builderId !== session.sub)) {
    builderId = session.sub;
  }

  // If admin wants all builder KYC records
  if ((session.role === "admin" || session.role === "verification" || session.role === "operations") && searchParams.get("builder_id") === "all") {
    const { data, error } = await supabaseAdmin
      .from("builder_projects_kyc")
      .select("*, profiles!builder_projects_kyc_builder_id_fkey(name, phone, agency_name)")
      .order("submitted_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ kycList: data || [] });
  }

  const { data: kyc, error } = await supabaseAdmin
    .from("builder_projects_kyc")
    .select("*")
    .eq("builder_id", builderId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ kyc });
}

// POST /api/builder-kyc — submit builder project/company details
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const projectName = formData.get("project_name") as string;
    const location = formData.get("location") as string;
    const city = formData.get("city") as string;
    const priceEstimate = formData.get("price_estimate") as string;
    const companyDetails = formData.get("company_details") as string;
    const brochure = formData.get("brochure") as File | null;

    if (!projectName || !city || !companyDetails) {
      return NextResponse.json({ error: "Project name, city, and company details are required." }, { status: 400 });
    }

    let brochureUrl = "";
    let brochureFileName = "";

    // Upload brochure if provided
    if (brochure && brochure.size > 0) {
      if (brochure.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: "Brochure too large. Max 10MB." }, { status: 400 });
      }

      const fileExt = brochure.name.split(".").pop() || "pdf";
      const storagePath = `builders/${session.sub}/brochure_${Date.now()}.${fileExt}`;
      const arrayBuffer = await brochure.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: brochure.type || "application/octet-stream",
          upsert: true,
        });

      if (uploadError) {
        console.error("Brochure upload error:", uploadError);
        return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
      }

      const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
      brochureUrl = urlData?.publicUrl || storagePath;
      brochureFileName = brochure.name;
    }

    // Insert KYC record
    const { data: kyc, error: insertError } = await supabaseAdmin
      .from("builder_projects_kyc")
      .insert([{
        builder_id: session.sub,
        project_name: projectName,
        location: location || null,
        city,
        price_estimate: priceEstimate || null,
        company_details: companyDetails,
        brochure_url: brochureUrl || null,
        brochure_file_name: brochureFileName || null,
      }])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update builder status to docs_uploaded
    await supabaseAdmin
      .from("profiles")
      .update({ status: "docs_uploaded" })
      .eq("id", session.sub);

    return NextResponse.json({ kyc });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("builder-kyc POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
