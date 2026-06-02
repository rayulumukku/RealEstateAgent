import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieName, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET = "verification-docs";

// GET /api/verification-docs?agent_id=xxx — get docs for an agent (admin) or self (agent)
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  let agentId = searchParams.get("agent_id");

  // Admin can fetch all docs (for listing in verification page)
  if ((session.role === "admin" || session.role === "verification" || session.role === "operations") && agentId === "all") {
    const { data: docs, error } = await supabaseAdmin
      .from("verification_documents")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ docs: docs || [] });
  }

  // Agents can only view their own docs
  if (session.role === "agent") {
    agentId = session.sub;
  }

  if (!agentId) {
    return NextResponse.json({ error: "agent_id required" }, { status: 400 });
  }

  const { data: docs, error } = await supabaseAdmin
    .from("verification_documents")
    .select("*")
    .eq("agent_id", agentId)
    .order("uploaded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ docs: docs || [] });
}

// POST /api/verification-docs — upload a document (agent only)
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName)?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = formData.get("doc_type") as string | null;

    if (!file || !docType) {
      return NextResponse.json({ error: "file and doc_type are required" }, { status: 400 });
    }

    const validTypes = ["rera_certificate", "pan_card", "aadhaar_card"];
    if (!validTypes.includes(docType)) {
      return NextResponse.json({ error: `Invalid doc_type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 5MB." }, { status: 400 });
    }

    const agentId = session.sub;
    const fileExt = file.name.split(".").pop() || "pdf";
    const storagePath = `${agentId}/${docType}_${Date.now()}.${fileExt}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const fileUrl = urlData?.publicUrl || storagePath;

    // Delete any previous doc of same type for this agent
    await supabaseAdmin
      .from("verification_documents")
      .delete()
      .eq("agent_id", agentId)
      .eq("doc_type", docType);

    // Insert metadata
    const { data: doc, error: insertError } = await supabaseAdmin
      .from("verification_documents")
      .insert([{
        agent_id: agentId,
        doc_type: docType,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
      }])
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Check if all 3 docs are uploaded — if yes, update status to docs_uploaded
    const { data: allDocs } = await supabaseAdmin
      .from("verification_documents")
      .select("doc_type")
      .eq("agent_id", agentId);

    const uploadedTypes = (allDocs || []).map((d: any) => d.doc_type);
    const allUploaded = validTypes.every(t => uploadedTypes.includes(t));

    if (allUploaded) {
      await supabaseAdmin
        .from("profiles")
        .update({ status: "docs_uploaded" })
        .eq("id", agentId);
    }

    return NextResponse.json({ doc, allUploaded });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("verification-docs POST error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
